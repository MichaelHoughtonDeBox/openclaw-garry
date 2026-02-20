#!/usr/bin/env node

import process from "node:process";
import { pathToFileURL } from "node:url";
import { getFlagValue, hasFlag, parseNumberFlag } from "../../sherlock-incident-discovery/scripts/shared/cli.mjs";
import { parseFocusLocations } from "../../sherlock-incident-discovery/scripts/shared/focus.mjs";
import { createLogger } from "../../sherlock-incident-discovery/scripts/shared/logger.mjs";

const DEFAULT_STOP_WORDS = new Set([
  "and",
  "the",
  "that",
  "with",
  "from",
  "into",
  "this",
  "your",
  "then",
  "after",
  "near",
  "focus",
  "only",
  "investigate",
  "credible",
  "incidents",
  "incident",
  "reports",
  "report"
]);

/**
 * Extract URL leads from task text.
 * @param {string} text - Raw task description from Mission Control.
 * @returns {string[]} Stable list of unique lead URLs.
 */
export function extractLeadUrls(text) {
  const value = String(text || "");
  const matches = value.match(/https?:\/\/[^\s)]+/gi) || [];
  return Array.from(new Set(matches.map((url) => url.trim())));
}

/**
 * Infer `focus-locations` style values from task wording.
 * @param {string} text - Task description text.
 * @param {string[]} fallback - Pre-configured fallback locations.
 * @returns {string[]} Focus locations inferred from task, or fallback values.
 */
export function inferFocusLocations(text, fallback = []) {
  const value = String(text || "");
  const explicitFocus = value.match(/focus(?:\s+only)?\s+on\s+(.+?)(?:\.|$)/i)?.[1] || "";
  const normalizedExplicit = explicitFocus.trim();
  if (!normalizedExplicit) {
    return Array.isArray(fallback) ? fallback : [];
  }

  // Preserve "City, Country" tuples when users separate multiple locations with "and".
  const andSplit = normalizedExplicit
    .split(/\s+and\s+/i)
    .map((item) => item.trim())
    .filter(Boolean);
  if (andSplit.length > 1 && andSplit.every((item) => item.includes(","))) {
    return Array.from(new Set(andSplit));
  }

  const parsedExplicit = parseFocusLocations(normalizedExplicit);
  if (parsedExplicit.length) {
    return parsedExplicit;
  }
  return Array.isArray(fallback) ? fallback : [];
}

/**
 * Pull low-noise keywords that can seed directed searches.
 * @param {string[]} sources - Candidate text blocks (task description + lead snippets).
 * @returns {string[]} Ranked keyword candidates.
 */
