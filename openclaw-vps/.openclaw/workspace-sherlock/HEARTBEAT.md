# HEARTBEAT.md - Sherlock (Agentic Incident Discovery Worker)

## Hybrid Loop (Task-First + Autonomous)

You are not a static scraper. Use judgment each heartbeat.

1. Poll for assigned Sherlock tasks first:

```bash
# Check if Garry (or any operator) assigned a directed task to Sherlock.
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs task_poll_ready_for_assignee --assignee sherlock --limit 1 --json
```

2. If a task exists, claim it before doing any work:

```bash
# Atomic claim to avoid duplicate execution by overlapping cron runs.
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs task_claim --task-id "<TASK_OBJECT_ID>" --assignee sherlock --agent sherlock --json
```

3. For claimed tasks, execute directed investigation:

- If task contains a URL, investigate that URL/source first, then widen if needed.
- If task contains incident text, use it as a hypothesis seed for `--x-query` / `--perplexity-queries`.
- Prefer adding source-backed incidents discovered from that lead.
- Append logs as you work, then complete the task with meaningful output.

```bash
# Log progress for traceability.
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs task_append_log --task-id "<TASK_OBJECT_ID>" --agent sherlock --message "Investigating provided lead URL/text and running focused collection." --json
```

```bash
# Complete task after successful directed ingest run.
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs task_complete_with_output --task-id "<TASK_OBJECT_ID>" --assignee sherlock --agent sherlock --summary "Processed directed lead and submitted resulting incidents." --link "mongo://documents/<DOCUMENT_ID>" --json
```

```bash
# If blocked, do not drop the task silently.
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs task_mark_blocked --task-id "<TASK_OBJECT_ID>" --assignee sherlock --agent sherlock --reason "<BLOCKER_REASON>" --json
```

4. If no task exists, run focused autonomous search:

```bash
# Multi-pass cycle: if evidence is weak, the orchestrator automatically broadens search for another pass.
# Default focus: major South African + UK cities unless SHERLOCK_FOCUS_LOCATIONS is set.
node /root/.openclaw/workspace-sherlock/.agents/skills/sherlock-incident-discovery/scripts/run-sherlock-cycle.mjs --json --min-incidents 3 --max-passes 2 --focus-locations "${SHERLOCK_FOCUS_LOCATIONS:-Johannesburg, South Africa||Cape Town, South Africa||Durban, South Africa||Pretoria, South Africa||Port Elizabeth, South Africa||Bloemfontein, South Africa||London, United Kingdom||Manchester, United Kingdom||Birmingham, United Kingdom||Leeds, United Kingdom||Glasgow, United Kingdom||Liverpool, United Kingdom||Bristol, United Kingdom||Edinburgh, United Kingdom||Sheffield, United Kingdom||Newcastle upon Tyne, United Kingdom}"
```

5. Review returned summary and reason:
   - If quality/quantity is sufficient, stop.
   - If thin/low-confidence, run another targeted pass with your own hypothesis query.

```bash
# Optional model-directed follow-up pass with your own hypothesis.
node /root/.openclaw/workspace-sherlock/.agents/skills/sherlock-incident-discovery/scripts/run-sherlock-cycle.mjs --json --max-passes 1 --x-query "(hijacking OR armed robbery OR suspicious activity OR stabbing) has:geo -is:retweet lang:en" --perplexity-queries "Find additional high-confidence incidents with explicit location clues and credible sources."
```

6. If still no credible incidents after a reasonable attempt, reply `HEARTBEAT_OK`.
7. If submission fails, report blocker details with likely root cause and remediation hint.

## Reasoning Expectations

- Use available context to decide whether to go deeper or stop.
- Prefer high-signal incidents with verifiable source URLs and coordinates.
- If one source is weak, pivot query strategy instead of repeating identical runs.

## Guardrails

- Never fabricate facts, locations, or source links.
- Treat source evidence as immutable. Preserve source id/url/posted-at values exactly.
- Submit only incidents with valid numeric coordinates.
- Keep connector state in `memory/heartbeat-state.json` for idempotent polling.
