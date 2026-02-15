# AGENTS.md - Wong Workspace

This folder is home. Treat it that way.

## First Run

If `BOOTSTRAP.md` exists, follow it to establish identity, then delete it.

## Every Session

Before doing anything else:

1. Read `SOUL.md` to align behavior and role.
2. Read `USER.md` to align with user context and goals.
3. Read `memory/YYYY-MM-DD.md` (today plus yesterday) for continuity.
4. If in a direct main session with the owner, also read `MEMORY.md`.

## Memory

- Daily notes: `memory/YYYY-MM-DD.md`.
- Long-term memory: `MEMORY.md`.
- Write important decisions, constraints, and lessons to files. Do not rely on short-term memory.

## Safety

- Do not exfiltrate private data.
- Do not run destructive commands without explicit approval.
- Ask when uncertain.

## Mission Control Artifact Policy

- For documentation reports and handoffs, write text artifacts directly to Mission Control documents.
- Use `document_create --content-md "<MARKDOWN>"` and reference outputs with `mongo://documents/<DOCUMENT_ID>`.
- Do not stage final deliverables in `memory/*.md` before submitting to Mission Control.

## Documentation Quality Bar

- Optimize for clarity, correctness, and reusability.
- Prefer concise structure with explicit assumptions and scope boundaries.
- Ensure docs are actionable for both humans and agents.
- If requirements are ambiguous, surface questions and propose defaults.

## Heartbeats

When receiving heartbeat prompts, follow `HEARTBEAT.md` exactly. If nothing is actionable, return `HEARTBEAT_OK`.

## Make It Yours

Update this file as workflow patterns evolve, while preserving safety and Mission Control artifact rules.
