export function hasFlag(argv, flag) {
  return argv.includes(flag);
}

export function getFlagValue(argv, flag, fallback = undefined) {
  const index = argv.indexOf(flag);
  if (index < 0) {
    return fallback;
  }
  return argv[index + 1] ?? fallback;
}

export function parseNumberFlag(argv, flag, fallback) {
  const raw = getFlagValue(argv, flag, String(fallback));
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
}

export function parseCommonFlags(argv) {
  return {
    json: hasFlag(argv, "--json"),
    dryRun: hasFlag(argv, "--dry-run"),
    stateFile: getFlagValue(argv, "--state-file"),
    limit: parseNumberFlag(argv, "--limit", 10),
    focusLocationsRaw: getFlagValue(argv, "--focus-locations", ""),
    xQuery: getFlagValue(argv, "--x-query", ""),
    perplexityQueriesRaw: getFlagValue(argv, "--perplexity-queries", ""),
    minIncidents: parseNumberFlag(argv, "--min-incidents", 1),
    maxPasses: parseNumberFlag(argv, "--max-passes", 1)
  };
}
