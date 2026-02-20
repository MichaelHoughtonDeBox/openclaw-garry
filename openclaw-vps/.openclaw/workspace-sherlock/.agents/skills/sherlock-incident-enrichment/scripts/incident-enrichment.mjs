#!/usr/bin/env node

import fs from "node:fs/promises";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { getFlagValue, hasFlag } from "../../sherlock-incident-discovery/scripts/shared/cli.mjs";
import { createLogger } from "../../sherlock-incident-discovery/scripts/shared/logger.mjs";
import { resolveCoordinatesFromText } from "../../sherlock-incident-discovery/scripts/shared/geocode.mjs";
import { normalizeIncidentCandidate } from "../../sherlock-incident-discovery/scripts/normalize-incident.mjs";

/**
 * Build a stable summary key for semantic dedupe.
 * @param {string} summary - Candidate summary text.
 * @returns {string} Normalized key used for duplicate checks.
 */
function normalizeSummaryKey(summary) {
  return String(summary || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

/**
 * Validate coordinate ranges for downstream submission safety.
 * @param {number|string|null|undefined} latitude - Latitude candidate value.
 * @param {number|string|null|undefined} longitude - Longitude candidate value.
 * @returns {boolean} True when coordinates are valid.
 */
function hasValidCoordinates(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

/**
 * Build cross-cycle fingerprint key for duplicate resistance.
 * @param {any} incident - Normalized incident payload.
 * @returns {string} Stable fingerprint string.
 */
function buildIncidentFingerprint(incident) {
  const sourceKey = `${incident?.source?.platform || "web"}:${incident?.source?.sourceId || "unknown"}`;
  const lat = Number(incident?.coordinates?.latitude || 0).toFixed(3);
  const lon = Number(incident?.coordinates?.longitude || 0).toFixed(3);
  const semantic = normalizeSummaryKey(incident?.summary || "");
  return `${sourceKey}|${lat}:${lon}|${semantic}`;
}

/**
 * Deduplicate candidates inside the current run.
 * @param {any[]} candidates - Candidate list from collectors.
 * @returns {{ kept: any[], removed: Array<{reason: string, key: string}> }} Deduplication result.
 */
function dedupeWithinRun(candidates) {
  const seenSource = new Set();
  const seenSemantic = new Set();
  const kept = [];
  const removed = [];

  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    const sourceKey = `${candidate?.sourcePlatform || "web"}:${candidate?.sourceId || "unknown"}`;
    if (seenSource.has(sourceKey)) {
      removed.push({ reason: "duplicate_source", key: sourceKey });
      continue;
    }

    const hasCoordinates = hasValidCoordinates(candidate?.latitude, candidate?.longitude);
    const coordinateKey = hasCoordinates
      ? `${Number(candidate.latitude).toFixed(3)}:${Number(candidate.longitude).toFixed(3)}`
      : "no-coordinates";
    const semanticKey = `${coordinateKey}:${normalizeSummaryKey(candidate?.summary || candidate?.rawText || "")}`;
    if (seenSemantic.has(semanticKey)) {
      removed.push({ reason: "duplicate_semantic", key: semanticKey });
      continue;
    }

    seenSource.add(sourceKey);
    seenSemantic.add(semanticKey);
    kept.push(candidate);
  }

  return { kept, removed };
}

/**
 * Read candidates payload from CLI file input.
 * @param {string[]} argv - Raw CLI arguments.
 * @returns {Promise<any[]>} Candidate list.
 */
async function readCandidatesFromCli(argv) {
  const inputFile = getFlagValue(argv, "--input-file", "");
  if (!inputFile) {
    throw new Error("Provide --input-file <path> containing candidates[] payload.");
  }
  const raw = await fs.readFile(inputFile, "utf8");
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (Array.isArray(parsed?.candidates)) {
    return parsed.candidates;
  }
  throw new Error("Input payload must be an array or object with candidates[]");
}

/**
 * Enrich and normalize raw candidates into Wolf submission incidents.
 * @param {{
 *  candidates: any[],
 *  previousFingerprints?: string[],
 *  quality?: { minSummaryLength?: number, requireSourceIdentity?: boolean }
 * }} input - Enrichment input.
 * @returns {Promise<{
 *  normalizedIncidents: any[],
 *  rejected: Array<{sourceId: string, reason: string}>,
 *  dedupe: {raw: number, keptWithinRun: number, droppedWithinRun: number, droppedCrossCycle: number},
 *  geocoding: {successfulFallbacks: number, unresolvedCandidates: number},
 *  newFingerprints: string[]
 * }>} Enrichment result payload.
 */
export async function enrichIncidentCandidates(input = {}) {
  const rawCandidates = Array.isArray(input.candidates) ? input.candidates : [];
  const quality = input.quality || {};
  const minSummaryLength = Math.max(8, Number(quality.minSummaryLength || 24));
  const requireSourceIdentity = quality.requireSourceIdentity !== false;
  const priorFingerprints = new Set((Array.isArray(input.previousFingerprints) ? input.previousFingerprints : []).map(String));

  const withinRun = dedupeWithinRun(rawCandidates);
  const normalizedIncidents = [];
  const rejected = [];
  let geocodeSuccessCount = 0;
  let geocodeMissCount = 0;
  let droppedCrossCycle = 0;

  for (const candidate of withinRun.kept) {
    const sourceId = String(candidate?.sourceId || "unknown");
    const summary = String(candidate?.summary || candidate?.rawText || "").trim();

    // Keep source identity strict to avoid low-trust submissions.
    if (requireSourceIdentity && (!candidate?.sourceUrl || !candidate?.sourceId)) {
      rejected.push({ sourceId, reason: "missing_source_identity" });
      continue;
    }

    // Enforce minimum narrative quality before heavier geocode/normalization work.
    if (summary.length < minSummaryLength) {
      rejected.push({ sourceId, reason: "summary_too_short" });
      continue;
    }

    let fallbackCoordinates = null;
    if (!hasValidCoordinates(candidate?.latitude, candidate?.longitude)) {
      const geocodeInput = candidate?.locationLabel || candidate?.rawText || candidate?.summary;
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
      rejected.push({ sourceId, reason: normalized.reason });
      continue;
    }

    const fingerprint = buildIncidentFingerprint(normalized.incident);
    if (priorFingerprints.has(fingerprint)) {
      droppedCrossCycle += 1;
      rejected.push({ sourceId, reason: "duplicate_cross_cycle" });
      continue;
    }

    normalizedIncidents.push(normalized.incident);
    priorFingerprints.add(fingerprint);
  }

  const newFingerprints = normalizedIncidents.map(buildIncidentFingerprint);

  return {
    normalizedIncidents,
    rejected,
    dedupe: {
      raw: rawCandidates.length,
      keptWithinRun: withinRun.kept.length,
      droppedWithinRun: withinRun.removed.length,
      droppedCrossCycle
    },
    geocoding: {
      successfulFallbacks: geocodeSuccessCount,
      unresolvedCandidates: geocodeMissCount
    },
    newFingerprints
  };
}

async function main() {
  const logger = createLogger("incident-enrichment");
  const argv = process.argv.slice(2);
  const candidates = await readCandidatesFromCli(argv);
  const previousFingerprints = String(getFlagValue(argv, "--previous-fingerprints", ""))
    .split("||")
    .map((value) => value.trim())
    .filter(Boolean);

  const result = await enrichIncidentCandidates({
    candidates,
    previousFingerprints
  });

  if (hasFlag(argv, "--json")) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  logger.success("Incident enrichment complete", {
    rawCandidates: result.dedupe.raw,
    normalizedIncidents: result.normalizedIncidents.length,
    rejected: result.rejected.length,
    droppedCrossCycle: result.dedupe.droppedCrossCycle
  });
}

const isDirectExecution = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectExecution) {
  main().catch((error) => {
    const logger = createLogger("incident-enrichment");
    logger.error("Incident enrichment failed", { error: error instanceof Error ? error.message : String(error) });
    process.exitCode = 1;
  });
}
