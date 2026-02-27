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

const INCIDENT_TYPE_ENUM = [
  "Violent Crimes",
  "Property & Financial Crimes",
  "Public Order & Social Crimes",
  "Cyber & Communication Crimes",
  "Organised Crime & Syndicate Operations",
  "Sexual Offences",
  "Water & Sanitation",
  "Electricity & Energy",
  "Roads & Traffic Infrastructure",
  "Waste Management",
  "Public Facilities & Services",
  "Environmental Hazards",
  "Communication & Access",
  "Other"
];

function inferIncidentType(text, candidateType) {
  const explicitType = String(candidateType || "").trim();
  if (INCIDENT_TYPE_ENUM.includes(explicitType)) {
    return explicitType;
  }

  const lowered = text.toLowerCase();
  // Map frequently seen phrases to the canonical enum values used by community tools.
  if (
    /(murder|homicide|shooting|gunfire|assault|stabbing|kidnap|abduction|armed robbery|carjacking|hijacking|violence)/.test(
      lowered
    )
  ) {
    return "Violent Crimes";
  }
  if (/(burglary|break-in|theft|robbery|fraud|scam|extortion|vandalism|shoplifting|stolen)/.test(lowered)) {
    return "Property & Financial Crimes";
  }
  if (/(riot|protest|public disorder|looting|unrest|gang fight|disturbance)/.test(lowered)) {
    return "Public Order & Social Crimes";
  }
  if (/(cyber|phishing|malware|ransomware|hacking|sim swap|online fraud|internet scam|data breach)/.test(lowered)) {
    return "Cyber & Communication Crimes";
  }
  if (/(syndicate|organised crime|organized crime|trafficking|drug ring|cartel|money laundering)/.test(lowered)) {
    return "Organised Crime & Syndicate Operations";
  }
  if (/(rape|sexual assault|molest|harassment|sexual offence|sexual offense)/.test(lowered)) {
    return "Sexual Offences";
  }
  if (/(water outage|water leak|sewage|sanitation|burst pipe|no water)/.test(lowered)) {
    return "Water & Sanitation";
  }
  if (/(power outage|load shedding|blackout|electricity|substation|transformer fault)/.test(lowered)) {
    return "Electricity & Energy";
  }
  if (/(pothole|traffic light|road closure|bridge collapse|accident hotspot|road damage)/.test(lowered)) {
    return "Roads & Traffic Infrastructure";
  }
  if (/(waste|garbage|refuse|illegal dumping|uncollected bins|bin collection)/.test(lowered)) {
    return "Waste Management";
  }
  if (/(clinic|hospital service|school infrastructure|park maintenance|public facility|service outage)/.test(lowered)) {
    return "Public Facilities & Services";
  }
  if (/(flood|storm damage|landslide|air pollution|hazardous spill|environmental hazard|wildfire)/.test(lowered)) {
    return "Environmental Hazards";
  }
  if (/(network outage|telecom outage|connectivity issue|signal loss|communication outage|no signal)/.test(lowered)) {
    return "Communication & Access";
  }
  return "Other";
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

function normalizeIsoDateTime(value) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

function normalizeDateAndTimeCandidate(dateValue, timeValue) {
  const date = String(dateValue || "").trim();
  if (!date) {
    return null;
  }
  const time = String(timeValue || "00:00:00").trim();
  const normalizedTime = time.includes(":") && time.split(":").length === 2 ? `${time}:00` : time;
  const parsed = new Date(`${date}T${normalizedTime}`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

function clamp01(value) {
  if (!Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, Math.min(1, value));
}

function inferSourceReliability(candidate) {
  const explicit = clamp01(Number(candidate.sourceReliability));
  if (explicit !== null) {
    return explicit;
  }

  const platform = String(candidate.sourcePlatform || "").toLowerCase();
  if (platform === "x") {
    return 0.55;
  }
  if (platform === "web") {
    return 0.65;
  }
  return 0.5;
}

function normalizeCorroborationCount(candidate) {
  const parsed = Number(candidate.corroborationCount);
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  return Math.max(0, Math.round(parsed));
}

function resolveIncidentDateTime(candidate) {
  const candidateConfidence = String(candidate.incidentDateTimeConfidence || "").trim().toLowerCase();
  const explicitIncident = normalizeIsoDateTime(candidate.incidentDateTime || candidate.incidentOccurredAt);
  if (explicitIncident) {
    if (candidateConfidence === "inferred" || candidateConfidence === "inferred_source_posted_at") {
      return { value: explicitIncident, confidence: "inferred_source_posted_at" };
    }
    return { value: explicitIncident, confidence: "explicit" };
  }

  const explicitDateAndTime = normalizeDateAndTimeCandidate(candidate.incidentDate || candidate.date, candidate.incidentTime || candidate.time);
  if (explicitDateAndTime) {
    return { value: explicitDateAndTime, confidence: "explicit" };
  }

  const inferredFromSource = normalizeIsoDateTime(candidate.postedAt);
  if (inferredFromSource) {
    return { value: inferredFromSource, confidence: "inferred_source_posted_at" };
  }

  return { value: null, confidence: "unknown" };
}

export function normalizeIncidentCandidate(candidate, options = {}) {
  const reporterId = options.reporterId || process.env.SHERLOCK_REPORTER_ID || "sherlock-agent";
  const primaryLatitude = Number(candidate.latitude);
  const primaryLongitude = Number(candidate.longitude);
  const hasPrimaryCoordinates = isValidCoordinate(primaryLatitude, primaryLongitude);
  const fallbackLatitude = Number(options.fallbackCoordinates?.latitude);
  const fallbackLongitude = Number(options.fallbackCoordinates?.longitude);
  const latitude = hasPrimaryCoordinates ? primaryLatitude : fallbackLatitude;
  const longitude = hasPrimaryCoordinates ? primaryLongitude : fallbackLongitude;
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

  const type = inferIncidentType(rawText, candidate.type || candidate.incidentType);
  const severity = normalizeSeverity(candidate, rawText);
  const keywords = normalizeKeywords(candidate, rawText, type);
  const incidentDateTime = resolveIncidentDateTime(candidate);
  const dateAndTime = toDateAndTime(incidentDateTime.value);

  const incident = {
    reporterId,
    coordinates: { latitude, longitude },
    type,
    severity: String(severity),
    keywords,
    summary,
    ...dateAndTime,
    incidentDateTime: incidentDateTime.value,
    incidentDateTimeConfidence: incidentDateTime.confidence,
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
    },
    verification: {
      sourceReliability: inferSourceReliability(candidate),
      corroborationCount: normalizeCorroborationCount(candidate),
      timeConfidence: incidentDateTime.confidence,
      geoConfidence: hasPrimaryCoordinates ? "exact" : "approx"
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
