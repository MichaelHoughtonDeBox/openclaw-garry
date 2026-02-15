# Mission Control UI Feature Gap Matrix

This matrix captures the baseline comparison between the reference screenshot and the current OpenClaw Mission Control UI before implementation changes.

## Core Surfaces

| Area | Reference Screenshot | Current UI Baseline | Gap Severity | Planned Change |
| --- | --- | --- | --- | --- |
| Shell layout | Top bar + left agent rail + center board + right live feed | Single stacked card with sections | High | Split into multi-pane command center shell |
| Top command bar | Live counters, global utilities, always-visible context | Basic heading + local controls inside content card | Medium | Add persistent top command/status bar with metrics |
| Agent visibility | Persistent roster with role labels and active indicators | Health cards grid (status counts only) | High | Add `AgentsRail` with filter + focus state |
| Mission queue controls | Queue tabs (`All`, `Inbox`, etc.) and quick segmentation | Static kanban columns with no tab strip | High | Add board status tabs and query controls |
| Task card density | Priority labels, tags, owner, age, comment/attachment counts | Title + assignee + status/priority/trigger badges | Medium | Add richer card metadata and counters |
| Live feed | Right rail with filter chips and actor filters | Bottom card list with no filter controls | High | Add filtered right-rail feed panel |
| Notification visibility | Implied collaboration awareness from feed/task actions | Mention queue exists in backend but no visible queue UI | High | Add notifications panel (pending/delivered/failed) |
| Real-time feel | Near-live operational view | 7-second polling snapshots | Medium | Add SSE-driven update triggers + polling fallback |
| Multi-agent scale | Built for 10-agent operation | Several views constrained to default trio | High | Expand roster-aware data/filter surfaces |

## Collaboration & Data Features

| Capability | Reference Screenshot Signals | Current UI Baseline | Gap Severity | Planned Change |
| --- | --- | --- | --- | --- |
| Feed filtering | Type filters (`Tasks`, `Comments`, `Decisions`) | No feed facets | High | Add type + assignee filter controls |
| Agent-centric filtering | Left rail and feed actor chips | No persistent agent focus context | Medium | Wire selected agent to board/feed/document filters |
| Thread-to-feed continuity | Comments clearly represented in live feed | Thread and feed are separate surfaces | Medium | Add task deep-links + feed highlight syncing |
| Queue observability | Strong status-at-a-glance in board header | Status only visible as column headings | Medium | Add queue summary chips + counts |

## Design Direction Guardrails

- Keep OpenClaw's current identity and avoid visual cloning of the screenshot.
- Copy functional patterns (layout and interactions), not surface styling.
- Use stronger typography hierarchy, structured spacing rhythm, and restrained motion to create an editorial-operations feel.
- Preserve readability and operational calm while increasing information density.
