# HEARTBEAT.md - Corey (Mission Control Worker)

## Deterministic Worker Loop

1. Poll pending notifications for Corey:

```bash
# Pull queued mention notifications targeted at Corey.
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs notification_poll_for_assignee --assignee corey --status pending --limit 20 --json
```

2. Acknowledge each handled notification:

```bash
# Mark notification delivered once its requested action is addressed.
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs notification_mark_delivered --notification-id "<NOTIFICATION_ID>" --assignee corey --agent corey --json
```

```bash
# Mark notification failed if delivery/action cannot be completed now.
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs notification_mark_failed --notification-id "<NOTIFICATION_ID>" --assignee corey --agent corey --error "<REASON>" --json
```

2.5. Check for stale in_progress tasks (assigned to me, no update in >1 hour):

```bash
# Poll for tasks I claimed but left unfinished (fire-and-forget amnesia fix).
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs task_poll_stale_in_progress_for_assignee --assignee corey --stale-minutes 60 --limit 1 --json
```

If any tasks are returned, treat them as stalled. Resume that work immediately: append a log "Resuming stalled task", then validate handoff (step 6), execute (step 7), and finish (step 8). Do not poll for new READY tasks until the stalled task is completed or blocked.

3. Poll one READY task:

```bash
# Poll for the highest-priority READY task assigned to Corey.
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs task_poll_ready_for_assignee --assignee corey --limit 1 --json
```

4. If no stale tasks and no READY tasks returned, reply `HEARTBEAT_OK`.
5. If a task exists, claim it before doing any work:

```bash
# Atomically claim a task so no overlapping cron run duplicates execution.
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs task_claim --task-id "<TASK_OBJECT_ID>" --assignee corey --agent corey --json
```

6. Validate handoff context before execution:

```bash
# Inspect referenced handoff document when task depends on delegated context.
# Execute only if metadata.contextMode=full and metadata.delegationSafe=true.
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs document_get --document-id "<CONTEXT_DOCUMENT_ID>" --json
```

7. Execute work and log meaningful progress:

```bash
# Append a milestone update while executing.
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs task_append_log --task-id "<TASK_OBJECT_ID>" --agent corey --message "Completed milestone update." --json
```

8. Finish with Mongo-first output or blocked state:

```bash
# Create Mongo document artifact for text output.
CONTENT_MD="$(cat <<'EOF'
<MARKDOWN_DELIVERABLE>
EOF
)"
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs document_create --task-id "<TASK_OBJECT_ID>" --assignee corey --agent corey --title "<DELIVERABLE_TITLE>" --content-md "$CONTENT_MD" --source agent --json
```

```bash
# Submit output and move task to review (reference document id in link).
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs task_complete_with_output --task-id "<TASK_OBJECT_ID>" --assignee corey --agent corey --summary "<SUMMARY>" --link "mongo://documents/<DOCUMENT_ID>" --json
```

```bash
# If blocked, mark blocked with explicit reason.
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs task_mark_blocked --task-id "<TASK_OBJECT_ID>" --assignee corey --agent corey --reason "<BLOCKER_REASON>" --json
```

## Guardrails

- Never execute unclaimed tasks.
- Never silently drop a claimed task; always mark blocked or complete with output.
- For text deliverables, write to Mongo documents first and use `mongo://documents/<DOCUMENT_ID>` in output link.
- Do not write report/handoff drafts to `memory/*.md` first; keep content in-memory and submit via `--content-md`.
- If delegated context is summary-only or incomplete, mark blocked with reason `insufficient_context` instead of inferring missing requirements.
