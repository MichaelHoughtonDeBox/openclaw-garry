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

## Restart OpenClaw Gateway

When you add or change env vars (e.g. in `~/.openclaw/workspace/.env`), the gateway must be restarted to pick them up. Use one of:

**Via OpenClaw CLI** (run on VPS):
```bash
openclaw gateway restart
```

**Via systemd** (if installed as a user service):
```bash
systemctl --user restart openclaw-gateway
```

**Status / logs:**
```bash
openclaw gateway status
openclaw logs --follow
```

---

## Mission Control + MongoDB setup (VPS walkthrough)

### 1. MongoDB connection

Mission Control uses a MongoDB connection string (Atlas or self-hosted). Add to `~/.openclaw/workspace/.env` on the VPS:

```
MISSION_CONTROL_MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority
```

If using Atlas, copy the URI from the cluster's "Connect" → "Connect your application".

### 2. Install Mission Control script dependencies

On the VPS:

```bash
cd /root/.openclaw/workspace/scripts && npm install
```

This installs the `mongodb` Node driver. No MongoDB server install needed if you use Atlas.

### 3. Bootstrap indexes (first run only)

```bash
cd /root/.openclaw/workspace/scripts
node mission-control-cli.mjs task_bootstrap_indexes
```

### 4. (Optional) Install mongosh for shell access

If agents or you want to run `mongosh` / `mongo` shell commands, install on the VPS:

```bash
# Debian/Ubuntu (Hostinger)
curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/8.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list
sudo apt update && sudo apt install -y mongodb-mongosh
```

Then restart the gateway so env is picked up: `openclaw gateway restart`.

---

## Telegram commands (BOT_COMMANDS_TOO_MUCH)

The 111 commands come from **OpenClaw registering every skill** (from all agent workspaces) as Telegram slash commands. Telegram allows max 100.

**Where:** `openclaw.json` → `channels.telegram.commands`. Set `nativeSkills: false` to stop skills registering as commands (keeps native commands like `/restart` only). Now set in your config; restart gateway to apply.

---

## Notes

<!-- Add thinking, decisions, TODOs here -->
