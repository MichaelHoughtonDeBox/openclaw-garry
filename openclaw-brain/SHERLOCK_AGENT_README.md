# Sherlock Agent README

This document explains how Sherlock works end-to-end inside OpenClaw, and how it integrates additively with `wolf-whatsapp-agents`.

## What Sherlock Is

Sherlock is an autonomous incident discovery agent that:

- runs on OpenClaw heartbeat/cron,
- collects candidate incidents from X API and Perplexity web search,
- normalizes + deduplicates candidates,
- geocodes location text to recover missing lat/long where possible,
- submits incidents to a secured additive ingest endpoint in Wolf,
- reuses Wolf's canonical enrichment, dedupe, and persistence functions.

## Design Intent

- **Additive only** in `wolf-whatsapp-agents` (no behavior changes to existing WhatsApp flows).
- **Canonical persistence path** remains in Wolf utility functions.
- **Traceable source metadata** is retained in report `source_data`.
- **Focused geography** can be set globally for cron via `SHERLOCK_FOCUS_LOCATIONS`.

## End-to-End Flow

1. OpenClaw cron wakes `sherlock` agent.
2. `workspace-sherlock/HEARTBEAT.md` runs hybrid task-first loop.
3. Sherlock polls Mission Control queue for assigned tasks.
   - If task exists: Sherlock claims it, executes directed investigation (URL/text lead), then completes/blocks task.
   - If no task exists: Sherlock executes autonomous discovery cycle.
4. Autonomous orchestrator runs both connectors.
   - If output is thin, it can run additional passes (`--max-passes`) with broader default queries.
   - Operator/model can override queries at runtime (`--x-query`, `--perplexity-queries`).
5. Each pass runs both connectors:
   - X recent search connector (`sinceId` checkpoint).
   - Perplexity web connector (structured JSON extraction).
6. Candidates are deduped within the cycle.
7. Candidates missing coordinates get a geocode fallback pass (HERE -> Nominatim).
8. Remaining candidates are normalized into Wolf ingest payload.
9. Payload is POSTed to Wolf internal endpoint:
   - `POST /api/internal/sherlock-ingest`
10. Wolf endpoint loops through incidents and calls:
   - `submitSherlockIncidentToExternalSystem(...)`
11. That helper reuses existing functions for:
   - HERE reverse geocoding (`location`),
   - weather enrichment (`weatherData`),
   - recent duplicate checks,
   - DB insert via `submitReportToDatabase(...)`.
12. Connector state is persisted in `workspace-sherlock/memory/heartbeat-state.json`.

## Human-Directed Tasking via Garry

You can assign Sherlock a task through Mission Control (typically via Garry), and Sherlock will process it before autonomous cron work.

Recommended task content:

- Include a **lead URL** and/or **incident text context**.
- Include desired geography/focus if relevant.
- Include expected outcome (e.g. "submit if credible", "research only", "verify then ingest").

Suggested task examples:

- "Investigate this URL and add credible incidents if geolocated: <URL>"
- "Use this report text as seed context, search for corroboration, then ingest validated incidents."
- "Focus only on London and Johannesburg for this lead."

## Key Files

### OpenClaw Side

- `openclaw-vps/.openclaw/openclaw.json`  
  Registers Sherlock in agent list and allows subagent invocation from main.

- `openclaw-vps/.openclaw/cron/jobs.json`  
  Adds `mc-sherlock-poll` schedule.

- `openclaw-vps/.openclaw/workspace-sherlock/HEARTBEAT.md`  
  Defines runtime command executed on heartbeat.

- `openclaw-vps/.openclaw/workspace-sherlock/.agents/skills/sherlock-incident-discovery/SKILL.md`  
  Skill docs and command references.

- `openclaw-vps/.openclaw/workspace-sherlock/.agents/skills/sherlock-incident-discovery/scripts/run-sherlock-cycle.mjs`  
  Orchestrator.

- `openclaw-vps/.openclaw/workspace-sherlock/.agents/skills/sherlock-incident-discovery/scripts/connectors/x-api/index.mjs`  
  X connector.

- `openclaw-vps/.openclaw/workspace-sherlock/.agents/skills/sherlock-incident-discovery/scripts/connectors/perplexity-web/index.mjs`  
  Perplexity connector.

- `openclaw-vps/.openclaw/workspace-sherlock/.agents/skills/sherlock-incident-discovery/scripts/normalize-incident.mjs`  
  Normalization and payload shaping.

- `openclaw-vps/.openclaw/workspace-sherlock/.agents/skills/sherlock-incident-discovery/scripts/submit-to-wolf-ingest.mjs`  
  Secure ingest bridge.

### Wolf Side

- `community-wolf/wolf-whatsapp-agents/app/api/internal/sherlock-ingest/route.ts`  
  New secured additive endpoint for machine ingest.

- `community-wolf/wolf-whatsapp-agents/lib/process-report-utils.ts`  
  Adds `submitSherlockIncidentToExternalSystem(...)`.

## Report Shape Written by Sherlock

Sherlock now follows a third-party style report structure:

- `description`: plain string (source narrative),
- `date`, `time`: explicit incident fields,
- `dateTime`, `localDateTime`: Date objects,
- `coordinates`: GeoJSON Point,
- `type`, `severity`, `keywords`, `summary`,
- `device: "web"`,
- `user_severity: ""`,
- `location`, `weatherData`,
- `source_data` with agent + provenance metadata.

