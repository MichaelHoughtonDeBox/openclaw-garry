# HEARTBEAT.md - Sherlock (Tool-Driven Autonomy Worker)

## On Every Heartbeat

Run Sherlock in a task-first, tool-driven flow. Do **not** use connector scripts for discovery.

### 1a) Check for stale in_progress tasks

```bash
# Poll for tasks Sherlock claimed but left unfinished (fire-and-forget amnesia fix).
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs task_poll_stale_in_progress_for_assignee --assignee sherlock --stale-minutes 60 --limit 1 --json
```

If any tasks are returned, resume that task. Do not poll READY or run autonomous discovery until it is completed or blocked. Append a log "Resuming stalled task", then continue from step 2 (build run intent) with the stalled task as context.

### 1) Poll and claim Mission Control work

```bash
# Poll one READY task for Sherlock.
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs task_poll_ready_for_assignee --assignee sherlock --limit 1 --json
```

- If a task is available, claim it before execution.
- If no task is available, run autonomous discovery using the default focus list in `SHERLOCK_FOCUS_LOCATIONS`.

### 2) Build run intent

- Directed mode:
  - Use task brief as the primary objective.
  - Parse lead URLs/focus hints via:

```bash
# Parse directed task briefing into deterministic hints.
node /root/.openclaw/workspace-sherlock/.agents/skills/sherlock-task-intake/scripts/task-intake.mjs --task-id "<TASK_ID>" --task-name "<TASK_NAME>" --task-description "<TASK_DESCRIPTION>" --focus-locations "${SHERLOCK_FOCUS_LOCATIONS:-}" --default-min-incidents 3 --default-max-passes 2 --json
```

- Autonomous mode:
  - Choose a focus city from `SHERLOCK_FOCUS_LOCATIONS`.
  - Pick a query family aligned to recent safety signals (e.g. `crime_watch`, `traffic_risk`, `protest_disruption`).

### 3) Discover incidents with tools (agentic step)

Use available tools directly:

- `web_search` for discovery and lead expansion.
- `web_fetch` to retrieve full source pages.
- `browser` only for dynamic pages that cannot be fetched statically.
- `sherlock-geocode-resolution` to resolve missing coordinates or place labels.

Do not run:

- `sherlock-incident-discovery/scripts/run-sherlock-cycle.mjs`
- `sherlock-source-collection/scripts/source-collection.mjs`
- direct X/Perplexity connector scripts

Create a candidate payload at `/tmp/sherlock-candidates-<timestamp>.json` with this schema:

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
      "author": "Publisher or account name",
      "postedAt": "2026-02-16T10:30:00.000Z",
      "summary": "Clear incident summary with enough context for moderation.",
      "rawText": "Source excerpt or extracted evidence text.",
      "latitude": -26.2041,
      "longitude": 28.0473,
      "locationLabel": "Johannesburg, South Africa",
      "connector": "agentic-tools",
      "keywords": ["robbery", "armed"],
      "severity": 3
    }
  ]
}
```

If candidates are missing lat/lon or location labels, run geocode resolution before finalisation:

- **Forward geocode:** address text -> lat/lon.
- **Reverse geocode:** lat/lon -> canonical location label.

### 4) Deterministic enrichment + Wolf submission

```bash
# Finalize tool-collected candidates via deterministic enrichment and ingest submission.
node /root/.openclaw/workspace-sherlock/.agents/skills/sherlock-autonomy-orchestrator/scripts/finalize-agentic-cycle.mjs --json --mode "<autonomous|directed>" --task-id "<TASK_ID_OR_EMPTY>" --query-family "<QUERY_FAMILY>" --input-file "/tmp/sherlock-candidates-<timestamp>.json"
```

- This command performs dedupe, geocode fallback, normalisation, Wolf submission, and heartbeat state updates.
- Use `--dry-run` when validating flow only.

### 5) Close task lifecycle when claimed

- Append progress logs during execution.
- Create Mongo document with evidence summary and finalisation JSON.
- Complete with output link when successful.
- If blocked, call `task_mark_blocked` with explicit blocker.

If no task exists and no credible candidates are found, reply `HEARTBEAT_OK`.

## Guardrails

- Never fabricate sources, URLs, coordinates, or timestamps.
- Preserve source IDs and links exactly as collected.
- Keep writes additive through Wolf internal ingest only.
- Keep resumable state in `memory/heartbeat-state.json`.
