# Mission Control Implementation Review

Date: 2026-02-14

Scope reviewed:
- `openclaw-brain/mission-control-article.md`
- `openclaw-brain/mission-control-ui`
- `openclaw-vps/.openclaw`

Overall verdict:
- Current implementation is a solid Mission Control MVP for deterministic task orchestration and artifact tracking.
- It is not yet equivalent to the full architecture described in the article (shared conversation layer, notifications, and full 10-agent operation).

## Findings (Ordered by Severity)

### 1) Missing notification and mention delivery system (High)
- **Article expectation:** `@mentions`, `@all`, queued notifications, and delivery daemon behavior are core collaboration primitives.
- **Current state:** No `notifications` data model, no mention parsing, no notification queue, no delivery worker.
- **Evidence:** `openclaw-brain/mission-control-ui/lib/mission/types.ts`, `openclaw-brain/mission-control-ui/lib/mission/repository.ts`, `openclaw-vps/.openclaw/workspace/scripts/mission-control-cli.mjs`.
- **Impact:** Agents cannot be explicitly paged through Mission Control threads; collaboration is passive polling only.

### 2) No thread/message layer; collaboration is task logs only (High)
- **Article expectation:** Dedicated message/thread model (`messages` table) with task comments, attachment references, and agent-to-agent discussion context.
- **Current state:** Communication is stored as `agent_logs` embedded in tasks plus generic `activities`; no first-class threaded comment system.
- **Evidence:** `openclaw-brain/mission-control-ui/lib/mission/types.ts`, `openclaw-brain/mission-control-ui/lib/mission/repository.ts`, `openclaw-brain/mission-control-ui/components/mission/task-detail-sheet.tsx`.
- **Impact:** Weak conversational continuity and no subscription-style thread updates.

### 3) Core schema diverges materially from article model (High)
- **Article expectation:** Six-table model (`agents`, `tasks`, `messages`, `activities`, `documents`, `notifications`) with multi-assignee tasking and article lifecycle.
- **Current state:** Three Mongo collections (`tasks`, `activities`, `documents`) and single-assignee tasks. No separate `agents/messages/notifications` persistence in Mission Control DB.
- **Evidence:** `openclaw-brain/mission-control-ui/README.md`, `openclaw-brain/mission-control-ui/lib/mongodb.ts`, `openclaw-brain/mission-control-ui/lib/mission/types.ts`.
- **Impact:** The implemented system is operationally simpler, but lacks several coordination capabilities described in the article.

### 4) Real-time behavior is polling, not push-driven collaboration (Medium)
- **Article expectation:** Real-time shared state (Convex-style instant propagation) and daemon-style event delivery.
- **Current state:** Dashboard and workers are polling-based (`setInterval` in UI, cron polls in VPS scripts). No websocket/event bus for Mission Control updates.
- **Evidence:** `openclaw-brain/mission-control-ui/components/mission/dashboard.tsx`, `openclaw-vps/.openclaw/workspace/scripts/mission-control-cli.mjs`, `openclaw-vps/.openclaw/cron/jobs.json`.
- **Impact:** Higher latency, bursty update cadence, and weaker "live office" feel.

### 5) 10-agent design is mostly configured but not actively running (Medium)
- **Article expectation:** Ten specialized agents running in staggered heartbeat cycles.
- **Current state:** `agents.json` includes full roster, but only `garry`, `corey`, and `tony` are active; cron only schedules these three.
- **Evidence:** `openclaw-vps/.openclaw/workspace/mission-control/agents.json`, `openclaw-vps/.openclaw/cron/jobs.json`.
- **Impact:** Team scale in production behavior does not yet match article narrative.

### 6) Daily standup exists as a script but is not scheduled end-to-end (Medium)
- **Article expectation:** Daily scheduled standup delivery to operator channel.
- **Current state:** Standup generator exists (`mission-control-standup.mjs`), but no standup cron job is present in `cron/jobs.json`; no delivery route integration shown.
- **Evidence:** `openclaw-vps/.openclaw/workspace/scripts/mission-control-standup.mjs`, `openclaw-vps/.openclaw/workspace/scripts/package.json`, `openclaw-vps/.openclaw/cron/jobs.json`.
- **Impact:** Standup is manual/on-demand rather than automated daily accountability.

### 7) UI still constrained to 3-agent operations in key surfaces (Medium)
- **Article expectation:** Broad multi-agent visibility and assignment UX for full roster.
- **Current state:** Agent health and document filter defaults are constrained by `ACTIVE_DEFAULT_ASSIGNEES`; task composer assignee picker only exposes `garry/corey/tony`.
- **Evidence:** `openclaw-brain/mission-control-ui/lib/mission/constants.ts`, `openclaw-brain/mission-control-ui/lib/mission/repository.ts`, `openclaw-brain/mission-control-ui/components/mission/task-composer-dialog.tsx`, `openclaw-brain/mission-control-ui/components/mission/document-list-panel.tsx`.
- **Impact:** UI prevents normal operation of the larger configured roster.

### 8) Task lifecycle vocabulary differs from article lifecycle (Low/Design Divergence)
- **Article expectation:** `inbox -> assigned -> in_progress -> review -> done` (plus blocked in narrative examples).
- **Current state:** `todo -> in_progress -> blocked -> review -> done` with dependency `trigger_state`.
- **Evidence:** `openclaw-brain/mission-control-ui/lib/mission/constants.ts`, `openclaw-vps/.openclaw/workspace/mission-control/transitions.json`, `openclaw-vps/.openclaw/workspace/mission-control/schema.task.json`.
- **Impact:** Not a bug, but direct article parity is reduced and onboarding docs can drift from runtime behavior.

## What Is Implemented Well (Strong Alignment)

- Deterministic worker loop with claim idempotency and dependency release orchestration.
  - Evidence: `openclaw-vps/.openclaw/workspace-corey/HEARTBEAT.md`, `openclaw-vps/.openclaw/workspace-tony/HEARTBEAT.md`, `openclaw-vps/.openclaw/workspace/HEARTBEAT.md`, `openclaw-vps/.openclaw/workspace/scripts/mission-control-cli.mjs`.
- Shared task and document persistence with audit logs and review flow.
  - Evidence: `openclaw-brain/mission-control-ui/lib/mission/repository.ts`, `openclaw-vps/.openclaw/workspace/scripts/mission-control-smoke.mjs`.
- Practical operator UX for task creation, review, and artifact inspection.
  - Evidence: `openclaw-brain/mission-control-ui/components/mission/dashboard.tsx`, `openclaw-brain/mission-control-ui/components/mission/task-detail-sheet.tsx`, `openclaw-brain/mission-control-ui/components/mission/document-detail-sheet.tsx`.

## Recommended Next Moves (To Reach Article Parity)

1. Add first-class `messages` + `notifications` collections and mention parser (`@agent`, `@all`).
2. Implement notification delivery worker with retry semantics to sleeping agents.
3. Add thread subscription semantics (auto-subscribe on assign/comment/mention).
4. Expand UI and health surfaces to full active roster (not just default trio).
5. Add daily standup cron job and channel delivery integration.
6. Decide and document lifecycle contract (`todo` vs `inbox/assigned`) to keep article/runtime aligned.

## Bottom Line

Mission Control today is a robust orchestration core (queue, claim, execute, review, artifact). The article describes a richer collaboration layer on top of that core. The largest parity gaps are notifications, threaded communication, and full 10-agent operational activation.
