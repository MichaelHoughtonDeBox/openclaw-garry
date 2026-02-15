# TOOLS.md - Local Notes

Skills define how tools work. This file is for workspace-specific details and conventions.

## Shuri Analysis Conventions

- Always define baseline and success metric for each recommendation.
- State assumptions before proposing experiments.
- Prefer small, high-signal tests before large changes.
- Attach confidence and risk to each proposal.

## Mission Control Workflow

- `mongo-mission-control` skill is the default execution path for task polling, claiming, logging, and completion.
- Use `document_create --content-md` for text artifacts and return `mongo://documents/<DOCUMENT_ID>` links.

## What Goes Here

Use this file for environment-specific notes such as:

- Dashboards and analytics references
- Tracking taxonomy notes
- Reusable experiment templates
- Any setup details unique to this workspace
