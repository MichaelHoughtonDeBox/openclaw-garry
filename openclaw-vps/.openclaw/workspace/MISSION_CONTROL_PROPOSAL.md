# Mission Control Architecture Proposal

## 1. Overview
A decoupled, polling-based agent coordination system. Instead of the main agent (Garry) pushing tasks to sub-agents (Corey, Tony) and waiting, tasks are stored in a centralized database (MongoDB). Sub-agents poll this database via cron jobs to find work assigned to them.

## 2. Infrastructure: MongoDB
- **Benefits:** High performance, flexible schema for evolving task requirements, and easy to build a custom Mission Control UI on top.
- **Connection:** Managed via a dedicated OpenClaw skill (`mongo-mission-control`).

## 3. Schema: `tasks` Collection
Each document represents a discrete piece of work.

```json
{
  "_id": "ObjectId",
  "task_name": "string",
  "description": "string",
  "assignee": "string (garry|corey|tony|michael)",
  "status": "string (todo|in_progress|blocked|review|done)",
  "priority": "string (urgent|normal|low)",
  "trigger_state": "string (READY|WAITING|RETRY)",
  "dependencies": ["Array of Task ObjectIds"],
  "output_data": {
    "link": "url/path",
    "summary": "string"
  },
  "agent_logs": [
    {
      "timestamp": "ISO8601",
      "agent": "string",
      "message": "string"
    }
  ],
  "created_at": "ISO8601",
  "updated_at": "ISO8601"
}
```

## 4. Agent Workflow (The "Pull" Model)
1. **Intake:** Michael tells Garry an idea. Garry writes tasks to MongoDB.
2. **Polling:** Sub-agents (Corey/Tony) run a cron-triggered script:
   - Query: `{ assignee: "corey", trigger_state: "READY", status: "todo" }`
3. **Execution:** Agent performs the task, updates MongoDB with logs and output.
4. **Completion:** Agent sets status to "done" and updates `updated_at`.
5. **Orchestration:** Garry's heartbeat periodically checks for tasks where all dependencies are "done" and moves the dependent task's `trigger_state` to "READY".

## 5. Next Steps
- [ ] Install MongoDB on the VPS (or connect to a remote cluster).
- [ ] Create the `mongo-mission-control` skill.
- [ ] Implement the first cron-based polling script for Corey.
