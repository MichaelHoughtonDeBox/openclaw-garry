---
name: sherlock-wolf-submission
description: Submit validated Sherlock incidents to the additive Wolf ingest endpoint and return deterministic submission outcomes. Use after incident enrichment and before checkpoint persistence.
---

# Sherlock Wolf Submission

Submit incident batches while preserving existing Wolf ingest compatibility.

## Core Command

```bash
# Submit incidents from a JSON file to Wolf ingest.
node /root/.openclaw/workspace-sherlock/.agents/skills/sherlock-wolf-submission/scripts/wolf-submission.mjs --input-file /tmp/incidents.json --json
```

## Output Contract

- Load and follow the canonical schema in:
  - `../sherlock-autonomy-orchestrator/references/contracts.md`

## Guardrails

- Keep additive ingest behavior unchanged.
- Surface submission errors without mutating payloads.
- Return deterministic counters for accepted/duplicate/failed.
