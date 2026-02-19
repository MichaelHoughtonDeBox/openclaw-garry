# Sherlock Agent README

This document explains how Sherlock runs inside OpenClaw and how it integrates additively with `wolf-whatsapp-agents`.

## What Sherlock Is

Sherlock is a task-first, autonomous incident discovery agent that:

- runs on OpenClaw heartbeat/cron,
- uses built-in tools (`web_search`, `web_fetch`, optional `browser`) for discovery,
- normalises, deduplicates, and geocodes incident candidates,
- submits validated incidents to Wolf via a secured additive ingest endpoint,
- persists resumable strategy/dedupe state in `memory/heartbeat-state.json`.

## Design Intent

- **Agentic discovery:** Sherlock chooses its own tool sequence per task/objective.
- **Deterministic finalisation:** enrichment + submission remain scripted for safety.
- **Additive integration:** no behavioural changes to existing WhatsApp routes.
- **Traceability:** source metadata is preserved end-to-end.

## End-to-End Flow

1. OpenClaw cron wakes `sherlock`.
2. `workspace-sherlock/HEARTBEAT.md` executes task-first control flow.
3. Sherlock polls Mission Control and claims one READY task when available.
4. Directed tasks are parsed by `sherlock-task-intake` for lead/focus hints.
5. Sherlock collects incident evidence with `web_search` / `web_fetch` / `browser`.
6. Sherlock resolves missing coordinates/location labels with `sherlock-geocode-resolution`.
7. Sherlock writes a candidate payload JSON file.
8. Sherlock calls `finalize-agentic-cycle.mjs` to:
   - dedupe candidates,
   - geocode missing coordinates,
   - normalise to Wolf ingest shape,
   - submit to Wolf ingest,
   - update heartbeat autonomy state.
9. If a task was claimed, Sherlock writes a Mongo document artefact and then completes or blocks the task.
10. If no task exists and no credible incidents are found, Sherlock returns `HEARTBEAT_OK`.

## Key Files

### OpenClaw side

- `openclaw-vps/.openclaw/workspace-sherlock/HEARTBEAT.md`
- `openclaw-vps/.openclaw/workspace-sherlock/.agents/skills/sherlock-autonomy-orchestrator/SKILL.md`
- `openclaw-vps/.openclaw/workspace-sherlock/.agents/skills/sherlock-geocode-resolution/SKILL.md`
- `openclaw-vps/.openclaw/workspace-sherlock/.agents/skills/sherlock-autonomy-orchestrator/scripts/finalize-agentic-cycle.mjs`
- `openclaw-vps/.openclaw/workspace-sherlock/.agents/skills/sherlock-task-intake/scripts/task-intake.mjs`
- `openclaw-vps/.openclaw/workspace-sherlock/.agents/skills/sherlock-incident-enrichment/scripts/incident-enrichment.mjs`
- `openclaw-vps/.openclaw/workspace-sherlock/.agents/skills/sherlock-wolf-submission/scripts/wolf-submission.mjs`
- `openclaw-vps/.openclaw/workspace-sherlock/memory/heartbeat-state.json`

### Wolf side

- `community-wolf/wolf-whatsapp-agents/app/api/internal/sherlock-ingest/route.ts`
- `community-wolf/wolf-whatsapp-agents/lib/process-report-utils.ts`

## Candidate Payload Contract (Agent -> Finaliser)

Sherlock writes JSON shaped as:

```json
{
  "meta": {
    "queryFamily": "task_hypothesis"
  },
  "candidates": [
    {
      "sourcePlatform": "web",
      "sourceId": "stable-source-id",
      "sourceUrl": "https://example.com/source",
      "author": "Publisher name",
      "postedAt": "2026-02-16T10:30:00.000Z",
      "summary": "Incident summary",
      "rawText": "Evidence text excerpt",
      "latitude": -26.2041,
      "longitude": 28.0473,
      "locationLabel": "Johannesburg, South Africa",
      "connector": "agentic-tools",
      "keywords": ["robbery"],
      "severity": 3
    }
  ]
}
```

## Runtime Commands

```bash
# Validate deterministic finalisation with dry-run.
node /root/.openclaw/workspace-sherlock/.agents/skills/sherlock-autonomy-orchestrator/scripts/finalize-agentic-cycle.mjs --dry-run --json --mode autonomous --query-family smoke_test --input-file /tmp/sherlock-candidates.json
```

```bash
# Run Sherlock smoke test from shared scripts workspace.
# Set SHERLOCK_AGENTIC_FINALIZER_SCRIPT locally when testing outside VPS absolute paths.
SHERLOCK_AGENTIC_FINALIZER_SCRIPT="/Users/michaelhoughton/Documents/openclaw-experiment/openclaw-vps/.openclaw/workspace-sherlock/.agents/skills/sherlock-autonomy-orchestrator/scripts/finalize-agentic-cycle.mjs" npm run sherlock:smoke
```

## Environment Variables

Defined in:

- OpenClaw: `openclaw-vps/.openclaw/workspace-sherlock/.env` (or `.env.example` template)
- Wolf: `community-wolf/wolf-whatsapp-agents/.env.sherlock.example`

Sherlock scripts (`finalize-agentic-cycle`, `run-sherlock-cycle`, `wolf-submission`) load `workspace-sherlock/.env` and `.env.local` at startup, so vars there are used even when OpenClaw exec does not inject workspace env.

Core OpenClaw vars:

- `SHERLOCK_FOCUS_LOCATIONS`
- `SHERLOCK_GEOCODE_TIMEOUT_MS`
- `SHERLOCK_WOLF_INGEST_URL`
- `SHERLOCK_WOLF_INGEST_TOKEN`
- `SHERLOCK_WOLF_PRODUCT_TYPE`
- `SHERLOCK_WOLF_DISPATCH_ALERTS`
- `SHERLOCK_REPORTER_ID`
- `HERE_API_KEY`

Core Wolf var:

- `SHERLOCK_INGEST_TOKEN`

## Security Model

- OpenClaw -> Wolf ingest is protected by Bearer token.
- Endpoint rejects unauthenticated requests (`401`).
- Batch size is capped (`50`) to prevent oversized ingest payloads.

## Troubleshooting

1. **No incidents finalised**
   - Validate candidate JSON schema and required source fields.
   - Confirm summaries are substantive (not too short).
   - Confirm geocode fallback can resolve location labels.

2. **Ingest unauthorised**
   - Verify `SHERLOCK_WOLF_INGEST_TOKEN` (OpenClaw) matches `SHERLOCK_INGEST_TOKEN` (Wolf).

3. **`SHERLOCK_WOLF_INGEST_URL is missing`**
   - Ensure `SHERLOCK_WOLF_INGEST_URL` and `SHERLOCK_WOLF_INGEST_TOKEN` are in `workspace-sherlock/.env`.
   - Restart the OpenClaw gateway after editing `.env`.

4. **No DB writes**
   - Ensure not running with `--dry-run`.
   - Check finaliser output fields: `submission.accepted`, `submission.failed`.

## Non-regression Guarantee

Sherlock integration remains additive:

- no changes to existing WhatsApp webhook behaviour,
- no changes to human `submit_report` flow,
- machine ingest remains isolated behind the internal Sherlock endpoint.
