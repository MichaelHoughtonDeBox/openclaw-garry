---
name: openclaw-vps-sync
description: Manages the OpenClaw VPS workflow—local edit, sync to server. Use when editing OpenClaw config, syncing openclaw-vps to the Hostinger VPS, or working with SOUL.md, IDENTITY.md, openclaw.json, or agent workspace files.
---

# OpenClaw VPS Sync

## Project layout

| Path | Purpose |
|------|---------|
| `openclaw/` | Full OpenClaw repo—reference only, do not edit |
| `openclaw-vps/.openclaw/` | VPS config—edit here, sync to server |
| `openclaw-brain/` | Notes, thinking, context |

## VPS connection

- Host: `srv1368406.hstgr.cloud` (root)
- Key config lives in `openclaw-vps/.openclaw/` (openclaw.json, workspace, agents, identity, etc.)

## Sync commands

**Pull from VPS** (fetch latest from server):
```bash
rsync -avz --exclude 'credentials' root@srv1368406.hstgr.cloud:~/.openclaw/ openclaw-vps/.openclaw/
```

**Push to VPS** (deploy local changes):
```bash
rsync -avz openclaw-vps/.openclaw/ root@srv1368406.hstgr.cloud:~/.openclaw/
```

## Key config files

- `openclaw-vps/.openclaw/openclaw.json` — main config (channels, agents, tools)
- `openclaw-vps/.openclaw/workspace/` — SOUL.md, IDENTITY.md, USER.md, AGENTS.md, MEMORY.md, HEARTBEAT.md
- `openclaw-vps/.openclaw/agents/` — per-agent config (main, corey, tony)
- `openclaw-vps/.openclaw/identity/` — identity config

## Workflow

1. Edit files in `openclaw-vps/.openclaw/`
2. Push: `rsync -avz openclaw-vps/.openclaw/ root@srv1368406.hstgr.cloud:~/.openclaw/`
3. OpenClaw hot-reloads most config changes
