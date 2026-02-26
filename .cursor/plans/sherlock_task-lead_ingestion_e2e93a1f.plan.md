---
name: Sherlock Task-Lead Ingestion
overview: Enable Sherlock to execute assigned Mission Control tasks by extracting free-form URL/text leads from task descriptions, then run directed incident discovery/ingest before falling back to autonomous cron search.
todos:
  - id: enforce-task-first-heartbeat
    content: Make HEARTBEAT enforce task-first execution before autonomous fallback
    status: pending
  - id: add-task-handler-script
    content: Create run-sherlock-task.mjs to claim/execute/complete Sherlock tasks
    status: pending
  - id: implement-free-text-lead-parser
    content: Add task lead parser for URL/topic/location extraction from free text
    status: pending
  - id: wire-directed-cycle-overrides
    content: Use parsed leads to drive x/perplexity query overrides in cycle runs
    status: pending
  - id: document-garry-task-format
    content: Update Sherlock README with free-text task examples and outcomes
    status: pending
  - id: validate-hybrid-runtime
    content: Run dry-run scenarios for URL/text tasks and no-task fallback
    status: pending
isProject: false
---

# Sherlock Task-Lead Ingestion Plan

## Goal

Make Sherlock task-capable in practice: when Garry assigns a task with URL/text context, Sherlock should claim it, extract leads from free text, run directed discovery, ingest valid incidents, and complete/block the task with clear output.

## Implementation Steps

- Update heartbeat execution policy in `[/Users/michaelhoughton/Documents/openclaw-experiment/openclaw-vps/.openclaw/workspace-sherlock/HEARTBEAT.md](/Users/michaelhoughton/Documents/openclaw-experiment/openclaw-vps/.openclaw/workspace-sherlock/HEARTBEAT.md)` to enforce an executable order:
  - poll ready task for `sherlock`
  - claim task
  - run new task handler script
  - complete or block task
  - only run autonomous cycle when queue is empty.
- Add a dedicated task handler script under Sherlock skill:
  - create `[/Users/michaelhoughton/Documents/openclaw-experiment/openclaw-vps/.openclaw/workspace-sherlock/.agents/skills/sherlock-incident-discovery/scripts/run-sherlock-task.mjs](/Users/michaelhoughton/Documents/openclaw-experiment/openclaw-vps/.openclaw/workspace-sherlock/.agents/skills/sherlock-incident-discovery/scripts/run-sherlock-task.mjs)`
  - responsibilities:
    - fetch task payload via Mission Control CLI (`task_poll_ready_for_assignee` + `task_claim` data)
    - parse free-form description for URLs and explicit location hints
    - derive directed `--x-query`, `--perplexity-queries`, and optional focus list
    - invoke `run-sherlock-cycle.mjs` with these directed parameters
    - write progress logs and output artifact
    - mark complete/block using CLI.
- Add free-text lead parsing helper:
  - create `[/Users/michaelhoughton/Documents/openclaw-experiment/openclaw-vps/.openclaw/workspace-sherlock/.agents/skills/sherlock-incident-discovery/scripts/shared/task-lead-parser.mjs](/Users/michaelhoughton/Documents/openclaw-experiment/openclaw-vps/.openclaw/workspace-sherlock/.agents/skills/sherlock-incident-discovery/scripts/shared/task-lead-parser.mjs)`
  - implement deterministic extraction:
    - URL regex extraction (first high-confidence lead + optional additional links)
    - keyword/topic extraction from description text
    - optional location phrase extraction for `focus-locations` override.
- Add URL-intake support to directed runs:
  - extend Perplexity query generation in `[/Users/michaelhoughton/Documents/openclaw-experiment/openclaw-vps/.openclaw/workspace-sherlock/.agents/skills/sherlock-incident-discovery/scripts/run-sherlock-cycle.mjs](/Users/michaelhoughton/Documents/openclaw-experiment/openclaw-vps/.openclaw/workspace-sherlock/.agents/skills/sherlock-incident-discovery/scripts/run-sherlock-cycle.mjs)`
  - if a lead URL is present, prepend targeted prompts like "validate and extract incident evidence from this URL first" before broader passes.
- Keep autonomous behavior unchanged as fallback:
  - preserve existing cron-led discovery path when no tasks are available.
- Update operator docs in `[/Users/michaelhoughton/Documents/openclaw-experiment/openclaw-brain/SHERLOCK_AGENT_README.md](/Users/michaelhoughton/Documents/openclaw-experiment/openclaw-brain/SHERLOCK_AGENT_README.md)`:
  - task authoring examples for Garry (free text)
  - what Sherlock extracts automatically
  - completion/blocking outcomes and expected logs.

## Validation

- Dry-run tests for task handler:
  - task with URL only
  - task with text-only lead
  - task with URL + location hints
  - malformed/empty task.
- Confirm heartbeat behavior:
  - task exists -> task path runs and no autonomous fallback in same turn
  - no task -> existing autonomous cycle runs.
- Verify no regressions in Wolf ingestion path:
  - same endpoint and payload contract (`/api/internal/sherlock-ingest`) remains unchanged.

