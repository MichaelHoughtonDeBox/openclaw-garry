---
name: mongo-mission-control
version: 1.0.0
description: Use for Mission Control orchestration in MongoDB, including Mongo-first document artifacts and delegation-safe context handoff.
---

# Mongo Mission Control

Use this skill whenever work should flow through Mission Control instead of ad-hoc session messages.

## Preconditions

1. `MISSION_CONTROL_MONGO_URI` must be available in workspace `.env` (or passed with `--mongo-uri`).
2. Script dependencies must be installed once:

```bash
# Install MongoDB driver for mission control scripts.
cd /root/.openclaw/workspace/scripts && npm install
```

## Action Commands

```bash
# Create a task assigned to an agent.
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs task_create \
  --task-name "Investigate signup drop-off" \
  --description "Analyze funnel data and propose 3 fixes." \
  --assignee corey \
  --priority urgent
```

```bash
# Poll READY tasks for one assignee (sorted by priority + age).
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs task_poll_ready_for_assignee \
  --assignee corey \
  --limit 3
```

```bash
# Claim one task atomically (idempotent).
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs task_claim \
  --task-id "<TASK_OBJECT_ID>" \
  --assignee corey \
  --agent corey
```

```bash
# Append execution progress notes.
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs task_append_log \
  --task-id "<TASK_OBJECT_ID>" \
  --agent corey \
  --message "Gathered baseline analytics for onboarding steps."
```

```bash
# Create a Mongo-backed text artifact (default flow for drafts/research).
# Build markdown in-memory, then write directly to Mongo (no disk intermediate).
CONTENT_MD="$(cat <<'EOF'
<MARKDOWN_DELIVERABLE>
EOF
)"
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs document_create \
  --task-id "<TASK_OBJECT_ID>" \
  --assignee corey \
  --agent corey \
  --title "Onboarding funnel findings" \
  --content-md "$CONTENT_MD" \
  --source agent
```

```bash
# Create a delegation-safe handoff document with full context for another agent.
# Use this before creating a delegated task that depends on this context.
# Keep handoff content in-memory and persist directly to Mission Control.
HANDOFF_MD="$(cat <<'EOF'
<FULL_HANDOFF_MARKDOWN>
EOF
)"
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs document_create \
  --assignee corey \
  --agent garry \
  --title "FULL HANDOFF: LinkedIn scanner sock campaign brief" \
  --content-md "$HANDOFF_MD" \
  --source operator \
  --context-mode full \
  --delegation-safe true
```

```bash
# Inspect a document before delegating or executing work from it.
# Confirm metadata.contextMode=full and metadata.delegationSafe=true for execution handoff.
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs document_get \
  --document-id "<DOCUMENT_ID>" \
  --json
```

```bash
# Submit output and send task to review (default final-status=review).
# Use mongo://documents/<DOCUMENT_ID> for text artifacts stored in Mongo.
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs task_complete_with_output \
  --task-id "<TASK_OBJECT_ID>" \
  --assignee corey \
  --agent corey \
  --summary "Found 2 high-impact fixes with projected +8% conversion uplift." \
  --link "mongo://documents/<DOCUMENT_ID>"
```

```bash
# Mark blocked and move trigger_state to RETRY.
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs task_mark_blocked \
  --task-id "<TASK_OBJECT_ID>" \
  --assignee corey \
  --agent corey \
  --reason "Need product event schema confirmation before proceeding."
```

```bash
# Approve a review task and move it to done (Garry/Michael action).
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs task_transition_status \
  --task-id "<TASK_OBJECT_ID>" \
  --to-status done \
  --agent garry \
  --note "Reviewed and approved by Garry."
```

```bash
# Release dependency-gated tasks once all prerequisite tasks are done.
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs task_release_dependencies \
  --agent garry
```

## Operating Rules

- Always claim before doing work.
- Never mutate task status directly in Mongo shell; use commands above so transition rules stay consistent.
- If no work is available, continue normal heartbeat behavior and return `HEARTBEAT_OK`.
- Text deliverables are Mongo-first: create them with `document_create` and link to tasks (auto-linked with `--task-id`).
- Disk paths in `output_data.link` are only for non-text binaries/external URLs when Mongo storage is not suitable.
- Do not stage text deliverables in `memory/*.md` for reporting/handoff. Use `--content-md` directly. `--content-file` is legacy and requires explicit override.
- For delegated execution, the source document must be `contextMode=full` and `delegationSafe=true`.
- `contextMode=summary` documents are for operator visibility only and must not be used as sole execution context.
- Handoff docs must include all required context in `contentMd`: objective, source facts, constraints, acceptance criteria, and explicit deliverable expectations.
