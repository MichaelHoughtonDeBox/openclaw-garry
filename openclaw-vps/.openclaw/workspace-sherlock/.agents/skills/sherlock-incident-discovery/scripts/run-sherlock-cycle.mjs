#!/usr/bin/env node

import process from "node:process";
import { createLogger } from "./shared/logger.mjs";
import { parseCommonFlags, getFlagValue } from "./shared/cli.mjs";
import { loadState, resolveDefaultStateFile, saveState } from "./shared/state-store.mjs";
import { parseFocusLocations } from "./shared/focus.mjs";
import { emitTelemetryEvents, getTelemetryConfig } from "./shared/telemetry.mjs";
import { collectSourceCandidates } from "../../sherlock-source-collection/scripts/source-collection.mjs";
import { enrichIncidentCandidates } from "../../sherlock-incident-enrichment/scripts/incident-enrichment.mjs";
import { loadWorkspaceEnv } from "./shared/env.mjs";
import { submitIncidentBatch } from "../../sherlock-wolf-submission/scripts/wolf-submission.mjs";

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

function keepLastUnique(values, maxItems) {
  const output = [];
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (!normalized) {
      continue;
    }
    if (output.includes(normalized)) {
      continue;
    }
    output.push(normalized);
  }
  return output.slice(Math.max(0, output.length - maxItems));
}

function summarizeConnectorResult(result) {
  return {
    connector: result.connector,
    candidates: Array.isArray(result.candidates) ? result.candidates.length : 0,
    focusLocations: result.meta?.focusLocations || [],
    query: result.meta?.query || null,
    queries: result.meta?.queries || null,
    warnings: result.warnings
  };
}

function createRunId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function asTaskIdOrUndefined(rawTaskId) {
  const taskId = String(rawTaskId || "").trim();
  return /^[a-fA-F0-9]{24}$/.test(taskId) ? taskId : undefined;
}

