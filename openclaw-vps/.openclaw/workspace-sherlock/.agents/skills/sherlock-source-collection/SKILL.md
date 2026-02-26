---
name: sherlock-source-collection
description: Legacy connector-based source collection for Sherlock (X API + web connectors). Keep for backwards compatibility and controlled diagnostics only.
---

# Sherlock Source Collection

Collect candidates via connector scripts for legacy compatibility scenarios.

## Core Command

```bash
# Run one collection pass with JSON output for orchestrator pipelines.
node /root/.openclaw/workspace-sherlock/.agents/skills/sherlock-source-collection/scripts/source-collection.mjs --json
```

## Output Contract

- Load and follow the canonical schema in:
  - `../sherlock-autonomy-orchestrator/references/contracts.md`

## Guardrails

- Prefer tool-driven discovery (`web_search` / `web_fetch` / `browser`) in standard heartbeat runs.
- Return connector checkpoints for resumable polling.
- Keep connector failures isolated (partial success is valid).
- Keep query-family metadata for post-run strategy updates.
