---
name: sherlock-geocode-resolution
description: Resolve incident locations using forward geocoding (address -> lat/lon) and reverse geocoding (lat/lon -> address) with tool-first execution for Sherlock.
---

# Sherlock Geocode Resolution

Use this skill whenever an incident candidate is missing either:

- numeric coordinates (`latitude`, `longitude`), or
- a human-readable place label.

This is a tool-driven skill and should run during discovery before finalisation.

## Purpose

- **Forward geocoding:** address/place text -> `latitude` + `longitude`.
- **Reverse geocoding:** `latitude` + `longitude` -> canonical place label.

## Required Tool Access

- `web_fetch` (required)
- `web_search` (optional fallback when source text is ambiguous)

## Provider Order

1. HERE geocoding APIs (primary, when `HERE_API_KEY` is available)
2. Nominatim OpenStreetMap (fallback)

## Forward Geocoding (address -> lat/lon)

When candidate has `locationLabel` or textual address but missing coordinates:

```text
GET https://geocode.search.hereapi.com/v1/geocode?q=<URL_ENCODED_ADDRESS>&limit=1&apiKey=<HERE_API_KEY>
```

Fallback:

```text
GET https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=<URL_ENCODED_ADDRESS>
```

## Reverse Geocoding (lat/lon -> address)

When candidate has coordinates but missing/weak place label:

```text
GET https://revgeocode.search.hereapi.com/v1/revgeocode?at=<LAT>,<LON>&limit=1&apiKey=<HERE_API_KEY>
```

Fallback:

```text
GET https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=<LAT>&lon=<LON>
```

## Output Contract

Return a deterministic object per candidate:

```json
{
  "ok": true,
  "resolutionType": "forward|reverse",
  "latitude": -26.2041,
  "longitude": 28.0473,
  "label": "Johannesburg, Gauteng, South Africa",
  "provider": "here|nominatim",
  "confidence": "high|medium|low",
  "evidenceUrl": "https://...",
  "notes": []
}
```

If resolution fails:

```json
{
  "ok": false,
  "resolutionType": "forward|reverse",
  "provider": "here|nominatim|none",
  "error": "Human-readable blocker",
  "notes": ["Explain why candidate could not be resolved"]
}
```

## Candidate Update Rules

- Preserve original source fields (`sourceId`, `sourceUrl`, `postedAt`) unchanged.
- Only set/overwrite:
  - `latitude`
  - `longitude`
  - `locationLabel`
  - `geocodeProvider` (optional metadata)
- Never invent coordinates.
- If both providers fail, keep candidate unresolved and record a blocker note.

## Guardrails

- Prefer specific addresses from source evidence over vague city-only phrases.
- If location text is ambiguous, use `web_search` to disambiguate before geocoding.
- Keep every geocode lookup traceable via `evidenceUrl`.
- Do not submit unresolved candidates to Wolf.
