#!/usr/bin/env node

import fs from "node:fs/promises";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { parseCommonFlags, getFlagValue } from "../../sherlock-incident-discovery/scripts/shared/cli.mjs";
import { createLogger } from "../../sherlock-incident-discovery/scripts/shared/logger.mjs";
import { loadState, resolveDefaultStateFile, saveState } from "../../sherlock-incident-discovery/scripts/shared/state-store.mjs";
import { loadWorkspaceEnv } from "../../sherlock-incident-discovery/scripts/shared/env.mjs";
import { enrichIncidentCandidates } from "../../sherlock-incident-enrichment/scripts/incident-enrichment.mjs";
import { submitIncidentBatch } from "../../sherlock-wolf-submission/scripts/wolf-submission.mjs";

/**
 * Ensure autonomy state always has expected keys.
 * @param {any} rawAutonomy - Existing state.autonomy payload.
 * @returns {{
 *  focusRotationIndex: number,
 *  randomSeed: number|null,
 *  lastSuccessfulQueryFamilies: string[],
 *  recentIncidentFingerprints: string[],
 *  lastRunMode: string|null,
 *  lastQueryFamily: string|null,
 *  lastTaskId: string|null,
 *  lastRunAt: string|null
 * }} Normalized autonomy state.
 */
function withAutonomyDefaults(rawAutonomy) {
  return {
    focusRotationIndex: 0,
    randomSeed: null,
    lastSuccessfulQueryFamilies: [],
    recentIncidentFingerprints: [],
    lastRunMode: null,
    lastQueryFamily: null,
    lastTaskId: null,
    lastRunAt: null,
    ...(rawAutonomy || {})
  };
}

/**
 * Keep unique values while preserving insertion order and tail window.
 * @param {Array<string|number|null|undefined>} values - Candidate values to normalize.
 * @param {number} maxItems - Max number of items to retain.
 * @returns {string[]} Tail window of normalized unique values.
 */
function keepLastUnique(values, maxItems) {
  const output = [];
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (!normalized || output.includes(normalized)) {
      continue;
    }
    output.push(normalized);
  }
  return output.slice(Math.max(0, output.length - Math.max(1, Number(maxItems || 1))));
}

/**
 * Read agentic candidate payload from disk.
 * @param {string} inputFile - JSON file path supplied by heartbeat runtime.
 * @returns {Promise<{candidates: any[], queryFamily: string|null}>} Parsed candidates and optional metadata.
 * @throws {Error} When payload is missing or invalid.
 */
async function readCandidatePayload(inputFile) {
  if (!String(inputFile || "").trim()) {
    throw new Error("Provide --input-file <path> containing candidates[] payload.");
  }
  const raw = await fs.readFile(inputFile, "utf8");
  const parsed = JSON.parse(raw);

  if (Array.isArray(parsed)) {
    return {
      candidates: parsed,
      queryFamily: null
    };
  }

  if (Array.isArray(parsed?.candidates)) {
    return {
      candidates: parsed.candidates,
      queryFamily: String(parsed?.meta?.queryFamily || "").trim() || null
    };
  }

  throw new Error("Input payload must be an array or object with candidates[].");
}

/**
 * Parse a boolean-like CLI value.
 * @param {string|undefined} rawValue - Raw string value from CLI flag.
 * @param {boolean} fallback - Fallback value when flag is absent.
 * @returns {boolean} Parsed boolean value.
 */
function parseBooleanFlag(rawValue, fallback) {
  const value = String(rawValue ?? "").trim().toLowerCase();
  if (!value) {
    return fallback;
  }
  if (["1", "true", "yes", "y"].includes(value)) {
    return true;
  }
  if (["0", "false", "no", "n"].includes(value)) {
    return false;
  }
  return fallback;
}

/**
 * Run deterministic enrichment/submission for agent-collected candidates.
 * @returns {Promise<void>} Completes with JSON/log output and optional non-zero exit code.
 */
