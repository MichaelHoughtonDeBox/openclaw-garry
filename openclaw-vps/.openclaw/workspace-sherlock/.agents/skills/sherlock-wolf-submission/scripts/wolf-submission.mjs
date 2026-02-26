#!/usr/bin/env node

import fs from "node:fs/promises";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { getFlagValue, hasFlag } from "../../sherlock-incident-discovery/scripts/shared/cli.mjs";
import { createLogger } from "../../sherlock-incident-discovery/scripts/shared/logger.mjs";
import { loadWorkspaceEnv } from "../../sherlock-incident-discovery/scripts/shared/env.mjs";
import { submitIncidentsToWolfIngest } from "../../sherlock-incident-discovery/scripts/submit-to-wolf-ingest.mjs";

/**
 * Read normalized incidents from CLI input payload.
 * @param {string[]} argv - Raw CLI argument vector.
 * @returns {Promise<any[]>} Incident array from payload.
 */
async function readIncidentsFromCli(argv) {
  const inputFile = getFlagValue(argv, "--input-file", "");
  if (!inputFile) {
    throw new Error("Provide --input-file <path> containing incidents[] payload.");
  }

  const raw = await fs.readFile(inputFile, "utf8");
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (Array.isArray(parsed?.incidents)) {
    return parsed.incidents;
  }
  throw new Error("Input payload must be an array or object with incidents[]");
}

/**
 * Submit normalized incidents to Wolf ingest with deterministic error wrapping.
 * @param {{ incidents: any[], dryRun?: boolean }} input - Submission request.
 * @returns {Promise<{submission: any|null, submissionError: string|null}>} Submission payload and optional error.
 */
export async function submitIncidentBatch(input = {}) {
  try {
    const submission = await submitIncidentsToWolfIngest({
      incidents: Array.isArray(input.incidents) ? input.incidents : [],
      dryRun: input.dryRun === true
    });
    return {
      submission,
      submissionError: null
    };
  } catch (error) {
    return {
      submission: null,
      submissionError: error instanceof Error ? error.message : String(error)
    };
  }
}

async function main() {
  await loadWorkspaceEnv(import.meta.url);
  const logger = createLogger("wolf-submission");
  const argv = process.argv.slice(2);
  const incidents = await readIncidentsFromCli(argv);
  const result = await submitIncidentBatch({
    incidents,
    dryRun: hasFlag(argv, "--dry-run")
  });

  if (hasFlag(argv, "--json")) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  if (result.submissionError) {
    logger.error("Wolf submission failed", { error: result.submissionError });
    process.exitCode = 1;
    return;
  }

  logger.success("Wolf submission complete", {
    submitted: result.submission?.submitted || 0,
    accepted: result.submission?.accepted || 0,
    duplicates: result.submission?.duplicates || 0
  });
}

const isDirectExecution = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectExecution) {
  main().catch((error) => {
    const logger = createLogger("wolf-submission");
    logger.error("Wolf submission command failed", { error: error instanceof Error ? error.message : String(error) });
    process.exitCode = 1;
  });
}
