---
name: sherlock-autonomy-orchestrator
description: Orchestrate Sherlock in OpenClaw-native heartbeat mode with task-first execution, tool-driven source discovery, deterministic enrich/submit finalisation, Mission Control lifecycle updates, and resumable strategy state.
---

# Sherlock Autonomy Orchestrator

Run Sherlock as a task-first autonomous worker while keeping OpenClaw heartbeat and cron triggers intact.

## Core Commands

```bash
# Finalize tool-collected candidates (dedupe -> geocode fallback -> normalize -> Wolf ingest).
node /root/.openclaw/workspace-sherlock/.agents/skills/sherlock-autonomy-orchestrator/scripts/finalize-agentic-cycle.mjs --json --mode autonomous --query-family crime_watch --input-file /tmp/sherlock-candidates.json
```

## Contract Reference

- Load contracts and handoff shapes from:
  - `references/contracts.md`

## Guardrails

- Use `web_search` / `web_fetch` / `browser` for source discovery; do not execute legacy connector collection scripts for new runs.
- Use `sherlock-geocode-resolution` during discovery whenever candidates have missing coordinates or weak location labels.
- Claim tasks before execution in non-dry-run mode.
- Complete with output or mark blocked, never drop a claimed task silently.
- Keep state resumable via `memory/heartbeat-state.json`.
- Keep Wolf ingest additive (no direct WhatsApp flow modifications).
