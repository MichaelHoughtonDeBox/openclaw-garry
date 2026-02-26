---
name: mongo-mission-control
version: 1.0.0
description: Use for Mission Control task polling/execution through MongoDB with Mongo-first artifact output and strict task lifecycle handling.
---

# Mongo Mission Control

You are a Mission Control worker. Use this skill during heartbeat or cron turns when checking assigned tasks.

## Preconditions

```bash
# Install dependencies once on the VPS (run from Garry/main workspace).
cd /root/.openclaw/workspace/scripts && npm install
```

**Path:** Always use `/root/.openclaw/workspace/scripts/mission-control-cli.mjs` (or `scripts/mission-control-cli.mjs` — workspace symlink resolves it). Do NOT use `${workspace}/scripts` or agent-specific paths; the script lives only in `workspace/scripts`.

## Core Worker Loop

```bash
# 1) Poll READY tasks assigned to Sherlock.
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs task_poll_ready_for_assignee \
  --assignee sherlock \
  --limit 1
```

```bash
# 2) Claim the selected task before execution (atomic lock).
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs task_claim \
  --task-id "<TASK_OBJECT_ID>" \
  --assignee sherlock \
  --agent sherlock
```

```bash
# 3) Log progress while working.
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs task_append_log \
  --task-id "<TASK_OBJECT_ID>" \
  --agent sherlock \
  --message "Progress note goes here."
```

```bash
# 4) Create Mongo document artifact for your text output.
# Keep deliverable markdown in-memory and write directly to Mongo.
CONTENT_MD="$(cat <<'EOF'
<MARKDOWN_DELIVERABLE>
EOF
)"
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs document_create \
  --task-id "<TASK_OBJECT_ID>" \
  --assignee sherlock \
  --agent sherlock \
  --title "Sherlock deliverable title" \
  --content-md "$CONTENT_MD" \
  --source agent
```

```bash
# 5) Submit completion output (moves to review by default).
# Reference Mongo artifacts with mongo://documents/<DOCUMENT_ID>.
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs task_complete_with_output \
  --task-id "<TASK_OBJECT_ID>" \
  --assignee sherlock \
  --agent sherlock \
  --summary "Deliverable summary." \
  --link "mongo://documents/<DOCUMENT_ID>"
```

```bash
# 6) If blocked, mark blocked with explicit reason.
node /root/.openclaw/workspace/scripts/mission-control-cli.mjs task_mark_blocked \
  --task-id "<TASK_OBJECT_ID>" \
  --assignee sherlock \
  --agent sherlock \
  --reason "Concrete blocker requiring external input."
```

## Worker Rules

- If poll returns no tasks, reply `HEARTBEAT_OK`.
- Never silently drop a claimed task; always mark blocked or complete with output.
- Every completion must include a meaningful summary and a Mongo document reference for text artifacts.
- Never stage report/handoff text in `memory/*.md` first; use `document_create --content-md` directly.
