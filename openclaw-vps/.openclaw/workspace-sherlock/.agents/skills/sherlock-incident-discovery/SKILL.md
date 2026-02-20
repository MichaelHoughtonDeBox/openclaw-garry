---
name: sherlock-incident-discovery
version: 1.0.0
description: Legacy connector-based Sherlock incident pipeline. Use for controlled diagnostics/backfill only; primary heartbeat flow is now tool-driven.
---

# Sherlock Incident Discovery

Use this skill to run one autonomous Sherlock cycle that:

1. Collects incident candidates from X and web sources.
2. Normalizes candidates into canonical report-ready incident payloads.
3. Deduplicates candidates inside the cycle by source keys and proximity.
4. Submits valid incidents to the secured Wolf ingest endpoint.
5. Persists connector cursor/checkpoint state for idempotent follow-up runs.
6. Can run multi-pass search when initial evidence is insufficient.
7. Backfills missing coordinates by geocoding location text before final rejection.

This skill is retained for backwards compatibility and controlled diagnostics.
Primary heartbeat/cron flow should use tool-driven discovery plus `finalize-agentic-cycle.mjs`.

## Runtime Layout

- `scripts/connectors/base/connector-base.mjs` - shared connector contract.
- `scripts/connectors/x-api/index.mjs` - official X recent-search connector with `sinceId` checkpoint support.
- `scripts/connectors/perplexity-web/index.mjs` - Perplexity web connector with strict JSON extraction.
- `scripts/normalize-incident.mjs` - canonical Sherlock -> Wolf ingest payload normalizer.
- `scripts/submit-to-wolf-ingest.mjs` - secured POST bridge to Wolf additive ingest endpoint.
- `scripts/run-sherlock-cycle.mjs` - orchestrator used by heartbeat and cron.

## Commands

```bash
# Run one full collection + submit cycle with JSON summary.
node /root/.openclaw/workspace-sherlock/.agents/skills/sherlock-incident-discovery/scripts/run-sherlock-cycle.mjs --json
```

```bash
# Dry run mode: collect + normalize, but skip Wolf writes and keep state unchanged.
node /root/.openclaw/workspace-sherlock/.agents/skills/sherlock-incident-discovery/scripts/run-sherlock-cycle.mjs --dry-run --json
```

```bash
# Optional location focus override (single or multiple values via || separator).
node /root/.openclaw/workspace-sherlock/.agents/skills/sherlock-incident-discovery/scripts/run-sherlock-cycle.mjs --dry-run --json --focus-locations "Johannesburg, South Africa||Cape Town, South Africa"
```

```bash
# Agentic multi-pass mode: keep searching (with broader queries) until threshold is met.
node /root/.openclaw/workspace-sherlock/.agents/skills/sherlock-incident-discovery/scripts/run-sherlock-cycle.mjs --json --min-incidents 3 --max-passes 2
```

```bash
# Model-directed hypothesis query override for a one-off run.
node /root/.openclaw/workspace-sherlock/.agents/skills/sherlock-incident-discovery/scripts/run-sherlock-cycle.mjs --json --x-query "(hijacking OR armed robbery OR suspicious activity) has:geo -is:retweet lang:en" --perplexity-queries "Find fresh incidents in {{focus}} with reliable source links."
```

```bash
# Collect only from the X connector and persist checkpoint.
node /root/.openclaw/workspace-sherlock/.agents/skills/sherlock-incident-discovery/scripts/collect-x-incidents.mjs --json
```

```bash
# Collect only from the Perplexity connector and persist checkpoint.
node /root/.openclaw/workspace-sherlock/.agents/skills/sherlock-incident-discovery/scripts/collect-perplexity-incidents.mjs --json
```

## Required Environment Variables

- `SHERLOCK_X_BEARER_TOKEN`
- `PERPLEXITY_API_KEY` (or `SHERLOCK_PERPLEXITY_API_KEY` / `OPENROUTER_API_KEY`)
- `SHERLOCK_WOLF_INGEST_URL`
- `SHERLOCK_WOLF_INGEST_TOKEN`
- `HERE_API_KEY` (recommended for high quality geocoding fallback)

## Optional Focus Configuration

- `SHERLOCK_FOCUS_LOCATIONS` (format: `City, Country||City, Country`)
- You can also override per run with `--focus-locations`.
- Optional run flags:
  - `--min-incidents` minimum accepted normalized incidents before stopping
  - `--max-passes` number of autonomous search passes
  - `--x-query` one-off X query override
  - `--perplexity-queries` one-off web query list (`||` separated)

## Safety Rules

- Prefer `web_search` / `web_fetch` / `browser` discovery in standard runtime.
- Do not submit incidents without numeric latitude/longitude.
- Do not submit incidents without source URL and source identifier.
- Keep raw source snippets in metadata for auditability.
