---
name: sherlock-incident-enrichment
description: Enrich, deduplicate, geocode, normalise, and quality-gate incident candidates into Wolf ingest payloads. Use when Sherlock must convert raw source evidence into submission-ready incidents with traceability.
---

# Sherlock Incident Enrichment

Convert raw candidates into validated incidents with strict quality gates.

## Core Command

```bash
# Enrich one candidate file into normalized incidents.
node /root/.openclaw/workspace-sherlock/.agents/skills/sherlock-incident-enrichment/scripts/incident-enrichment.mjs --input-file /tmp/candidates.json --json
```

## Output Contract

- Load and follow the canonical schema in:
  - `../sherlock-autonomy-orchestrator/references/contracts.md`

## Guardrails

- Reject incidents without strong source identity and usable coordinates.
- Keep rejection reasons explicit for auditability.
- Emit cross-cycle fingerprints for duplicate resistance.
