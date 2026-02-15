# Mission Control Architecture Proposal

## 1. Overview
A decoupled, polling-based agent coordination system. Instead of the main agent (Garry) pushing tasks to sub-agents (Corey, Tony) and waiting, tasks are stored in a centralized database (MongoDB). Sub-agents poll this database via cron jobs to find work assigned to them.

## 2. Infrastructure: MongoDB
- **Benefits:** High performance, flexible schema for evolving task requirements, and easy to build a custom Mission Control UI on top.
- **Connection:** Managed via a dedicated OpenClaw skill (`mongo-mission-control`).

## 3. Canonical Contracts (Locked)
Mission Control contracts are now versioned in `workspace/mission-control/`:

- `schema.task.json` - canonical task schema and enum constraints
- `agents.json` - assignee-to-agent/session mapping (3 active, 10-agent ready)
- `transitions.json` - strict status transition + trigger rules

### Task enums (authoritative)
- `status`: `todo | in_progress | blocked | review | done`
- `priority`: `urgent | normal | low`
- `trigger_state`: `READY | WAITING | RETRY`

### Transition policy (authoritative)
- `todo -> in_progress|blocked`
- `in_progress -> review|blocked|todo`
- `review -> done|in_progress|blocked`
- `blocked -> todo|in_progress`
- `done` is terminal

### Claim guard (idempotency)
Agents may claim only when all are true:
1. `status = todo`
2. `trigger_state = READY`
3. `assignee` matches the polling agent

## 4. Agent Workflow (The "Pull" Model)
1. **Intake:** Michael tells Garry an idea. Garry writes tasks to MongoDB.
2. **Polling:** Sub-agents (Corey/Tony) run a cron-triggered script:
   - Query: `{ assignee: "corey", trigger_state: "READY", status: "todo" }`
3. **Execution:** Agent performs the task, updates MongoDB with logs and output.
4. **Completion:** Agent sets status to "done" and updates `updated_at`.
5. **Orchestration:** Garry's heartbeat periodically checks for tasks where all dependencies are "done" and moves the dependent task's `trigger_state` to "READY".

## 5. Delivery Roadmap
- [x] Lock schema + mapping + transition contracts in `workspace/mission-control/`.
- [ ] Install MongoDB on the VPS (or connect to a remote cluster).
- [ ] Create and wire the `mongo-mission-control` skill actions.
- [ ] Add isolated cron polling jobs for Corey/Tony + dependency release by Garry.
- [ ] Add mission visibility scripts (status board + standup draft).
