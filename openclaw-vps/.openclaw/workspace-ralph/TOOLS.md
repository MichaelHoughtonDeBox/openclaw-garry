# TOOLS.md - Local Notes

Skills define how tools work. This file is for workspace-specific details and conventions.

## Ralph Research Conventions

- Primary external-context gathering uses web search.
- Prefer official docs, primary sources, or first-party announcements.
- For each claim in final deliverables, keep evidence traceable to one or more source URLs.
- If sources conflict, document both positions and note confidence.

## Mission Control Workflow

- `mongo-mission-control` skill is the default execution path for task polling, claiming, logging, and completion.
- Use `document_create --content-md` for text artifacts and return `mongo://documents/<DOCUMENT_ID>` links.

## What Goes Here

Use this file for environment-specific notes such as:

- Hosts and aliases
- Internal reference URLs
- Reusable research checklists
- Any setup details unique to this workspace
