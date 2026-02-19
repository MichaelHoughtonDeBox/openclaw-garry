#!/usr/bin/env node

import fs from "node:fs/promises";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { createLogger } from "./shared/logger.mjs";
import { getFlagValue, hasFlag } from "./shared/cli.mjs";

function isValidCoordinate(latitude, longitude) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function inferIncidentType(text) {
  const lowered = text.toLowerCase();
  if (lowered.includes("carjacking")) return "Carjacking";
  if (lowered.includes("burglary") || lowered.includes("break-in")) return "Burglary";
  if (lowered.includes("robbery") || lowered.includes("theft")) return "Theft/Robbery";
  if (lowered.includes("assault") || lowered.includes("stabbing")) return "Assault";
  if (lowered.includes("shooting") || lowered.includes("gunfire")) return "Armed Violence";
  if (lowered.includes("vandalism")) return "Vandalism";
  if (lowered.includes("fire")) return "Fire/Explosion";
  return "Suspicious Activity";
}

function normalizeSeverity(candidate, text) {
  const explicit = Number(candidate.severity);
  if (Number.isFinite(explicit)) {
    return Math.max(1, Math.min(Math.round(explicit), 5));
  }

  const lowered = text.toLowerCase();
  if (lowered.includes("shooting") || lowered.includes("stab")) return 5;
  if (lowered.includes("armed") || lowered.includes("carjacking")) return 4;
  if (lowered.includes("assault") || lowered.includes("robbery")) return 3;
  if (lowered.includes("theft") || lowered.includes("burglary")) return 2;
  return 1;
}

function normalizeKeywords(candidate, text, incidentType) {
  const baseKeywords = Array.isArray(candidate.keywords) ? candidate.keywords : [];
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => token.length > 3);

  // Keep keywords compact so report payloads remain focused and index-friendly.
  const merged = [...baseKeywords, ...incidentType.toLowerCase().split(/[\/\s]+/), ...tokens].map((keyword) =>
    String(keyword).toLowerCase().trim()
  );

  return Array.from(new Set(merged)).slice(0, 12);
}

function toDateAndTime(postedAt) {
  if (!postedAt) {
    return {};
  }
  const date = new Date(postedAt);
  if (Number.isNaN(date.getTime())) {
    return {};
  }
  return {
    date: date.toISOString().slice(0, 10),
    time: date.toISOString().slice(11, 19)
  };
}

export function normalizeIncidentCandidate(candidate, options = {}) {
  const reporterId = options.reporterId || process.env.SHERLOCK_REPORTER_ID || "sherlock-agent";
  const primaryLatitude = Number(candidate.latitude);
  const primaryLongitude = Number(candidate.longitude);
  const fallbackLatitude = Number(options.fallbackCoordinates?.latitude);
  const fallbackLongitude = Number(options.fallbackCoordinates?.longitude);
  const latitude = isValidCoordinate(primaryLatitude, primaryLongitude) ? primaryLatitude : fallbackLatitude;
  const longitude = isValidCoordinate(primaryLatitude, primaryLongitude) ? primaryLongitude : fallbackLongitude;
  const rawText = String(candidate.rawText || candidate.summary || "").trim();
  const summary = String(candidate.summary || rawText).trim().slice(0, 280);

  if (!summary) {
    return { ok: false, reason: "missing_summary" };
  }

  if (!isValidCoordinate(latitude, longitude)) {
    return { ok: false, reason: "missing_or_invalid_coordinates" };
  }

  if (!candidate.sourceUrl || !candidate.sourceId) {
    return { ok: false, reason: "missing_source_identity" };
  }

  const type = inferIncidentType(rawText);
  const severity = normalizeSeverity(candidate, rawText);
  const keywords = normalizeKeywords(candidate, rawText, type);
  const dateAndTime = toDateAndTime(candidate.postedAt);

  const incident = {
    reporterId,
    coordinates: { latitude, longitude },
    type,
    severity: String(severity),
    keywords,
    summary,
    ...dateAndTime,
    source: {
      platform: candidate.sourcePlatform || "web",
      sourceId: String(candidate.sourceId),
      url: String(candidate.sourceUrl),
      author: candidate.author || null,
      postedAt: candidate.postedAt || null
    },
    evidence: {
      text: rawText || summary,
      connector: candidate.connector || null,
      locationLabel: candidate.locationLabel || null,
      virality: candidate.virality || {},
      collectedAt: candidate.collectedAt || new Date().toISOString()
    }
  };

  return { ok: true, incident };
}

async function readCandidateFromCli(argv) {
  const filePath = getFlagValue(argv, "--input-file");
  if (filePath) {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  }

  const inlineCandidate = getFlagValue(argv, "--candidate");
  if (inlineCandidate) {
    return JSON.parse(inlineCandidate);
  }

  throw new Error("Provide --input-file <path> or --candidate '<json>'");
}

async function main() {
  const logger = createLogger("normalize-incident");
  const argv = process.argv.slice(2);

  const candidate = await readCandidateFromCli(argv);
  const result = normalizeIncidentCandidate(candidate);

  if (hasFlag(argv, "--json")) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  if (!result.ok) {
    logger.warn("Candidate rejected", { reason: result.reason });
    process.exitCode = 1;
    return;
  }

  logger.success("Candidate normalized", {
    sourceId: result.incident.source.sourceId,
    type: result.incident.type,
    severity: result.incident.severity
  });
}

const isDirectExecution = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectExecution) {
  main().catch((error) => {
    const logger = createLogger("normalize-incident");
    logger.error("Normalization failed", { error: error instanceof Error ? error.message : String(error) });
    process.exitCode = 1;
  });
}
