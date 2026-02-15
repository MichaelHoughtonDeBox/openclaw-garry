---
name: mongo-mission-control
version: 1.0.0
description: Use for Mission Control task polling/execution through MongoDB with Mongo-first artifact output and strict handoff validation.
---

# Mongo Mission Control

You are a Mission Control worker. Use this skill during heartbeat or cron turns when checking assigned tasks.

## Preconditions

```bash
# Install dependencies once on the VPS (run from Garry/main workspace).
cd /root/.openclaw/workspace/scripts && npm install
```

## Core Worker Loop

```bash
# 1) Poll READY tasks assigned to Tony.
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs task_poll_ready_for_assignee \
  --assignee tony \
  --limit 1
```

```bash
# 2) Claim the selected task before execution (atomic lock).
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs task_claim \
  --task-id "<TASK_OBJECT_ID>" \
  --assignee tony \
  --agent tony
```

```bash
# 3) Log progress while working.
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs task_append_log \
  --task-id "<TASK_OBJECT_ID>" \
  --agent tony \
  --message "Progress note goes here."
```

```bash
# 4) Preflight delegated context before execution.
# If task depends on a handoff doc, verify metadata.contextMode=full and metadata.delegationSafe=true.
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs document_get \
  --document-id "<CONTEXT_DOCUMENT_ID>" \
  --json
```

```bash
# 5) Create Mongo document artifact for your text output.
# Keep deliverable markdown in-memory and write directly to Mongo.
CONTENT_MD="$(cat <<'EOF'
<MARKDOWN_DELIVERABLE>
EOF
)"
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs document_create \
  --task-id "<TASK_OBJECT_ID>" \
  --assignee tony \
  --agent tony \
  --title "Tony deliverable title" \
  --content-md "$CONTENT_MD" \
  --source agent
```

```bash
# 6) Submit completion output (moves to review by default).
# Reference Mongo artifacts with mongo://documents/<DOCUMENT_ID>.
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs task_complete_with_output \
  --task-id "<TASK_OBJECT_ID>" \
  --assignee tony \
  --agent tony \
  --summary "Deliverable summary." \
  --link "mongo://documents/<DOCUMENT_ID>"
```

```bash
# 7) If blocked, mark blocked with explicit reason.
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs task_mark_blocked \
  --task-id "<TASK_OBJECT_ID>" \
  --assignee tony \
  --agent tony \
  --reason "Concrete blocker requiring external input."
```

## Worker Rules

- If poll returns no tasks, reply `HEARTBEAT_OK`.
- Never run `task_release_dependencies` as Tony unless explicitly asked.
- Every completion must include a meaningful summary and a Mongo document reference for text artifacts.
- Never stage report/handoff text in `memory/*.md` first; use `document_create --content-md` directly.
- `--content-file` is legacy-only and requires explicit override.
- Keep filesystem links only for non-text binaries or external URLs that cannot be stored as markdown content.
- Do not execute delegated tasks from summary-only docs. If context is incomplete, mark blocked with reason `insufficient_context` and request a full handoff document.