async function emitCycleTelemetry(input) {
  const event = {
    source: "heartbeat",
    status: input.status,
    eventType: input.eventType,
    message: input.message,
    dedupeKey: `${input.runId}:${input.dedupeSuffix}`,
    assignee: "sherlock",
    agentId: "sherlock",
    sessionKey: input.sessionKey || undefined,
    jobId: input.jobId || undefined,
    taskId: asTaskIdOrUndefined(input.taskId),
    metadata: {
      runId: input.runId,
      mode: input.mode,
      ...(input.metadata || {})
    },
    created_at: new Date().toISOString()
  };

  try {
    await emitTelemetryEvents({
      config: input.telemetryConfig,
      events: [event]
    });
  } catch (error) {
    // Telemetry must stay best-effort so incident discovery keeps progressing.
    input.logger.warn("Mission telemetry emit failed (non-fatal)", {
      eventType: input.eventType,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

async function main() {
  await loadWorkspaceEnv(import.meta.url);
  const logger = createLogger("run-sherlock-cycle");
  const argv = process.argv.slice(2);
  const flags = parseCommonFlags(process.argv.slice(2));
  const mode = getFlagValue(argv, "--mode", "autonomous") === "directed" ? "directed" : "autonomous";
  const taskId = getFlagValue(argv, "--task-id", "");
  const stateFile = flags.stateFile || resolveDefaultStateFile(import.meta.url);
  const state = await loadState(stateFile);
  const autonomyState = withAutonomyDefaults(state.autonomy);
  const focusLocations = parseFocusLocations(flags.focusLocationsRaw || process.env.SHERLOCK_FOCUS_LOCATIONS || "");
  const minIncidents = Math.max(1, Number(flags.minIncidents || 1));
  const maxPasses = Math.max(1, Math.min(Number(flags.maxPasses || 1), 4));
  const startedAt = new Date().toISOString();
  const runId = createRunId();
  const telemetryConfig = getTelemetryConfig();
  const telemetrySessionKey = String(process.env.OPENCLAW_SESSION_KEY || process.env.SHERLOCK_SESSION_KEY || "").trim();
  const telemetryJobId = String(process.env.OPENCLAW_CRON_JOB_ID || process.env.SHERLOCK_CRON_JOB_ID || "").trim();

  logger.info("Starting Sherlock cycle", {
    mode,
    taskId: taskId || null,
    dryRun: flags.dryRun,
    stateFile,
    focusLocations,
    minIncidents,
    maxPasses
  });

  const connectorErrors = [];
  const connectorResults = [];
  const allRawCandidates = [];
  let normalizationRejected = [];
  let normalizedIncidents = [];
  let enrichmentResult = null;
  const passSummaries = [];
  const usedQueryFamilies = [];

  await emitCycleTelemetry({
    telemetryConfig,
    logger,
    runId,
    mode,
    taskId,
    sessionKey: telemetrySessionKey,
    jobId: telemetryJobId,
    eventType: "sherlock_cycle_started",
    status: "info",
    dedupeSuffix: "cycle_started",
    message: `Sherlock cycle started (${mode})`,
    metadata: {
      dryRun: flags.dryRun,
      minIncidents,
      maxPasses,
      focusLocations
    }
  });

  try {
    for (let pass = 1; pass <= maxPasses; pass += 1) {
      const collection = await collectSourceCandidates({
        state,
        mode,
        pass,
        focusLocations,
        limit: flags.limit,
        overrides: {
          xQuery: flags.xQuery,
          perplexityQueries: flags.perplexityQueriesRaw
        },
        strategy: {
          focusRotationIndex: autonomyState.focusRotationIndex
        }
      });
      autonomyState.focusRotationIndex = collection.plan.nextFocusRotationIndex;

      const passConnectorResults = Array.isArray(collection.results) ? collection.results : [];
      connectorResults.push(...passConnectorResults);
      connectorErrors.push(...(collection.errors || []));
      allRawCandidates.push(...(collection.candidates || []));
      usedQueryFamilies.push(collection.plan.queryFamily);

      enrichmentResult = await enrichIncidentCandidates({
        candidates: allRawCandidates,
        previousFingerprints: autonomyState.recentIncidentFingerprints,
        quality: {
          minSummaryLength: Number(process.env.SHERLOCK_MIN_SUMMARY_LENGTH || 24),
          requireSourceIdentity: true
        }
      });
      normalizedIncidents = enrichmentResult.normalizedIncidents;
      normalizationRejected = enrichmentResult.rejected;

      passSummaries.push({
        pass,
        mode,
        queryFamily: collection.plan.queryFamily,
        focusLocations: collection.plan.focusLocations,
        connectors: passConnectorResults.map(summarizeConnectorResult),
        rawCandidates: (collection.candidates || []).length,
        normalizedIncidents: normalizedIncidents.length,
        droppedCrossCycle: enrichmentResult.dedupe.droppedCrossCycle
      });

      // Agentic behavior: continue searching if evidence is still insufficient.
      if (normalizedIncidents.length >= minIncidents) {
        break;
      }
    }

    await emitCycleTelemetry({
      telemetryConfig,
      logger,
      runId,
      mode,
      taskId,
      sessionKey: telemetrySessionKey,
      jobId: telemetryJobId,
      eventType: "sherlock_collection_complete",
      status: connectorErrors.length > 0 ? "skipped" : "ok",
      dedupeSuffix: "collection_complete",
      message: `Sherlock collection complete (${allRawCandidates.length} candidates)`,
      metadata: {
        passCount: passSummaries.length,
        rawCandidateCount: allRawCandidates.length,
        queryFamilies: keepLastUnique(usedQueryFamilies, 8),
        connectorErrorCount: connectorErrors.length,
        connectorErrors
      }
    });

    await emitCycleTelemetry({
      telemetryConfig,
      logger,
      runId,
      mode,
      taskId,
      sessionKey: telemetrySessionKey,
      jobId: telemetryJobId,
      eventType: "sherlock_enrichment_complete",
      status: "ok",
      dedupeSuffix: "enrichment_complete",
      message: `Sherlock enrichment complete (${normalizedIncidents.length} normalized incidents)`,
      metadata: {
        normalizedIncidentCount: normalizedIncidents.length,
        rejectedCount: normalizationRejected.length,
        geocoding: enrichmentResult?.geocoding || { successfulFallbacks: 0, unresolvedCandidates: 0 },
        dedupe: {
          keptWithinRun: enrichmentResult?.dedupe?.keptWithinRun || 0,
          droppedWithinRun: enrichmentResult?.dedupe?.droppedWithinRun || 0,
          droppedCrossCycle: enrichmentResult?.dedupe?.droppedCrossCycle || 0
        }
      }
    });

    const submissionResult = await submitIncidentBatch({
      incidents: normalizedIncidents,
      dryRun: flags.dryRun
    });
    const submission = submissionResult.submission;
    const submissionError = submissionResult.submissionError;

    const finishedAt = new Date().toISOString();
    const summary = {
      startedAt,
      finishedAt,
      mode,
      taskId: taskId || null,
      dryRun: flags.dryRun,
      focusLocations,
      passSummaries,
      connectors: connectorResults.map(summarizeConnectorResult),
      connectorErrors,
      candidateCounts: {
        raw: allRawCandidates.length,
        deduped: enrichmentResult?.dedupe?.keptWithinRun || 0,
        droppedByDedupe: enrichmentResult?.dedupe?.droppedWithinRun || 0,
        droppedCrossCycle: enrichmentResult?.dedupe?.droppedCrossCycle || 0
      },
      normalization: {
        accepted: normalizedIncidents.length,
        rejected: normalizationRejected.length,
        rejectedDetails: normalizationRejected
      },
      geocoding: enrichmentResult?.geocoding || { successfulFallbacks: 0, unresolvedCandidates: 0 },
      queryFamilies: keepLastUnique(usedQueryFamilies, 8),
      submission,
      submissionError
    };

    const canPersistState = !flags.dryRun && !submissionError;
    if (canPersistState) {
      for (const result of connectorResults) {
        if (result.connector === "x_api") {
          state.connectors.x_api = result.checkpoint;
        }
        if (result.connector === "perplexity_web") {
          state.connectors.perplexity_web = result.checkpoint;
        }
      }
      state.lastChecks.sherlock_cycle = finishedAt;
      if (submission && Number(submission.accepted || 0) > 0) {
        state.lastChecks.wolf_ingest_submit = finishedAt;
      }
      const queryFamilies = keepLastUnique(
        [...(autonomyState.lastSuccessfulQueryFamilies || []), ...summary.queryFamilies],
        10
      );
      const fingerprints = keepLastUnique(
        [...(autonomyState.recentIncidentFingerprints || []), ...(enrichmentResult?.newFingerprints || [])],
        300
      );
      state.autonomy = {
        ...autonomyState,
        lastSuccessfulQueryFamilies: queryFamilies,
        recentIncidentFingerprints: fingerprints,
        lastRunMode: mode,
        lastQueryFamily: summary.queryFamilies.length ? summary.queryFamilies[summary.queryFamilies.length - 1] : null,
        lastTaskId: taskId || autonomyState.lastTaskId || null,
        lastRunAt: finishedAt
      };
      await saveState(stateFile, state);
    }

    await emitCycleTelemetry({
      telemetryConfig,
      logger,
      runId,
      mode,
      taskId,
      sessionKey: telemetrySessionKey,
      jobId: telemetryJobId,
      eventType: "sherlock_submission_complete",
      status: submissionError ? "error" : "ok",
      dedupeSuffix: "submission_complete",
      message: submissionError
        ? "Sherlock submission failed."
        : `Sherlock submission complete (accepted=${Number(submission?.accepted || 0)})`,
      metadata: {
        submission,
        submissionError
      }
    });

    if (flags.json) {
      process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    } else {
      logger.success("Sherlock cycle complete", summary);
    }

    if (submissionError) {
      logger.error("Submission failed", { error: submissionError });
      process.exitCode = 1;
    }
    // Connector errors (e.g. Perplexity returning HTML, X API down) are non-fatal:
    // cycle completes with 0 candidates. Do not exit 1 — only submission failure is fatal.
    if (connectorErrors.length) {
      logger.warn("One or more connectors failed (cycle completed with 0 candidates)", { connectorErrors });
    }
  } catch (error) {
    await emitCycleTelemetry({
      telemetryConfig,
      logger,
      runId,
      mode,
      taskId,
      sessionKey: telemetrySessionKey,
      jobId: telemetryJobId,
      eventType: "sherlock_cycle_failed",
      status: "error",
      dedupeSuffix: "cycle_failed",
      message: error instanceof Error ? `Sherlock cycle failed: ${error.message}` : "Sherlock cycle failed.",
      metadata: {
        rawCandidateCount: allRawCandidates.length,
        normalizedIncidentCount: normalizedIncidents.length
      }
    });
    throw error;
  }
}

main().catch((error) => {
  const logger = createLogger("run-sherlock-cycle");
  logger.error("Cycle execution failed", { error: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
});
