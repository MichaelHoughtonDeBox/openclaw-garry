#!/usr/bin/env node

import fs from "node:fs/promises";
import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@xdevplatform/xdk";
import {
  parseFocusLocations,
  applyFocusToXQuery
} from "../../workspace-sherlock/.agents/skills/sherlock-incident-discovery/scripts/shared/focus.mjs";

const color = {
  reset: "\u001b[0m",
  cyan: "\u001b[36m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  red: "\u001b[31m"
};

function logInfo(message) {
  process.stdout.write(`${color.cyan}[Sherlock XDK]${color.reset} ${message}\n`);
}

function toFiniteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function maxSnowflakeId(ids) {
  if (!ids.length) {
    return null;
  }
  return ids.reduce((maxValue, current) => {
    const currentBigInt = BigInt(current);
    return currentBigInt > maxValue ? currentBigInt : maxValue;
  }, BigInt(ids[0])).toString();
}

function getFlagValue(argv, flagName, fallbackValue = "") {
  const index = argv.indexOf(flagName);
  if (index < 0 || index + 1 >= argv.length) {
    return fallbackValue;
  }
  return argv[index + 1];
}

function hasFlag(argv, flagName) {
  return argv.includes(flagName);
}

async function loadEnvFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        continue;
      }
      const separator = trimmed.indexOf("=");
      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // Optional env files may not exist.
  }
}

async function loadSherlockEnv() {
  const thisScriptPath = fileURLToPath(import.meta.url);
  const workspaceRoot = path.resolve(path.dirname(thisScriptPath), "..");
  const sherlockRoot = path.resolve(workspaceRoot, "../workspace-sherlock");
  await loadEnvFile(path.join(sherlockRoot, ".env"));
  await loadEnvFile(path.join(sherlockRoot, ".env.local"));
}

function resolveDefaultStateFile() {
  const thisScriptPath = fileURLToPath(import.meta.url);
  const workspaceRoot = path.resolve(path.dirname(thisScriptPath), "..");
  return path.resolve(workspaceRoot, "../workspace-sherlock/memory/heartbeat-state.json");
}

async function loadState(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      lastChecks: {
        sherlock_cycle: null,
        wolf_ingest_submit: null
      },
      connectors: {
        x_api: {
          sinceId: null,
          lastRunAt: null
        }
      },
      autonomy: {
        focusRotationIndex: 0
      }
    };
  }
}

async function saveState(filePath, state) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function extractCoordinates(post, placesById) {
  const directCoordinates = post?.geo?.coordinates?.coordinates;
  if (Array.isArray(directCoordinates) && directCoordinates.length === 2) {
    const longitude = toFiniteNumber(directCoordinates[0]);
    const latitude = toFiniteNumber(directCoordinates[1]);
    if (latitude !== null && longitude !== null) {
      return { latitude, longitude, locationLabel: null };
    }
  }

  const placeId = post?.geo?.placeId || post?.geo?.place_id;
  if (!placeId || !placesById.has(placeId)) {
    return { latitude: null, longitude: null, locationLabel: null };
  }

  const place = placesById.get(placeId);
  const bbox = place?.geo?.bbox;
  if (!Array.isArray(bbox) || bbox.length !== 4) {
    return { latitude: null, longitude: null, locationLabel: place?.fullName || place?.full_name || place?.name || null };
  }

  const [west, south, east, north] = bbox.map(toFiniteNumber);
  if ([west, south, east, north].some((value) => value === null)) {
    return { latitude: null, longitude: null, locationLabel: place?.fullName || place?.full_name || place?.name || null };
  }

  return {
    latitude: Number(((south + north) / 2).toFixed(6)),
    longitude: Number(((west + east) / 2).toFixed(6)),
    locationLabel: place?.fullName || place?.full_name || place?.name || null
  };
}

function extractKeywords(text) {
  const lowered = String(text || "").toLowerCase();
  const dictionary = [
    "robbery",
    "theft",
    "assault",
    "shooting",
    "stabbing",
    "burglary",
    "carjacking",
    "suspicious",
    "vandalism",
    "fire"
  ];
  return dictionary.filter((keyword) => lowered.includes(keyword));
}

function inferSeverity(publicMetrics) {
  if (!publicMetrics) {
    return null;
  }
  const likeCount = Number(publicMetrics.likeCount ?? publicMetrics.like_count ?? 0);
  const repostCount = Number(publicMetrics.retweetCount ?? publicMetrics.retweet_count ?? 0);
  const replyCount = Number(publicMetrics.replyCount ?? publicMetrics.reply_count ?? 0);
  const score = likeCount + repostCount * 2 + replyCount;

  if (score >= 500) return 5;
  if (score >= 200) return 4;
  if (score >= 80) return 3;
  if (score >= 20) return 2;
  return 1;
}

