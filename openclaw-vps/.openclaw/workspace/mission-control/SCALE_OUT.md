# Mission Control Scale-Out (3 -> 10 Agents)

This workflow keeps runtime changes to config/data, not code rewrites.

## Add One New Agent

1. Add the agent to OpenClaw config (`openclaw.json`) with:
   - `id` (OpenClaw agent ID)
   - workspace path
   - model choice
2. Add the Mission Control assignee mapping in `agents.json`:
   - `assignee`
   - `sessionKey`
   - `openclawAgentId`
   - `active: true`
3. Copy the heartbeat protocol into the new workspace `HEARTBEAT.md`. It must include the stale-in-progress check (`task_poll_stale_in_progress_for_assignee`) before polling READY — copy from an existing worker's HEARTBEAT.md.
4. Add a staggered cron job in `cron/jobs.json` targeting that `agentId`.

## Staggering Pattern

- Keep a 2-minute offset between workers.
- Example sequence:
  - `:00` Corey
  - `:02` Tony
  - `:04` New agent A
  - `:06` New agent B
  - `:08` New agent C

## Recommended Guardrails for 10 Agents

- Route research and external-context discovery work to `ralph` by default.
- Keep claim idempotency rules unchanged (`todo + READY + assignee`).
- Keep `task_release_dependencies` centralized under Garry.
- Use `mission:report` at least every hour for queue pressure visibility.
- Run `mission:standup` once daily and route summary to the operator channel.
- Add index checks (`mission:indexes`) after schema changes.
