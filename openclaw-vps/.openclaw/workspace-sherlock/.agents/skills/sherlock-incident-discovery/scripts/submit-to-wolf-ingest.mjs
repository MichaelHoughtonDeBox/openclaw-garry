#!/usr/bin/env node

import fs from "node:fs/promises";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { createLogger } from "./shared/logger.mjs";
import { getFlagValue, hasFlag } from "./shared/cli.mjs";
import { fetchJsonWithTimeout } from "./shared/http.mjs";

export async function submitIncidentsToWolfIngest({
  incidents,
  dryRun = false,
  ingestUrl = process.env.SHERLOCK_WOLF_INGEST_URL || "",
  ingestToken = process.env.SHERLOCK_WOLF_INGEST_TOKEN || "",
  timeoutMs = Number(process.env.SHERLOCK_WOLF_INGEST_TIMEOUT_MS || 15000),
  productType = process.env.SHERLOCK_WOLF_PRODUCT_TYPE || "community",
  dispatchAlerts = process.env.SHERLOCK_WOLF_DISPATCH_ALERTS === "true"
}) {
  const nowIso = new Date().toISOString();
  if (!Array.isArray(incidents)) {
    throw new Error("incidents must be an array");
  }

  if (!incidents.length) {
    return {
      submitted: 0,
      accepted: 0,
      duplicates: 0,
      failed: 0,
      dryRun,
      completedAt: nowIso
    };
  }

  if (dryRun) {
    return {
      submitted: incidents.length,
      accepted: 0,
      duplicates: 0,
      failed: 0,
      dryRun: true,
      completedAt: nowIso
    };
  }

  if (!ingestUrl) {
    throw new Error("SHERLOCK_WOLF_INGEST_URL is missing");
  }
  if (!ingestToken) {
    throw new Error("SHERLOCK_WOLF_INGEST_TOKEN is missing");
  }

  // Submit in one batch so Wolf can perform canonical dedupe/enrichment centrally.
  const { response, json } = await fetchJsonWithTimeout(
    ingestUrl,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ingestToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sourceAgent: "sherlock",
        productType,
        dispatchAlerts,
        incidents
      })
    },
    timeoutMs
  );

  if (!response.ok) {
    throw new Error(`Wolf ingest request failed (${response.status})`);
  }

  return {
    submitted: incidents.length,
    accepted: Number(json?.accepted || 0),
    duplicates: Number(json?.duplicates || 0),
    failed: Number(json?.failed || 0),
    dryRun: false,
    completedAt: nowIso,
    details: json
  };
}

async function readIncidentsFromCli(argv) {
  const inputPath = getFlagValue(argv, "--input-file");
  if (!inputPath) {
    throw new Error("Provide --input-file <path> with incidents payload");
  }
  const raw = await fs.readFile(inputPath, "utf8");
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (Array.isArray(parsed?.incidents)) {
    return parsed.incidents;
  }
  throw new Error("Input JSON must be an array or object with incidents[]");
}

async function main() {
  const logger = createLogger("submit-to-wolf-ingest");
  const argv = process.argv.slice(2);
  const incidents = await readIncidentsFromCli(argv);
  const result = await submitIncidentsToWolfIngest({
    incidents,
    dryRun: hasFlag(argv, "--dry-run")
  });

  if (hasFlag(argv, "--json")) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  logger.success("Ingest submission complete", result);
}

const isDirectExecution = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectExecution) {
  main().catch((error) => {
    const logger = createLogger("submit-to-wolf-ingest");
    logger.error("Submission failed", { error: error instanceof Error ? error.message : String(error) });
    process.exitCode = 1;
  });
}
