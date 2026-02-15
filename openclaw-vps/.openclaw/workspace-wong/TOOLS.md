# TOOLS.md - Local Notes

Skills define how tools work. This file is for workspace-specific details and conventions.

## Wong Documentation Conventions

- Structure docs for scanability and execution.
- Capture rationale, not just procedure.
- Keep terminology consistent across artifacts.
- Ensure deliverables are suitable for both human and agent consumption.

## Mission Control Workflow

- `mongo-mission-control` skill is the default execution path for task polling, claiming, logging, and completion.
- Use `document_create --content-md` for text artifacts and return `mongo://documents/<DOCUMENT_ID>` links.

## What Goes Here

Use this file for environment-specific notes such as:

- Canonical docs locations
- Preferred templates
- Naming conventions
- Any setup details unique to this workspace
