#!/usr/bin/env node

import process from "node:process";
import { pathToFileURL } from "node:url";
import { XApiConnector } from "../../sherlock-incident-discovery/scripts/connectors/x-api/index.mjs";
import { PerplexityWebConnector } from "../../sherlock-incident-discovery/scripts/connectors/perplexity-web/index.mjs";
import { createLogger } from "../../sherlock-incident-discovery/scripts/shared/logger.mjs";
import { parseCommonFlags, getFlagValue, parseNumberFlag, hasFlag } from "../../sherlock-incident-discovery/scripts/shared/cli.mjs";
import { parseFocusLocations } from "../../sherlock-incident-discovery/scripts/shared/focus.mjs";
import { loadState, resolveDefaultStateFile } from "../../sherlock-incident-discovery/scripts/shared/state-store.mjs";

const DEFAULT_X_QUERY = '(crime OR robbery OR assault OR "suspicious activity") has:geo -is:retweet lang:en';
const BROAD_X_QUERY =
  '(crime OR robbery OR assault OR "suspicious activity" OR gun OR hijacking OR stabbing OR "breaking news") has:geo -is:retweet lang:en';
const DEFAULT_PERPLEXITY = [
  "Find recent suspicious activity or crime incident reports from x.com and local news. Prioritize incidents with explicit latitude/longitude."
];
const BROAD_PERPLEXITY = [
  "Find additional recent incidents with strong location clues, police/community alerts, and x.com references.",
  "Search for under-reported suspicious activity posts in local community groups and regional news."
];

/**
 * Pick a deterministic location subset for the current pass.
 * @param {string[]} allLocations - Full configured focus location list.
 * @param {{ mode?: string, pass?: number, focusRotationIndex?: number, windowSize?: number }} options - Selection controls.
 * @returns {string[]} Focus locations for this pass.
 */
export function selectFocusWindow(allLocations, options = {}) {
  const source = Array.isArray(allLocations) ? allLocations : [];
  if (!source.length) {
    return [];
  }

  // Directed mode should keep full context from task instructions.
  if (String(options.mode || "autonomous") === "directed") {
    return source;
  }

  const windowSize = Math.max(1, Math.min(Number(options.windowSize || 4), source.length));
  const pass = Math.max(1, Number(options.pass || 1));
  const rotationIndex = Math.max(0, Number(options.focusRotationIndex || 0));
  const start = (rotationIndex + (pass - 1) * windowSize) % source.length;

  const selected = [];
  for (let index = 0; index < windowSize; index += 1) {
    selected.push(source[(start + index) % source.length]);
  }
  return selected;
}

/**
 * Normalize query override input into an array.
 * @param {string[]|string|undefined|null} raw - Query input.
 * @returns {string[]} Normalized query array.
 */
export function normalizeQueryList(raw) {
  if (Array.isArray(raw)) {
    return raw.map((value) => String(value).trim()).filter(Boolean);
  }
  const value = String(raw || "").trim();
  if (!value) {
    return [];
  }
  return value.split("||").map((item) => item.trim()).filter(Boolean);
}

/**
 * Build the pass-specific collection plan used by connectors.
 * @param {{
 *  mode?: "autonomous"|"directed",
 *  pass?: number,
 *  focusLocations?: string[],
 *  limit?: number,
 *  overrides?: {xQuery?: string, perplexityQueries?: string[]},
 *  strategy?: {focusRotationIndex?: number}
 * }} input - Collection plan inputs.
 * @returns {{
 *  pass: number,
 *  mode: "autonomous"|"directed",
 *  queryFamily: string,
 *  focusLocations: string[],
 *  limit: number,
 *  xQuery: string,
 *  perplexityQueries: string[],
 *  nextFocusRotationIndex: number
 * }} Pass execution plan.
 */
