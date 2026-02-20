# Mission Control Scripts

This folder contains the executable Mission Control workflow scripts used by OpenClaw agents.

## Setup

```bash
# Install runtime dependencies (MongoDB driver).
cd /root/.openclaw/workspace/scripts && npm install
```

## Core Commands

```bash
# Ensure query indexes exist for queue polling and status views.
npm run mission:indexes
```

```bash
# Show ready queues, blocked tasks, and review queue.
npm run mission:report
```

```bash
# Poll pending mention notifications for an assignee.
node ./mission-control-cli.mjs notification_poll_for_assignee --assignee corey --status pending --limit 20 --json
```

```bash
# Acknowledge one notification as delivered/failed.
node ./mission-control-cli.mjs notification_mark_delivered --notification-id "<NOTIFICATION_ID>" --assignee corey --agent corey --json
node ./mission-control-cli.mjs notification_mark_failed --notification-id "<NOTIFICATION_ID>" --assignee corey --agent corey --error "Agent session unavailable" --json
```

```bash
# Generate daily standup summary from task statuses.
npm run mission:standup
```

```bash
# Run an end-to-end local smoke test using an in-memory MongoDB instance.
npm run mission:smoke
```

```bash
# Run Sherlock pipeline smoke validation in dry-run mode (no Wolf DB writes).
npm run sherlock:smoke
```

```bash
# List all CLI actions and parameters.
node ./mission-control-cli.mjs help
```

## Notes

- **Path:** The CLI lives in `/root/.openclaw/workspace/scripts/`. Agent workspaces (`workspace-corey`, `workspace-tony`, etc.) have a `scripts` symlink pointing here, so `node scripts/mission-control-cli.mjs` from any workspace resolves correctly.
- Set `MISSION_CONTROL_MONGO_URI` in `/root/.openclaw/workspace/.env`.
- Optional overrides:
  - `MISSION_CONTROL_DB` (default: `mission-control`)
  - `MISSION_CONTROL_TASKS_COLLECTION` (default: `tasks`)
  - `MISSION_CONTROL_NOTIFICATIONS_COLLECTION` (default: `notifications`)
- Sherlock smoke can override the finalizer script path with `SHERLOCK_AGENTIC_FINALIZER_SCRIPT` if not running on VPS defaults.
