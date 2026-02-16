function unique(values) {
  return Array.from(new Set(values));
}

function parseJsonArray(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean);
    }
    return null;
  } catch {
    return null;
  }
}

export function parseFocusLocations(rawValue) {
  const raw = String(rawValue || "").trim();
  if (!raw) {
    return [];
  }

  // Allow JSON arrays for automation tooling.
  if (raw.startsWith("[")) {
    const parsedArray = parseJsonArray(raw);
    if (parsedArray) {
      return unique(parsedArray);
    }
  }

  // Primary delimiter for values that may include commas (city, country).
  if (raw.includes("||")) {
    return unique(raw.split("||").map((value) => value.trim()).filter(Boolean));
  }

  // Secondary format for multiline env values.
  if (raw.includes("\n")) {
    return unique(raw.split(/\r?\n/).map((value) => value.trim()).filter(Boolean));
  }

  return [raw];
}

function quoteXTerm(value) {
  const escaped = String(value).replace(/"/g, "").trim();
  return `"${escaped}"`;
}

export function applyFocusToXQuery(baseQuery, focusLocations) {
  const base = String(baseQuery || "").trim();
  if (!focusLocations.length) {
    return base;
  }

  const focusClause = `(${focusLocations.map(quoteXTerm).join(" OR ")})`;

  // Advanced users can inject the exact placement for focus terms.
  if (base.includes("{{focus_clause}}")) {
    return base.replaceAll("{{focus_clause}}", focusClause);
  }

  return `${base} ${focusClause}`.trim();
}

export function buildPerplexityFocusedQueries(baseQueries, focusLocations) {
  const normalizedBaseQueries = Array.isArray(baseQueries) ? baseQueries.map((query) => String(query).trim()).filter(Boolean) : [];
  if (!focusLocations.length) {
    return unique(normalizedBaseQueries);
  }

  const expanded = [];
  for (const query of normalizedBaseQueries) {
    if (query.includes("{{focus}}")) {
      for (const location of focusLocations) {
        expanded.push(query.replaceAll("{{focus}}", location));
      }
      continue;
    }

    for (const location of focusLocations) {
      // Explicit focus instruction keeps web retrieval constrained to requested geography.
      expanded.push(`${query} Focus geography: ${location}. Exclude incidents outside ${location}.`);
    }
  }

  return unique(expanded);
}