export function buildCollectionPlan(input = {}) {
  const pass = Math.max(1, Number(input.pass || 1));
  const mode = String(input.mode || "autonomous") === "directed" ? "directed" : "autonomous";
  const rawFocus = Array.isArray(input.focusLocations) ? input.focusLocations : [];
  const strategy = input.strategy || {};
  const focusRotationIndex = Math.max(0, Number(strategy.focusRotationIndex || 0));
  const focusLocations = selectFocusWindow(rawFocus, {
    mode,
    pass,
    focusRotationIndex
  });
  const limit = Math.max(10, Math.min(Number(input.limit || 25), 100));
  const overrideXQuery = String(input.overrides?.xQuery || "").trim();
  const overridePerplexity = normalizeQueryList(input.overrides?.perplexityQueries);

  // Query family tags feed strategy memory so future runs can prioritize what worked.
  const queryFamily = overrideXQuery || overridePerplexity.length
    ? mode === "directed"
      ? "task_hypothesis"
      : "manual_override"
    : pass === 1
      ? "default"
      : "broadened";

  return {
    pass,
    mode,
    queryFamily,
    focusLocations,
    limit,
    xQuery: overrideXQuery || (pass === 1 ? DEFAULT_X_QUERY : BROAD_X_QUERY),
    perplexityQueries: overridePerplexity.length ? overridePerplexity : pass === 1 ? DEFAULT_PERPLEXITY : BROAD_PERPLEXITY,
    nextFocusRotationIndex: rawFocus.length
      ? (focusRotationIndex + Math.max(1, focusLocations.length)) % rawFocus.length
      : 0
  };
}

/**
 * Execute connector collection for one pass.
 * @param {{
 *  state?: any,
 *  mode?: "autonomous"|"directed",
 *  pass?: number,
 *  focusLocations?: string[],
 *  limit?: number,
 *  overrides?: {xQuery?: string, perplexityQueries?: string[]},
 *  strategy?: {focusRotationIndex?: number}
 * }} input - Collection execution inputs.
 * @returns {Promise<{
 *  plan: ReturnType<typeof buildCollectionPlan>,
 *  results: Array<any>,
 *  errors: string[],
 *  candidates: Array<any>
 * }>} Connector results and merged candidates.
 */
export async function collectSourceCandidates(input = {}) {
  const plan = buildCollectionPlan(input);
  const connectors = [
    new XApiConnector({
      maxResults: plan.limit,
      focusLocations: plan.focusLocations,
      query: plan.xQuery
    }),
    new PerplexityWebConnector({
      focusLocations: plan.focusLocations,
      queries: plan.perplexityQueries.join("||")
    })
  ];

  const settled = await Promise.allSettled(connectors.map((connector) => connector.collect({ state: input.state, limit: plan.limit })));
  const results = [];
  const errors = [];

  for (const entry of settled) {
    if (entry.status === "fulfilled") {
      results.push(entry.value);
      continue;
    }
    errors.push(entry.reason instanceof Error ? entry.reason.message : String(entry.reason));
  }

  return {
    plan,
    results,
    errors,
    candidates: results.flatMap((result) => result.candidates || [])
  };
}

async function main() {
  const logger = createLogger("source-collection");
  const argv = process.argv.slice(2);
  const flags = parseCommonFlags(argv);
  const stateFile = flags.stateFile || resolveDefaultStateFile(import.meta.url);
  const state = await loadState(stateFile);
  const run = await collectSourceCandidates({
    state,
    mode: getFlagValue(argv, "--mode", "autonomous"),
    pass: parseNumberFlag(argv, "--pass", 1),
    limit: flags.limit,
    focusLocations: parseFocusLocations(flags.focusLocationsRaw || process.env.SHERLOCK_FOCUS_LOCATIONS || ""),
    overrides: {
      xQuery: flags.xQuery,
      perplexityQueries: flags.perplexityQueriesRaw
    },
    strategy: {
      focusRotationIndex: parseNumberFlag(argv, "--focus-rotation-index", 0)
    }
  });

  if (hasFlag(argv, "--json")) {
    process.stdout.write(`${JSON.stringify(run, null, 2)}\n`);
    return;
  }

  logger.success("Collection pass complete", {
    pass: run.plan.pass,
    mode: run.plan.mode,
    queryFamily: run.plan.queryFamily,
    focusLocations: run.plan.focusLocations,
    candidates: run.candidates.length,
    errors: run.errors.length
  });
}

const isDirectExecution = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectExecution) {
  main().catch((error) => {
    const logger = createLogger("source-collection");
    logger.error("Collection failed", { error: error instanceof Error ? error.message : String(error) });
    process.exitCode = 1;
  });
}