`source_data` includes:

- `source: "agent"`
- `platform: "agent"`
- `upstream_platform` (`x`, `web`, etc.)
- `source_id`, `source_url`, `source_author`, `source_posted_at`
- `connector`, `location_label`, `virality`, `collected_at`

## Focus Location Configuration

Sherlock supports a list of target places for both connectors.

- Env var: `SHERLOCK_FOCUS_LOCATIONS`
- Delimiter: `||`
- Example:
  `Johannesburg, South Africa||Cape Town, South Africa||London, United Kingdom`

Current default in workspace config includes major South African and UK cities.

## Runtime Commands

```bash
# Run one full Sherlock cycle and print machine-readable summary.
node /root/.openclaw/workspace-sherlock/.agents/skills/sherlock-incident-discovery/scripts/run-sherlock-cycle.mjs --json
```

```bash
# Dry-run mode (no Wolf DB writes, no state mutation); use this for safe testing.
node /root/.openclaw/workspace-sherlock/.agents/skills/sherlock-incident-discovery/scripts/run-sherlock-cycle.mjs --dry-run --json
```

```bash
# Override location focus for this run only; this does not change persisted env defaults.
node /root/.openclaw/workspace-sherlock/.agents/skills/sherlock-incident-discovery/scripts/run-sherlock-cycle.mjs --dry-run --json --focus-locations "Johannesburg, South Africa||London, United Kingdom"
```

```bash
# Multi-pass autonomous run: if incidents are insufficient, continue searching with broader strategy.
node /root/.openclaw/workspace-sherlock/.agents/skills/sherlock-incident-discovery/scripts/run-sherlock-cycle.mjs --json --min-incidents 3 --max-passes 2
```

```bash
# Model-directed hypothesis run with one-off query overrides.
node /root/.openclaw/workspace-sherlock/.agents/skills/sherlock-incident-discovery/scripts/run-sherlock-cycle.mjs --dry-run --json --x-query "(hijacking OR armed robbery OR suspicious activity) has:geo -is:retweet lang:en" --perplexity-queries "Find fresh incidents in {{focus}} with reliable source links."
```

```bash
# Run smoke check from shared scripts workspace to validate Sherlock orchestration contract.
# Set SHERLOCK_CYCLE_SCRIPT locally when testing outside VPS absolute paths.
SHERLOCK_CYCLE_SCRIPT="/Users/michaelhoughton/Documents/openclaw-experiment/openclaw-vps/.openclaw/workspace-sherlock/.agents/skills/sherlock-incident-discovery/scripts/run-sherlock-cycle.mjs" npm run sherlock:smoke
```

## Environment Variables

Defined in:

- OpenClaw: `openclaw-vps/.openclaw/workspace/.env.example`
- Wolf: `community-wolf/wolf-whatsapp-agents/.env.sherlock.example`

Core OpenClaw vars:

- `SHERLOCK_X_BEARER_TOKEN`
- `PERPLEXITY_API_KEY`
- `SHERLOCK_X_QUERY`
- `SHERLOCK_FOCUS_LOCATIONS`
- `SHERLOCK_GEOCODE_TIMEOUT_MS`
- `SHERLOCK_WOLF_INGEST_URL`
- `SHERLOCK_WOLF_INGEST_TOKEN`
- `SHERLOCK_WOLF_PRODUCT_TYPE`
- `SHERLOCK_WOLF_DISPATCH_ALERTS`
- `SHERLOCK_REPORTER_ID`
- `SHERLOCK_PERPLEXITY_QUERIES`
- `HERE_API_KEY` (for preferred geocode provider)

Core Wolf var:

- `SHERLOCK_INGEST_TOKEN`

## Security Model

- OpenClaw -> Wolf ingest is protected by Bearer token.
- Endpoint rejects unauthenticated requests (`401`).
- Batch size is capped (`50`) to prevent oversized ingest payloads.

## Validation and Observability

- Orchestrator logs colorized status lines and can emit full JSON summary.
- Summary includes:
  - `focusLocations`,
  - pass summaries (`passSummaries`) for multi-pass reasoning trace,
  - connector warnings/errors,
  - candidate counts,
  - normalization accepted/rejected,
  - submission results.

## Troubleshooting

1. **No incidents found**
   - Check connector warnings in cycle output.
   - Confirm `SHERLOCK_X_BEARER_TOKEN` / `PERPLEXITY_API_KEY`.
   - Relax focus list or query constraints.

2. **Ingest unauthorized**
   - Verify `SHERLOCK_WOLF_INGEST_TOKEN` (OpenClaw) matches `SHERLOCK_INGEST_TOKEN` (Wolf).

3. **No DB writes**
   - Ensure not running with `--dry-run`.
   - Check endpoint response fields: `accepted`, `duplicates`, `failed`.

4. **Unexpected duplicate blocking**
   - Dedupe uses creator hash + location/time context via canonical Wolf helpers.
   - Confirm `SHERLOCK_REPORTER_ID` is stable and intended.

## Non-Regression Guarantee

The Sherlock integration is additive:

- no changes to existing WhatsApp webhook routes,
- no changes to current `submit_report` behavior for human users,
- new machine-ingest path is isolated behind new internal endpoint and helper.
