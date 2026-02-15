# TOOLS.md - Local Notes

Skills define how tools work. This file is for workspace-specific details and conventions.

## Friday Engineering Conventions

- Keep implementation changes aligned to explicit task acceptance criteria.
- Prefer small, reviewable diffs and straightforward rollback paths.
- Record verification outcomes and residual risk in deliverables.
- Escalate ambiguity early instead of inventing hidden assumptions.

## Mission Control Workflow

- `mongo-mission-control` skill is the default execution path for task polling, claiming, logging, and completion.
- Use `document_create --content-md` for text artifacts and return `mongo://documents/<DOCUMENT_ID>` links.

## What Goes Here

Use this file for environment-specific notes such as:

- Build/test command references
- Service endpoints and local runbooks
- Deployment constraints
- Any setup details unique to this workspace
