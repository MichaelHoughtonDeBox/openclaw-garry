---
name: sherlock-task-intake
description: Parse Mission Control task briefs into structured directed-investigation plans, including lead URL extraction, hypothesis query derivation, and run configuration for Sherlock cycles. Use when Sherlock receives assigned tasks or manual lead text.
---

# Sherlock Task Intake

Convert task text into deterministic task-execution inputs for Sherlock.

## Core Command

```bash
# Parse a directed brief and return a machine-readable intake plan.
node /root/.openclaw/workspace-sherlock/.agents/skills/sherlock-task-intake/scripts/task-intake.mjs --task-name "Investigate lead" --task-description "Investigate https://example.com and focus on London." --json
```

## Output Contract

- Load and follow the canonical schema in:
  - `../sherlock-autonomy-orchestrator/references/contracts.md`

## Guardrails

- Preserve source lead URLs exactly as provided.
- Do not fabricate lead evidence.
- Keep generated queries focused and auditable.
