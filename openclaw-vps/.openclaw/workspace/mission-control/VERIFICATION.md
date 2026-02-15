# Mission Control Verification

## Local Validation (Completed)

Run from `workspace/scripts`:

```bash
# End-to-end validation using an in-memory MongoDB runtime.
npm run mission:smoke
```

Validated criteria:
- Corey/Tony pickup flow works (`task_poll_ready_for_assignee` + `task_claim`).
- Garry dependency release works (`task_release_dependencies`).
- Duplicate claim prevention works (second claim rejected).
- Task history remains auditable via `agent_logs`.

## VPS Deployment

```bash
# Push .openclaw changes to VPS (exclude credentials and runtime noise).
rsync -avz --exclude 'credentials' --exclude 'logs' --exclude 'agents/*/sessions' --exclude 'workspace/scripts/node_modules' --exclude 'workspace/scripts/package-lock.json' /Users/michaelhoughton/Documents/openclaw-experiment/openclaw-vps/.openclaw/ root@srv1368406.hstgr.cloud:~/.openclaw/
```

```bash
# Install mission control script dependencies on VPS.
ssh root@srv1368406.hstgr.cloud "cd /root/.openclaw/workspace/scripts && npm install --omit=optional"
```

```bash
# Validate CLI is available on VPS.
ssh root@srv1368406.hstgr.cloud "node /root/.openclaw/workspace/scripts/mission-control-cli.mjs help --json"
```

```bash
# Restart gateway to pick up cron/job updates if needed.
ssh root@srv1368406.hstgr.cloud "pkill -f 'openclaw gateway run' || true; nohup openclaw gateway run --bind loopback --port 18789 > /tmp/openclaw-gateway.log 2>&1 &"
```

## Post-Deploy Runtime Checks

```bash
# Confirm cron jobs are present after deploy.
ssh root@srv1368406.hstgr.cloud "cat /root/.openclaw/cron/jobs.json"
```

```bash
# Generate live status snapshot (requires MISSION_CONTROL_MONGO_URI on VPS).
ssh root@srv1368406.hstgr.cloud "node /root/.openclaw/workspace/scripts/mission-control-report.mjs"
```