export function extractHypothesisKeywords(sources) {
  const combined = (Array.isArray(sources) ? sources : [])
    .map((value) => String(value || "").toLowerCase())
    .join(" ");
  const counts = new Map();

  for (const token of combined.replace(/[^a-z0-9\s-]/g, " ").split(/\s+/)) {
    if (!token || token.length < 4 || DEFAULT_STOP_WORDS.has(token)) {
      continue;
    }
    counts.set(token, Number(counts.get(token) || 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([keyword]) => keyword);
}

/**
 * Fetch lightweight lead evidence from URLs for task hypothesis generation.
 * @param {string[]} urls - Lead URLs extracted from the task brief.
 * @param {{ timeoutMs?: number }} options - Optional timeout configuration.
 * @returns {Promise<Array<{url: string, title: string|null, snippet: string|null, error: string|null}>>}
 */
export async function fetchLeadEvidence(urls, options = {}) {
  const timeoutMs = Math.max(3000, Number(options.timeoutMs || process.env.SHERLOCK_TASK_URL_TIMEOUT_MS || 10000));
  const output = [];

  for (const url of Array.isArray(urls) ? urls : []) {
    let timer = null;
    try {
      const controller = new AbortController();
      timer = setTimeout(() => controller.abort(), timeoutMs);

      // Use a simple GET pipeline so task intake can inspect direct lead pages before widening search.
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": "SherlockTaskIntake/1.0"
        },
        signal: controller.signal
      });
      const text = await response.text();

      if (!response.ok) {
        output.push({
          url,
          title: null,
          snippet: null,
          error: `Lead URL returned status ${response.status}`
        });
        continue;
      }

      const rawText = String(text || "");
      const title = rawText.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() || null;
      const snippet = rawText
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 420);

      output.push({
        url,
        title,
        snippet: snippet || null,
        error: null
      });
    } catch (error) {
      output.push({
        url,
        title: null,
        snippet: null,
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      // Always clear timeout handles so repeated URL checks do not leak timers.
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  return output;
}

/**
 * Convert a Mission Control task brief into a structured directed run plan.
 * @param {{
 *  taskId?: string|null,
 *  taskName?: string,
 *  description?: string,
 *  focusLocations?: string[],
 *  defaultMinIncidents?: number,
 *  defaultMaxPasses?: number
 * }} input - Task intake configuration.
 * @returns {Promise<{
 *  mode: "directed",
 *  taskId: string|null,
 *  taskName: string,
 *  leadUrls: string[],
 *  leadTexts: string[],
 *  leadEvidence: Array<{url: string, title: string|null, snippet: string|null, error: string|null}>,
 *  focusLocations: string[],
 *  queryPlan: {xQuery: string, perplexityQueries: string[], queryFamily: string},
 *  runConfig: {minIncidents: number, maxPasses: number},
 *  notes: string[]
 * }>} Deterministic directed run configuration for Sherlock orchestration.
 */
export async function parseTaskIntake(input = {}) {
  const taskName = String(input.taskName || "Directed Sherlock task").trim();
  const description = String(input.description || "").trim();
  const fallbackFocus = Array.isArray(input.focusLocations) ? input.focusLocations : [];
  const leadUrls = extractLeadUrls(description);
  const leadEvidence = await fetchLeadEvidence(leadUrls);
  const focusLocations = inferFocusLocations(description, fallbackFocus);
  const leadTexts = leadEvidence
    .flatMap((item) => [item.title, item.snippet])
    .filter(Boolean)
    .map((value) => String(value).trim());

  const keywordCandidates = extractHypothesisKeywords([description, ...leadTexts]);
  const xKeywordClause = keywordCandidates.length ? keywordCandidates.join(" OR ") : "crime OR robbery OR assault";
  const xQuery = `(${xKeywordClause}) has:geo -is:retweet lang:en`;

  const perplexityQueries = [];
  if (leadUrls.length) {
    perplexityQueries.push(
      `Investigate these leads for credible incident details and corroboration: ${leadUrls.join(", ")}.`
    );
  }
  if (focusLocations.length) {
    perplexityQueries.push(
      `Find high-confidence incidents in ${focusLocations.join(", ")} with explicit location clues and source links.`
    );
  } else {
    perplexityQueries.push(
      "Find corroborating incidents with explicit location clues, reliable sources, and recent timestamps."
    );
  }

  const minIncidentsFromTask = Number(description.match(/min[\s_-]*incidents?\s*[:=]?\s*(\d+)/i)?.[1] || 0);
  const maxPassesFromTask = Number(description.match(/max[\s_-]*passes?\s*[:=]?\s*(\d+)/i)?.[1] || 0);
  const minIncidents = Math.max(1, Number(minIncidentsFromTask || input.defaultMinIncidents || 2));
  const maxPasses = Math.max(1, Math.min(Number(maxPassesFromTask || input.defaultMaxPasses || 2), 4));

  const notes = [];
  if (!leadUrls.length) {
    notes.push("No explicit lead URL was supplied; using text-only hypothesis strategy.");
  }
  if (leadEvidence.some((item) => item.error)) {
    notes.push("One or more lead URLs were unreachable; fallback query strategy has been applied.");
  }
  if (!focusLocations.length) {
    notes.push("No task-specific focus detected; using configured default focus locations.");
  }

  return {
    mode: "directed",
    taskId: input.taskId ? String(input.taskId) : null,
    taskName,
    leadUrls,
    leadTexts,
    leadEvidence,
    focusLocations,
    queryPlan: {
      xQuery,
      perplexityQueries,
      queryFamily: "task_hypothesis"
    },
    runConfig: {
      minIncidents,
      maxPasses
    },
    notes
  };
}

async function main() {
  const logger = createLogger("task-intake");
  const argv = process.argv.slice(2);

  const task = await parseTaskIntake({
    taskId: getFlagValue(argv, "--task-id", null),
    taskName: getFlagValue(argv, "--task-name", "Directed Sherlock task"),
    description: getFlagValue(argv, "--task-description", ""),
    focusLocations: parseFocusLocations(getFlagValue(argv, "--focus-locations", "")),
    defaultMinIncidents: parseNumberFlag(argv, "--default-min-incidents", 2),
    defaultMaxPasses: parseNumberFlag(argv, "--default-max-passes", 2)
  });

  if (hasFlag(argv, "--json")) {
    process.stdout.write(`${JSON.stringify(task, null, 2)}\n`);
    return;
  }

  logger.success("Task intake complete", {
    taskName: task.taskName,
    leadUrls: task.leadUrls.length,
    focusLocations: task.focusLocations,
    queryFamily: task.queryPlan.queryFamily
  });
}

const isDirectExecution = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectExecution) {
  main().catch((error) => {
    const logger = createLogger("task-intake");
    logger.error("Task intake failed", { error: error instanceof Error ? error.message : String(error) });
    process.exitCode = 1;
  });
}
