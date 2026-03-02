---
name: sherlock-xdk-main-flow
overview: Integrate the TypeScript XDK into Sherlock’s main tool-driven heartbeat flow so X can be queried directly for incident discovery, while preserving existing candidate contracts and deterministic finalization.
todos:
  - id: design-xdk-runtime-boundary
    content: Choose dependency/module boundary for @xdevplatform/xdk so Sherlock scripts can import it reliably on VPS.
    status: completed
  - id: build-xdk-candidate-collector
    content: Implement XDK-backed candidate collection that emits existing Sherlock candidate schema.
    status: completed
  - id: wire-heartbeat-main-flow
    content: Update HEARTBEAT instructions to call the new X step in normal tool-driven discovery.
    status: completed
  - id: config-and-state
    content: Add/align env vars and checkpoint persistence for X query continuity.
    status: completed
  - id: validate-end-to-end
    content: Run dry-run and live validation to confirm candidate quality, dedupe, and ingest stability.
    status: completed
isProject: false
---

# Sherlock XDK Main-Flow Integration Plan

## Objective

Replace ad-hoc/no-X in the main heartbeat discovery path with a first-class XDK-backed collection step, so Sherlock can reliably pull incident candidates from X in normal task-first runs.

## Scope Decisions

- Use X in the **main heartbeat tool-driven flow** (selected).
- Keep finalization unchanged (`finalize-agentic-cycle.mjs` remains dedupe/normalize/submit authority).
- Start with **app-only bearer** auth for incident search; design config so OAuth user-context can be added later without refactor.

## Implementation Steps

- Add an XDK-backed helper module/script in Sherlock workspace that outputs candidate objects matching existing contract (`sourcePlatform`, `sourceId`, `sourceUrl`, `summary`, `rawText`, coords/locationLabel, timing).
- Wire heartbeat instructions to explicitly permit and require this X step during discovery (instead of legacy connector scripts).
- Update runtime config docs/env examples for new XDK settings (query, max results, timeout, lookback/since checkpoint behavior).
- Add lightweight strategy-state persistence for X polling cursor in existing heartbeat state structure to prevent repeated pulls.
- Preserve current incident-style prompting rules and outcome-only exclusions by applying the same summary policy to X-derived candidates.

## Files To Change

- Main behavioral instructions: [/Users/michaelhoughton/Documents/openclaw-experiment/openclaw-vps/.openclaw/workspace-sherlock/HEARTBEAT.md](/Users/michaelhoughton/Documents/openclaw-experiment/openclaw-vps/.openclaw/workspace-sherlock/HEARTBEAT.md)
- New XDK collector script(s): [/Users/michaelhoughton/Documents/openclaw-experiment/openclaw-vps/.openclaw/workspace-sherlock/.agents/skills/sherlock-incident-discovery/scripts/connectors/x-api/index.mjs](/Users/michaelhoughton/Documents/openclaw-experiment/openclaw-vps/.openclaw/workspace-sherlock/.agents/skills/sherlock-incident-discovery/scripts/connectors/x-api/index.mjs) (or new agentic X script alongside it)
- Candidate/finalization contract references: [/Users/michaelhoughton/Documents/openclaw-experiment/openclaw-vps/.openclaw/workspace-sherlock/.agents/skills/sherlock-autonomy-orchestrator/references/contracts.md](/Users/michaelhoughton/Documents/openclaw-experiment/openclaw-vps/.openclaw/workspace-sherlock/.agents/skills/sherlock-autonomy-orchestrator/references/contracts.md)
- Environment/config source: [/Users/michaelhoughton/Documents/openclaw-experiment/openclaw-vps/.openclaw/workspace-sherlock/.env](/Users/michaelhoughton/Documents/openclaw-experiment/openclaw-vps/.openclaw/workspace-sherlock/.env) and [/Users/michaelhoughton/Documents/openclaw-experiment/openclaw-vps/.openclaw/workspace/.env.example](/Users/michaelhoughton/Documents/openclaw-experiment/openclaw-vps/.openclaw/workspace/.env.example)
- Dependency root for install workflow: [/Users/michaelhoughton/Documents/openclaw-experiment/openclaw-vps/.openclaw/workspace/scripts/package.json](/Users/michaelhoughton/Documents/openclaw-experiment/openclaw-vps/.openclaw/workspace/scripts/package.json) (or a dedicated Sherlock package boundary, depending on module resolution choice)

## Verification Plan

- Run one dry-run heartbeat cycle and confirm logs show XDK query execution and candidate generation.
- Validate candidate payloads conform to current finalizer contract and include required source identity fields.
- Confirm repeated runs do not duplicate pulls due to cursor/checkpoint progression.
- Run one non-dry cycle and confirm ingest counters and dedupe behavior remain stable.

## Rollout Notes

- Deploy to VPS, run a constrained first cycle (low limit), and inspect candidate quality before widening query limits.
- Keep legacy connector code path intact during transition for rollback safety.

