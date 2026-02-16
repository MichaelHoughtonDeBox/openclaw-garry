#!/usr/bin/env node

import process from "node:process";
import { createLogger } from "./shared/logger.mjs";
import { parseCommonFlags } from "./shared/cli.mjs";
import { loadState, resolveDefaultStateFile, saveState } from "./shared/state-store.mjs";
import { XApiConnector } from "./connectors/x-api/index.mjs";
import { PerplexityWebConnector } from "./connectors/perplexity-web/index.mjs";
import { normalizeIncidentCandidate } from "./normalize-incident.mjs";
import { submitIncidentsToWolfIngest } from "./submit-to-wolf-ingest.mjs";
import { parseFocusLocations } from "./shared/focus.mjs";
import { resolveCoordinatesFromText } from "./shared/geocode.mjs";

function normalizeSummaryKey(summary) {
  return String(summary || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function dedupeCandidates(candidates) {
  const seenSource = new Set();
  const seenSemantic = new Set();
  const kept = [];
  const removed = [];

  for (const candidate of candidates) {
    const sourceKey = `${candidate.sourcePlatform}:${candidate.sourceId}`;
    if (seenSource.has(sourceKey)) {
      removed.push({ reason: "duplicate_source", sourceKey });
      continue;
    }

    const hasCoordinates = Number.isFinite(Number(candidate.latitude)) && Number.isFinite(Number(candidate.longitude));
    const coordinateKey = hasCoordinates
      ? `${Number(candidate.latitude).toFixed(3)}:${Number(candidate.longitude).toFixed(3)}`
      : "no-coordinates";
    const semanticKey = `${coordinateKey}:${normalizeSummaryKey(candidate.summary || candidate.rawText)}`;

    if (seenSemantic.has(semanticKey)) {
      removed.push({ reason: "duplicate_semantic", semanticKey });
      continue;
    }

    seenSource.add(sourceKey);
    seenSemantic.add(semanticKey);
    kept.push(candidate);
  }

  return { kept, removed };
}

function summarizeConnectorResult(result) {
  return {
    connector: result.connector,
    candidates: result.candidates.length,
    focusLocations: result.meta?.focusLocations || [],
    query: result.meta?.query || null,
    queries: result.meta?.queries || null,
    warnings: result.warnings
  };
}

function parsePerplexityQueries(rawValue) {
  const raw = String(rawValue || "").trim();
  if (!raw) {
    return [];
  }
  return raw
    .split("||")
    .map((value) => value.trim())
    .filter(Boolean);
}

function hasValidCoordinates(candidate) {
  const latitude = Number(candidate.latitude);
  const longitude = Number(candidate.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}

async function main() {
  const logger = createLogger("run-sherlock-cycle");
  const flags = parseCommonFlags(process.argv.slice(2));
  const stateFile = flags.stateFile || resolveDefaultStateFile(import.meta.url);
  const state = await loadState(stateFile);
  const focusLocations = parseFocusLocations(flags.focusLocationsRaw || process.env.SHERLOCK_FOCUS_LOCATIONS || "");
  const minIncidents = Math.max(1, Number(flags.minIncidents || 1));
  const maxPasses = Math.max(1, Math.min(Number(flags.maxPasses || 1), 4));
  const userPerplexityQueries = parsePerplexityQueries(flags.perplexityQueriesRaw);
  const startedAt = new Date().toISOString();

  logger.info("Starting Sherlock cycle", {
    dryRun: flags.dryRun,
    stateFile,
    focusLocations,
    minIncidents,
    maxPasses
  });

  const connectorErrors = [];
  const connectorResults = [];
  const allRawCandidates = [];
  const normalizationRejected = [];
  const normalizedIncidents = [];
  let geocodeSuccessCount = 0;
  let geocodeMissCount = 0;
  const passSummaries = [];

  for (let pass = 1; pass <= maxPasses; pass += 1) {
    const passXQuery = flags.xQuery
      ? flags.xQuery
      : pass === 1
        ? ""
        : '(crime OR robbery OR assault OR "suspicious activity" OR gun OR hijacking OR stabbing OR "breaking news") has:geo -is:retweet lang:en';
    const passPerplexityQueries = userPerplexityQueries.length
      ? userPerplexityQueries
      : pass === 1
        ? []
        : [
            "Find additional recent incidents with strong location clues, police/community alerts, and x.com references.",
            "Search for under-reported suspicious activity posts in local community groups and regional news."
          ];

    const connectors = [
      new XApiConnector({
        maxResults: flags.limit,
        focusLocations,
        query: passXQuery || undefined
      }),
      new PerplexityWebConnector({
        focusLocations,
        queries: passPerplexityQueries.length ? passPerplexityQueries.join("||") : undefined
      })
    ];

    const connectorSettled = await Promise.allSettled(
      connectors.map((connector) => connector.collect({ state, limit: flags.limit }))
    );

    const passConnectorResults = [];
    for (const settled of connectorSettled) {
      if (settled.status === "fulfilled") {
        passConnectorResults.push(settled.value);
        connectorResults.push(settled.value);
        continue;
      }
      connectorErrors.push(settled.reason instanceof Error ? settled.reason.message : String(settled.reason));
    }

    const passRawCandidates = passConnectorResults.flatMap((result) => result.candidates);
    allRawCandidates.push(...passRawCandidates);
    const passDedupe = dedupeCandidates(allRawCandidates);

    normalizedIncidents.length = 0;
    normalizationRejected.length = 0;
    for (const candidate of passDedupe.kept) {
      let fallbackCoordinates = null;
      if (!hasValidCoordinates(candidate)) {
        const geocodeInput = candidate.locationLabel || candidate.rawText || candidate.summary;
        const geocoded = await resolveCoordinatesFromText(geocodeInput);
        if (geocoded) {
          fallbackCoordinates = {
            latitude: geocoded.latitude,
            longitude: geocoded.longitude
          };
          candidate.locationLabel = candidate.locationLabel || geocoded.label || null;
          geocodeSuccessCount += 1;
        } else {
          geocodeMissCount += 1;
        }
      }

      const normalized = normalizeIncidentCandidate(candidate, { fallbackCoordinates });
      if (!normalized.ok) {
        normalizationRejected.push({
          sourceId: candidate.sourceId,
          reason: normalized.reason
        });
        continue;
      }
      normalizedIncidents.push(normalized.incident);
    }

    passSummaries.push({
      pass,
      connectors: passConnectorResults.map(summarizeConnectorResult),
      rawCandidates: passRawCandidates.length,
      normalizedIncidents: normalizedIncidents.length
    });

    // Agentic behavior: continue searching if evidence is still insufficient.
    if (normalizedIncidents.length >= minIncidents) {
      break;
    }
  }

  const dedupeResult = dedupeCandidates(allRawCandidates);

  let submission = null;
  let submissionError = null;
  if (normalizedIncidents.length) {
    try {
      submission = await submitIncidentsToWolfIngest({
        incidents: normalizedIncidents,
        dryRun: flags.dryRun
      });
    } catch (error) {
      submissionError = error instanceof Error ? error.message : String(error);
    }
  }

  const finishedAt = new Date().toISOString();
  const summary = {
    startedAt,
    finishedAt,
    dryRun: flags.dryRun,
    focusLocations,
    passSummaries,
    connectors: connectorResults.map(summarizeConnectorResult),
    connectorErrors,
    candidateCounts: {
      raw: allRawCandidates.length,
      deduped: dedupeResult.kept.length,
      droppedByDedupe: dedupeResult.removed.length
    },
    normalization: {
      accepted: normalizedIncidents.length,
      rejected: normalizationRejected.length,
      rejectedDetails: normalizationRejected
    },
    geocoding: {
      successfulFallbacks: geocodeSuccessCount,
      unresolvedCandidates: geocodeMissCount
    },
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
    await saveState(stateFile, state);
  }

  if (flags.json) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } else {
    logger.success("Sherlock cycle complete", summary);
  }

  if (submissionError) {
    logger.error("Submission failed", { error: submissionError });
    process.exitCode = 1;
  }
  if (connectorErrors.length) {
    logger.warn("One or more connectors failed", { connectorErrors });
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const logger = createLogger("run-sherlock-cycle");
  logger.error("Cycle execution failed", { error: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
});
