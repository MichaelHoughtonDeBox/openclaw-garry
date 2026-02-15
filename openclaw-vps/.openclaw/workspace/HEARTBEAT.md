# HEARTBEAT.md - Garry (Mission Control Orchestrator)

## On Every Heartbeat

1. Check pending Mission Control mentions first:

```bash
# Pull queued mention notifications targeted at Garry.
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs notification_poll_for_assignee --assignee garry --status pending --limit 20 --json
```

If notifications are actionable, complete the requested work and then acknowledge delivery:

```bash
# Mark one notification delivered after handling it.
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs notification_mark_delivered --notification-id "<NOTIFICATION_ID>" --assignee garry --agent garry --json
```

2. Run dependency release so WAITING tasks move to READY when unblocked:

```bash
# Release tasks whose dependencies are all done.
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs task_release_dependencies --agent garry --json
```

3. Check review queue for human approval candidates:

```bash
# Fetch tasks currently waiting for review.
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs task_review_queue --json
```

4. Pull a compact operational snapshot (ready, blocked, review):

```bash
# Build a mission snapshot for quick operator visibility.
node /root/.openclaw/workspace/scripts/mission-control-report.mjs --json
```

5. Behavior rules:
   - If any tasks were released, post a short orchestration update.
   - If review queue has tasks, summarize who needs review and what changed.
   - If neither applies, reply `HEARTBEAT_OK`.
   - Route research tasks and tasks requiring external context discovery to `ralph` by default.
   - For delegated tasks, ensure referenced context docs are delegation-safe (`contextMode=full`, `delegationSafe=true`) before assignment.

## Guardrails

- Do not claim specialist tasks from heartbeat unless explicitly instructed.
- Never bypass Mission Control by direct ad-hoc delegation when a task can be created instead.
- Never delegate execution from summary-only docs; publish a full handoff document first.
