# OpenClaw Brain

Thinking, context, and notes while working on the OpenClaw VPS setup.

---

## Project structure

```
openclaw-experiment/
├── openclaw/           # Full repo (reference only)
├── openclaw-vps/       # VPS config — edit here, sync to server
│   └── .openclaw/      # Mirrors ~/.openclaw on VPS
├── openclaw-brain/     # This folder — notes & thinking
└── ...
```

---

## VPS details

- **Host:** `srv1368406.hstgr.cloud`
- **IP:** `187.77.99.8`
- **SSH:** `ssh root@srv1368406.hstgr.cloud`

---

## Sync workflow

**Pull from VPS:**
```bash
rsync -avz --exclude 'credentials' root@srv1368406.hstgr.cloud:~/.openclaw/ openclaw-vps/.openclaw/
```

**Push to VPS:**
```bash
rsync -avz openclaw-vps/.openclaw/ root@srv1368406.hstgr.cloud:~/.openclaw/
```

---

## Notes

<!-- Add thinking, decisions, TODOs here -->
