import crypto from "node:crypto";
import { ConnectorBase } from "../base/connector-base.mjs";
import { fetchJsonWithTimeout, parseJsonArrayFromText } from "../../shared/http.mjs";
import { buildPerplexityFocusedQueries, parseFocusLocations } from "../../shared/focus.mjs";

function parseCoordinates(value) {
  if (!value || typeof value !== "object") {
    return { latitude: null, longitude: null };
  }
  const latitude = Number(value.latitude);
  const longitude = Number(value.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { latitude: null, longitude: null };
  }
  return { latitude, longitude };
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function buildStableId(sourcePlatform, sourceUrl, summary) {
  const hash = crypto
    .createHash("sha1")
    .update(`${sourcePlatform}|${sourceUrl}|${summary}`)
    .digest("hex")
    .slice(0, 16);
  return `${sourcePlatform}-${hash}`;
}

function parsePerplexityIncidents(content) {
  const parsedArray = parseJsonArrayFromText(content);
  if (!parsedArray) {
    return [];
  }

  return parsedArray
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => {
      const coordinates = parseCoordinates(entry.coordinates || entry.coordinate || {});
      const summary = String(entry.summary || entry.title || "").trim();
      const rawText = String(entry.rawText || entry.evidence || summary).trim();
      const sourceUrl = String(entry.sourceUrl || entry.url || "").trim();
      const sourcePlatform = String(entry.sourcePlatform || entry.platform || "web").trim().toLowerCase();
      return {
        sourcePlatform: sourcePlatform === "x" || sourcePlatform === "x.com" ? "x" : "web",
        sourceId: String(entry.sourceId || "").trim() || null,
        sourceUrl,
        summary,
        rawText,
        author: entry.author ? String(entry.author) : null,
        postedAt: entry.postedAt ? String(entry.postedAt) : null,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        locationLabel: entry.locationLabel ? String(entry.locationLabel) : null,
        keywords: ensureArray(entry.keywords).map((keyword) => String(keyword).toLowerCase()).filter(Boolean),
        severity: Number.isFinite(Number(entry.severity)) ? Number(entry.severity) : null,
        virality: entry.virality && typeof entry.virality === "object" ? entry.virality : {}
      };
    })
    .filter((entry) => entry.summary && entry.sourceUrl);
}

export class PerplexityWebConnector extends ConnectorBase {
  constructor(options = {}) {
    super("perplexity_web");
    this.apiKey = options.apiKey || process.env.PERPLEXITY_API_KEY || "";
    this.model = options.model || process.env.SHERLOCK_PERPLEXITY_MODEL || "sonar-pro";
    this.timeoutMs = Math.max(3000, Number(options.timeoutMs || process.env.SHERLOCK_PERPLEXITY_TIMEOUT_MS || 25000));
    const configuredQueries = (options.queries || process.env.SHERLOCK_PERPLEXITY_QUERIES || "")
      .split("||")
      .map((value) => value.trim())
      .filter(Boolean);
    this.baseQueries = configuredQueries.length
      ? configuredQueries
      : [
          "Find recent suspicious activity or crime incident reports from x.com and local news. Prioritize incidents with explicit latitude/longitude."
        ];
    this.focusLocations = Array.isArray(options.focusLocations)
      ? options.focusLocations.map((value) => String(value).trim()).filter(Boolean)
      : parseFocusLocations(options.focusLocationsRaw || process.env.SHERLOCK_FOCUS_LOCATIONS || "");
    this.queries = buildPerplexityFocusedQueries(this.baseQueries, this.focusLocations);
    this.apiUrl = options.apiUrl || process.env.SHERLOCK_PERPLEXITY_API_URL || "https://api.perplexity.ai/chat/completions";
  }

  async collect() {
    const warnings = [];
    const nowIso = new Date().toISOString();

    if (!this.apiKey) {
      warnings.push("PERPLEXITY_API_KEY is missing; skipping Perplexity connector.");
      return {
        connector: this.connectorName,
        candidates: [],
        checkpoint: { lastRunAt: nowIso },
        meta: { focusLocations: this.focusLocations, queries: this.queries },
        warnings
      };
    }

    const allCandidates = [];

    for (const query of this.queries) {
      // Force structured output to keep downstream normalization deterministic.
      const prompt = [
        "Return ONLY valid JSON array.",
        "Each array item must include:",
        "{",
        '  "sourcePlatform": "x" | "web",',
        '  "sourceId": "string or null",',
        '  "sourceUrl": "https://...",',
        '  "summary": "short summary",',
        '  "rawText": "source excerpt",',
        '  "author": "string or null",',
        '  "postedAt": "ISO timestamp or null",',
        '  "coordinates": { "latitude": number, "longitude": number },',
        '  "locationLabel": "string or null",',
        '  "keywords": ["keyword"],',
        '  "severity": 1-5,',
        '  "virality": { "likes": 0, "reposts": 0, "replies": 0, "views": 0 }',
        "}",
        "Exclude entries without sourceUrl.",
        `Query: ${query}`
      ].join("\n");

      const { response, json } = await fetchJsonWithTimeout(
        this.apiUrl,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: this.model,
            temperature: 0.1,
            messages: [
              {
                role: "system",
                content:
                  "You extract incident intelligence from web and social sources. Output only strict JSON."
              },
              {
                role: "user",
                content: prompt
              }
            ]
          })
        },
        this.timeoutMs
      );

      if (!response.ok) {
        warnings.push(`Perplexity query failed (${response.status}) for query: ${query}`);
        continue;
      }

      const content = json?.choices?.[0]?.message?.content || "";
      const parsedCandidates = parsePerplexityIncidents(content);
      if (!parsedCandidates.length) {
        warnings.push(`Perplexity returned no parseable incidents for query: ${query}`);
      }

      for (const candidate of parsedCandidates) {
        const sourceId =
          candidate.sourceId || buildStableId(candidate.sourcePlatform, candidate.sourceUrl, candidate.summary);
        allCandidates.push({
          connector: this.connectorName,
          ...candidate,
          sourceId,
          collectedAt: nowIso
        });
      }
    }

    return {
      connector: this.connectorName,
      candidates: allCandidates,
      checkpoint: { lastRunAt: nowIso },
      meta: { focusLocations: this.focusLocations, queries: this.queries },
      warnings
    };
  }
}