function buildStableSourceId(post) {
  if (!post?.id) {
    return null;
  }
  return String(post.id);
}

function normalizeLookbackHours(raw) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return 24;
  }
  return Math.max(1, Math.min(Math.round(parsed), 168));
}

function isoHoursAgo(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function selectRotatingFocusLocations(allFocus, maxTerms, startIndex) {
  const values = Array.isArray(allFocus) ? allFocus : [];
  const total = values.length;
  const limit = Math.max(0, Number(maxTerms || 0));

  if (!total || !limit) {
    return {
      selected: [],
      droppedCount: total,
      focusRotationIndexUsed: 0,
      nextFocusRotationIndex: 0
    };
  }

  const windowSize = Math.min(limit, total);
  const normalizedStart = ((Number(startIndex) || 0) % total + total) % total;
  const selected = [];
  for (let offset = 0; offset < windowSize; offset += 1) {
    selected.push(values[(normalizedStart + offset) % total]);
  }

  return {
    selected,
    droppedCount: Math.max(0, total - windowSize),
    focusRotationIndexUsed: normalizedStart,
    nextFocusRotationIndex: (normalizedStart + windowSize) % total
  };
}

function isBadRequestError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("HTTP 400");
}

async function main() {
  await loadSherlockEnv();
  const argv = process.argv.slice(2);
  const dryRun = hasFlag(argv, "--dry-run");
  const outputFile = String(getFlagValue(argv, "--output-file", "") || "").trim();
  const stateFile = String(getFlagValue(argv, "--state-file", resolveDefaultStateFile()) || "").trim();
  const queryOverride = String(getFlagValue(argv, "--query", process.env.SHERLOCK_X_QUERY || "") || "").trim();
  const focusRaw = String(getFlagValue(argv, "--focus-locations", process.env.SHERLOCK_FOCUS_LOCATIONS || "") || "").trim();
  const maxResults = Math.max(
    10,
    Math.min(Number(getFlagValue(argv, "--max-results", process.env.SHERLOCK_X_MAX_RESULTS || "25")), 100)
  );
  const lookbackHours = normalizeLookbackHours(
    getFlagValue(argv, "--lookback-hours", process.env.SHERLOCK_X_LOOKBACK_HOURS || "24")
  );
  const maxFocusTerms = Math.max(
    1,
    Math.min(Number(getFlagValue(argv, "--focus-max-terms", process.env.SHERLOCK_X_FOCUS_MAX_TERMS || "4")), 10)
  );
  const bearerToken = String(getFlagValue(argv, "--bearer-token", process.env.SHERLOCK_X_BEARER_TOKEN || "") || "").trim();
  const allFocusLocations = parseFocusLocations(focusRaw);

  const state = await loadState(stateFile);
  state.connectors = state.connectors || {};
  state.connectors.x_api = state.connectors.x_api || { sinceId: null, lastRunAt: null };
  state.autonomy = state.autonomy || {};
  const currentFocusRotationIndex = Number(state.autonomy.focusRotationIndex || 0);
  const {
    selected: focusLocations,
    droppedCount: droppedFocusCount,
    focusRotationIndexUsed,
    nextFocusRotationIndex
  } = selectRotatingFocusLocations(allFocusLocations, maxFocusTerms, currentFocusRotationIndex);
  const query = applyFocusToXQuery(queryOverride, focusLocations);
  const nowIso = new Date().toISOString();
  const previousSinceId = state.connectors.x_api.sinceId || null;

  if (!bearerToken) {
    const skipped = {
      ok: true,
      mode: "xdk",
      skipped: true,
      reason: "missing_bearer_token",
      query,
      focusLocations,
      focusRotationIndexUsed,
      nextFocusRotationIndex,
      previousSinceId,
      nextSinceId: previousSinceId,
      candidates: [],
      warnings: ["SHERLOCK_X_BEARER_TOKEN is missing; skipping XDK collection."]
    };
    if (outputFile) {
      const payload = {
        meta: {
          queryFamily: "x_live_incidents",
          source: "xdk",
          query,
          focusLocations
        },
        candidates: []
      };
      await fs.writeFile(outputFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
      skipped.outputFile = outputFile;
    }
    process.stdout.write(`${JSON.stringify(skipped, null, 2)}\n`);
    return;
  }

  const client = new Client({ bearerToken });
  const options = {
    maxResults,
    expansions: ["author_id", "geo.place_id"],
    tweetFields: ["created_at", "author_id", "geo", "public_metrics", "text"],
    userFields: ["id", "name", "username"],
    placeFields: ["id", "name", "full_name", "country", "country_code", "geo"]
  };

  if (previousSinceId) {
    options.sinceId = String(previousSinceId);
  } else {
    options.startTime = isoHoursAgo(lookbackHours);
  }

  if (droppedFocusCount > 0) {
    logInfo(`Focus list trimmed for X query safety (using ${focusLocations.length}, dropped ${droppedFocusCount}).`);
  }

  let finalQuery = query;
  let response;
  logInfo(`Running XDK recent search (maxResults=${maxResults})`);
  try {
    response = await client.posts.searchRecent(finalQuery, options);
  } catch (error) {
    if (!focusLocations.length || !isBadRequestError(error)) {
      throw error;
    }
    // Fallback keeps X collection alive even when focus-augmented query is rejected by API parser/length limits.
    finalQuery = queryOverride;
    logInfo("Focus-augmented query rejected by X API; retrying with base query only.");
    response = await client.posts.searchRecent(finalQuery, options);
  }

  const posts = Array.isArray(response?.data) ? response.data : [];
  const users = Array.isArray(response?.includes?.users) ? response.includes.users : [];
  const places = Array.isArray(response?.includes?.places) ? response.includes.places : [];
  const usersById = new Map(users.map((user) => [String(user.id), user]));
  const placesById = new Map(places.map((place) => [String(place.id), place]));

  const candidates = posts
    .map((post) => {
      const sourceId = buildStableSourceId(post);
      if (!sourceId) {
        return null;
      }
      const coordinates = extractCoordinates(post, placesById);
      const author = usersById.get(String(post.authorId ?? post.author_id ?? ""));
      const rawText = String(post.text || "").trim();
      return {
        connector: "xdk-tools",
        sourcePlatform: "x",
        sourceId,
        sourceUrl: `https://x.com/i/web/status/${sourceId}`,
        summary: rawText.slice(0, 280),
        rawText,
        author: author?.username || author?.name || null,
        postedAt: post.createdAt || post.created_at || null,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        locationLabel: coordinates.locationLabel,
        keywords: extractKeywords(rawText),
        severity: inferSeverity(post.publicMetrics || post.public_metrics),
        virality: {
          likes: Number(post.publicMetrics?.likeCount ?? post.public_metrics?.like_count ?? 0),
          reposts: Number(post.publicMetrics?.retweetCount ?? post.public_metrics?.retweet_count ?? 0),
          replies: Number(post.publicMetrics?.replyCount ?? post.public_metrics?.reply_count ?? 0),
          views: Number(post.publicMetrics?.impressionCount ?? post.public_metrics?.impression_count ?? 0)
        },
        collectedAt: nowIso
      };
    })
    .filter(Boolean);

  const nextSinceId = maxSnowflakeId(
    [previousSinceId, ...posts.map((post) => (post?.id ? String(post.id) : null))].filter(Boolean)
  );

  if (!dryRun) {
    state.connectors.x_api.sinceId = nextSinceId;
    state.connectors.x_api.lastRunAt = nowIso;
    state.autonomy.focusRotationIndex = nextFocusRotationIndex;
    await saveState(stateFile, state);
  }

  const result = {
    ok: true,
    mode: "xdk",
    skipped: false,
    dryRun,
    query,
    focusLocations,
    droppedFocusCount,
    focusRotationIndexUsed,
    nextFocusRotationIndex,
    lookbackHours,
    previousSinceId,
    nextSinceId,
    candidateCount: candidates.length,
    candidates,
    warnings: []
  };

  if (!candidates.length) {
    result.warnings.push("XDK collection returned no matching posts.");
  }
  if (droppedFocusCount > 0) {
    result.warnings.push(`Focus list trimmed to ${focusLocations.length} terms for X query safety.`);
  }
  if (finalQuery !== query) {
    result.warnings.push("X API rejected focus-augmented query; fallback to base query was used.");
    result.query = finalQuery;
  }

  if (outputFile) {
    const payload = {
      meta: {
        queryFamily: "x_live_incidents",
        source: "xdk",
        query,
        focusLocations
      },
      candidates
    };
    await fs.writeFile(outputFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    result.outputFile = outputFile;
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${color.red}[Sherlock XDK] Failed:${color.reset} ${message}\n`);
  process.exitCode = 1;
});