async function main() {
  await loadWorkspaceEnv(import.meta.url);
  const logger = createLogger("finalize-agentic-cycle");
  const argv = process.argv.slice(2);
  const flags = parseCommonFlags(argv);
  const inputFile = getFlagValue(argv, "--input-file", "");
  const taskId = String(getFlagValue(argv, "--task-id", "") || "").trim() || null;
  const mode = getFlagValue(argv, "--mode", "autonomous") === "directed" ? "directed" : "autonomous";
  const stateFile = flags.stateFile || resolveDefaultStateFile(import.meta.url);
  const explicitQueryFamily = String(getFlagValue(argv, "--query-family", "") || "").trim();
  const minSummaryLength = Math.max(
    8,
    Number(getFlagValue(argv, "--min-summary-length", process.env.SHERLOCK_MIN_SUMMARY_LENGTH || 24))
  );
  const requireSourceIdentity = parseBooleanFlag(getFlagValue(argv, "--require-source-identity", undefined), true);

  const startedAt = new Date().toISOString();
  const state = await loadState(stateFile);
  const autonomyState = withAutonomyDefaults(state.autonomy);
  const payload = await readCandidatePayload(inputFile);
  const queryFamily = explicitQueryFamily || payload.queryFamily || null;

  // Keep enrichment deterministic and strict so only high-trust incidents reach Wolf ingest.
  const enrichment = await enrichIncidentCandidates({
    candidates: payload.candidates,
    previousFingerprints: autonomyState.recentIncidentFingerprints,
    quality: {
      minSummaryLength,
      requireSourceIdentity
    }
  });

  const submissionResult = await submitIncidentBatch({
    incidents: enrichment.normalizedIncidents,
    dryRun: flags.dryRun
  });
  const submission = submissionResult.submission;
  const submissionError = submissionResult.submissionError;
  const finishedAt = new Date().toISOString();

  const summary = {
    startedAt,
    finishedAt,
    mode,
    taskId,
    dryRun: flags.dryRun,
    queryFamily,
    candidateCounts: {
      raw: payload.candidates.length,
      deduped: enrichment.dedupe.keptWithinRun,
      droppedWithinRun: enrichment.dedupe.droppedWithinRun,
      droppedCrossCycle: enrichment.dedupe.droppedCrossCycle
    },
    normalization: {
      accepted: enrichment.normalizedIncidents.length,
      rejected: enrichment.rejected.length,
      rejectedDetails: enrichment.rejected
    },
    geocoding: enrichment.geocoding,
    submission,
    submissionError
  };

  const canPersistState = !flags.dryRun && !submissionError;
  if (canPersistState) {
    state.lastChecks.sherlock_cycle = finishedAt;
    if (submission && Number(submission.accepted || 0) > 0) {
      state.lastChecks.wolf_ingest_submit = finishedAt;
    }

    const successfulQueryFamilies = keepLastUnique(
      [...(autonomyState.lastSuccessfulQueryFamilies || []), ...(queryFamily ? [queryFamily] : [])],
      10
    );
    const recentFingerprints = keepLastUnique(
      [...(autonomyState.recentIncidentFingerprints || []), ...(enrichment.newFingerprints || [])],
      300
    );

    state.autonomy = {
      ...autonomyState,
      lastSuccessfulQueryFamilies: successfulQueryFamilies,
      recentIncidentFingerprints: recentFingerprints,
      lastRunMode: mode,
      lastQueryFamily: queryFamily || autonomyState.lastQueryFamily || null,
      lastTaskId: taskId || autonomyState.lastTaskId || null,
      lastRunAt: finishedAt
    };
    await saveState(stateFile, state);
  }

  if (flags.json) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } else {
    logger.success("Agentic cycle finalization complete", {
      mode,
      taskId,
      rawCandidates: summary.candidateCounts.raw,
      normalizedIncidents: summary.normalization.accepted,
      accepted: summary.submission?.accepted || 0
    });
  }

  if (submissionError) {
    logger.error("Agentic cycle finalization failed at submission step", { error: submissionError });
    process.exitCode = 1;
  }
}

const isDirectExecution = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectExecution) {
  main().catch((error) => {
    const logger = createLogger("finalize-agentic-cycle");
    logger.error("Agentic cycle finalizer crashed", { error: error instanceof Error ? error.message : String(error) });
    process.exitCode = 1;
  });
}
