# HEARTBEAT.md - Wong (Mission Control Documentation Worker)

## Deterministic Worker Loop

1. Poll pending notifications for Wong:

```bash
# Pull queued mention notifications targeted at Wong.
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs notification_poll_for_assignee --assignee wong --status pending --limit 20 --json
```

2. Acknowledge each handled notification:

```bash
# Mark notification delivered once its requested action is addressed.
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs notification_mark_delivered --notification-id "<NOTIFICATION_ID>" --assignee wong --agent wong --json
```

```bash
# Mark notification failed if delivery/action cannot be completed now.
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs notification_mark_failed --notification-id "<NOTIFICATION_ID>" --assignee wong --agent wong --error "<REASON>" --json
```

3. Poll one READY task:

```bash
# Poll for the highest-priority READY task assigned to Wong.
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs task_poll_ready_for_assignee --assignee wong --limit 1 --json
```

4. If no tasks are returned, reply `HEARTBEAT_OK`.
5. If a task exists, claim it before doing any work:

```bash
# Atomically claim a task so no overlapping cron run duplicates execution.
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs task_claim --task-id "<TASK_OBJECT_ID>" --assignee wong --agent wong --json
```

6. Validate handoff context before execution:

```bash
# Inspect referenced handoff document when task depends on delegated context.
# Execute only if metadata.contextMode=full and metadata.delegationSafe=true.
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs document_get --document-id "<CONTEXT_DOCUMENT_ID>" --json
```

7. Execute documentation work:
   - Convert technical outcomes into clear, reusable docs.
   - Preserve intent, constraints, and decision rationale.
   - Keep sections explicit: context, procedure, verification, and follow-up.

8. Finish with Mongo-first output or blocked state:

```bash
# Create Mongo document artifact for text output.
CONTENT_MD="$(cat <<'EOF'
<MARKDOWN_DOCUMENTATION_DELIVERABLE>
EOF
)"
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs document_create --task-id "<TASK_OBJECT_ID>" --assignee wong --agent wong --title "<DELIVERABLE_TITLE>" --content-md "$CONTENT_MD" --source agent --json
```

```bash
# Submit output and move task to review (reference document id in link).
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs task_complete_with_output --task-id "<TASK_OBJECT_ID>" --assignee wong --agent wong --summary "<SUMMARY>" --link "mongo://documents/<DOCUMENT_ID>" --json
```

```bash
# If blocked, mark blocked with explicit reason.
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs task_mark_blocked --task-id "<TASK_OBJECT_ID>" --assignee wong --agent wong --reason "<BLOCKER_REASON>" --json
```

## Guardrails

- Never execute unclaimed tasks.
- Never silently drop a claimed task; always mark blocked or complete with output.
- For text deliverables, write to Mongo documents first and use `mongo://documents/<DOCUMENT_ID>` in output link.
- If delegated context is summary-only or incomplete, mark blocked with reason `insufficient_context` instead of inferring missing requirements.
