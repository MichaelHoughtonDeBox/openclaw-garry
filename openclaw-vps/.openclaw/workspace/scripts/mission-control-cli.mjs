#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { MongoClient, ObjectId } from "mongodb";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI helpers keep logs easy to scan during terminal debugging.
const color = {
  reset: "\u001b[0m",
  dim: "\u001b[2m",
  red: "\u001b[31m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  cyan: "\u001b[36m"
};

function info(message) {
  process.stdout.write(`${color.cyan}${message}${color.reset}\n`);
}

function success(message) {
  process.stdout.write(`${color.green}${message}${color.reset}\n`);
}

function warn(message) {
  process.stdout.write(`${color.yellow}${message}${color.reset}\n`);
}

function fail(message) {
  process.stderr.write(`${color.red}${message}${color.reset}\n`);
}

function parseArgs(argv) {
  const out = { _: [] };
  let index = 0;
  while (index < argv.length) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      out._.push(token);
      index += 1;
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      out[key] = true;
      index += 1;
      continue;
    }
    out[key] = next;
    index += 2;
  }
  return out;
}

async function readJson(filePath) {
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content);
}

async function loadEnvFile(filePath) {
  try {
    const content = await readFile(filePath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        continue;
      }
      const separator = trimmed.indexOf("=");
      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // Missing env files are expected on fresh installs.
  }
}

async function bootstrapEnv(workspaceRoot) {
  await loadEnvFile(path.join(workspaceRoot, ".env"));
  await loadEnvFile(path.join(workspaceRoot, ".env.local"));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function parseObjectId(input, label) {
  assert(typeof input === "string" && ObjectId.isValid(input), `${label} must be a valid Mongo ObjectId`);
  return new ObjectId(input);
}

function nowIso() {
  return new Date().toISOString();
}

function toArray(input) {
  if (!input) {
    return [];
  }
  if (Array.isArray(input)) {
    return input;
  }
  return String(input)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBooleanInput(input, label) {
  if (input === undefined || input === null || input === "") {
    return undefined;
  }
  const normalized = String(input).trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "n"].includes(normalized)) {
    return false;
  }
  throw new Error(`${label} must be true or false`);
}

function normalizeTask(task) {
  if (!task) {
    return task;
  }
  return {
    ...task,
    _id: String(task._id),
    dependencies: (task.dependencies || []).map((dep) => String(dep)),
    linked_document_ids: (task.linked_document_ids || []).map((documentId) => String(documentId))
  };
}

function normalizeDocument(document) {
  if (!document) {
    return document;
  }
  return {
    ...document,
    _id: String(document._id),
    taskId: document.taskId ? String(document.taskId) : undefined
  };
}

function normalizeNotification(notification) {
  if (!notification) {
    return notification;
  }
  return {
    ...notification,
    _id: String(notification._id),
    taskId: notification.taskId ? String(notification.taskId) : undefined,
    messageId: notification.messageId ? String(notification.messageId) : undefined
  };
}

async function withMongo(
  { uri, dbName, tasksCollectionName, documentsCollectionName, activitiesCollectionName, notificationsCollectionName },
  run
) {
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(dbName);
    const tasks = db.collection(tasksCollectionName);
    const documents = db.collection(documentsCollectionName);
    const activities = db.collection(activitiesCollectionName);
    const notifications = db.collection(notificationsCollectionName);
    return await run({ db, tasks, documents, activities, notifications });
  } finally {
    await client.close();
  }
}

function canTransition(transitions, fromStatus, toStatus) {
  const allowed = transitions.allowed_transitions?.[fromStatus] || [];
  return allowed.includes(toStatus);
}

function createLog(agent, message) {
  return {
    timestamp: nowIso(),
    agent,
    message
  };
}

function createActivity({
  source = "task",
  status = "ok",
  eventType,
  message,
  assignee,
  agentId,
  taskId,
  metadata
}) {
  return {
    source,
    status,
    eventType,
    message,
    assignee,
    agentId,
    taskId,
    metadata,
    created_at: nowIso()
  };
}

function parsePayload(args) {
  if (args.payload) {
    return JSON.parse(String(args.payload));
  }
  if (args["payload-file"]) {
    const filePath = path.resolve(process.cwd(), String(args["payload-file"]));
    return readJson(filePath);
  }
  return {};
}

function priorityRank(priority) {
  if (priority === "urgent") {
    return 0;
  }
  if (priority === "normal") {
    return 1;
  }
  return 2;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const action = args._[0];
  const statusHint =
    " (READY/WAITING/RETRY are trigger_state — use task_set_trigger --trigger-state for those)";
  const statusMsg = (allowed) => `status must be one of: ${Array.from(allowed).join(", ")}${statusHint}`;

  assert(
    action,
    "Missing action. Run: node mission-control-cli.mjs help. Example: node mission-control-cli.mjs task_poll_ready_for_assignee --assignee corey"
  );

  const workspaceRoot = path.resolve(__dirname, "..");
  await bootstrapEnv(workspaceRoot);

  const transitions = await readJson(path.join(workspaceRoot, "mission-control", "transitions.json"));
  const agentsConfig = await readJson(path.join(workspaceRoot, "mission-control", "agents.json"));
  const schema = await readJson(path.join(workspaceRoot, "mission-control", "schema.task.json"));

  const allowedStatuses = new Set(schema.properties.status.enum);
  const allowedPriorities = new Set(schema.properties.priority.enum);
  const allowedTriggers = new Set(schema.properties.trigger_state.enum);
  const knownAssignees = new Set(schema.properties.assignee.enum);
  const allowedDocumentSources = new Set(["agent", "operator", "import", "external", "reference"]);

  const outputJson = Boolean(args.json);
  const emit = (payload) => {
    const rendered = JSON.stringify(payload, null, 2);
    if (outputJson) {
      process.stdout.write(`${rendered}\n`);
      return;
    }
    process.stdout.write(`${color.dim}${rendered}${color.reset}\n`);
  };

  if (action === "help") {
    emit({
      ok: true,
      action,
      available_actions: [
        "task_create",
        "task_get",
        "task_list",
        "task_poll_ready_for_assignee",
        "task_poll_stale_in_progress_for_assignee",
        "task_claim",
        "task_append_log",
        "task_update",
        "task_reassign",
        "task_submit",
        "task_transition_status",
        "task_set_trigger",
        "task_mark_blocked",
        "task_complete_with_output",
        "task_submit",
        "task_reassign",
        "task_get",
        "task_release_dependencies",
        "task_review_queue",
        "task_bootstrap_indexes",
        "document_create",
        "document_get",
        "document_list",
        "document_link_to_task",
        "notification_poll_for_assignee",
        "notification_mark_delivered",
        "notification_mark_failed",
        "agent_list"
      ]
    });
    return;
  }

  if (action === "agent_list") {
    const activeOnly = Boolean(args.active);
    const agents = activeOnly ? agentsConfig.agents.filter((agent) => agent.active) : agentsConfig.agents;
    emit({ ok: true, action, agents });
    return;
  }

  const uri = String(args["mongo-uri"] || process.env.MISSION_CONTROL_MONGO_URI || "");
  assert(uri, "MISSION_CONTROL_MONGO_URI is required (or pass --mongo-uri)");
  const dbName = String(args.db || process.env.MISSION_CONTROL_DB || "mission-control");
  const tasksCollectionName = String(args.collection || process.env.MISSION_CONTROL_TASKS_COLLECTION || "tasks");
  const activitiesCollectionName = String(args["activities-collection"] || process.env.MISSION_CONTROL_ACTIVITIES_COLLECTION || "activities");
  const documentsCollectionName = String(args["documents-collection"] || process.env.MISSION_CONTROL_DOCUMENTS_COLLECTION || "documents");
  const notificationsCollectionName = String(
    args["notifications-collection"] || process.env.MISSION_CONTROL_NOTIFICATIONS_COLLECTION || "notifications"
  );

  await withMongo(
    { uri, dbName, tasksCollectionName, documentsCollectionName, activitiesCollectionName, notificationsCollectionName },
    async ({ db, tasks, documents, activities, notifications }) => {
    if (action === "task_create") {
      const payload = await parsePayload(args);
      const taskName = String(args["task-name"] || payload.task_name || "").trim();
      const description = String(args.description || payload.description || "").trim();
      const assignee = String(args.assignee || payload.assignee || "").trim();
      const priority = String(args.priority || payload.priority || "normal").trim();
      const dependenciesRaw = toArray(args.dependencies || payload.dependencies);
      const triggerState = String(
        args["trigger-state"] || payload.trigger_state || (dependenciesRaw.length > 0 ? "WAITING" : "READY")
      ).trim();

      assert(
        taskName.length >= 3,
        "task_name must be at least 3 characters. Provide --task-name with a descriptive title (e.g. 'Investigate signup drop-off')"
      );
      assert(
        description.length >= 5,
        "description must be at least 5 characters. Provide --description with execution brief for the assignee"
      );
      assert(knownAssignees.has(assignee), `assignee must be one of: ${Array.from(knownAssignees).join(", ")}`);
      assert(allowedPriorities.has(priority), `priority must be one of: ${Array.from(allowedPriorities).join(", ")}`);
      assert(allowedTriggers.has(triggerState), `trigger_state must be one of: ${Array.from(allowedTriggers).join(", ")}`);

      const dependencies = dependenciesRaw.map((id) => parseObjectId(id, "dependencies item"));
      const createdAt = nowIso();
      const createdBy = String(args.agent || payload.created_by || "garry");

      const doc = {
        task_name: taskName,
        description,
        assignee,
        status: "todo",
        priority,
        trigger_state: triggerState,
        dependencies,
        linked_document_ids: [],
        output_data: {
          link: String(payload.output_data?.link || ""),
          summary: String(payload.output_data?.summary || "")
        },
        agent_logs: [createLog(createdBy, `Task created and assigned to ${assignee}`)],
        created_at: createdAt,
        updated_at: createdAt
      };

      const result = await tasks.insertOne(doc);
      success(`Created task ${result.insertedId.toString()} for ${assignee}`);
      emit({ ok: true, action, insertedId: result.insertedId.toString() });
      return;
    }

    if (action === "task_poll_ready_for_assignee") {
      const assignee = String(args.assignee || "").trim();
      assert(knownAssignees.has(assignee), `assignee must be one of: ${Array.from(knownAssignees).join(", ")}`);
      const limit = Number(args.limit || 5);
      assert(Number.isInteger(limit) && limit > 0 && limit <= 100, "limit must be an integer between 1 and 100");

      const docs = await tasks
        .find({
          assignee,
          status: "todo",
          trigger_state: "READY"
        })
        .limit(limit * 5)
        .toArray();

      docs.sort((left, right) => {
        const byPriority = priorityRank(left.priority) - priorityRank(right.priority);
        if (byPriority !== 0) {
          return byPriority;
        }
        return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
      });

      const selected = docs.slice(0, limit).map(normalizeTask);
      info(`Found ${selected.length} READY task(s) for ${assignee}`);
      emit({ ok: true, action, tasks: selected });
      return;
    }

    // Returns in_progress tasks assigned to assignee with updated_at older than stale-minutes.
    // Used by heartbeats to "nag" agents about abandoned work (fire-and-forget amnesia fix).
    if (action === "task_poll_stale_in_progress_for_assignee") {
      const assignee = String(args.assignee || "").trim();
      assert(knownAssignees.has(assignee), `assignee must be one of: ${Array.from(knownAssignees).join(", ")}`);
      const limit = Math.min(Math.max(Number(args.limit) || 1, 1), 100);
      const staleMinutes = Math.min(Math.max(Number(args["stale-minutes"]) || 60, 1), 1440);

      const cutoffDate = new Date(Date.now() - staleMinutes * 60 * 1000);

      const docs = await tasks
        .find({
          assignee,
          status: "in_progress",
          updated_at: { $lt: cutoffDate.toISOString() }
        })
        .sort({ updated_at: 1 })
        .limit(limit)
        .toArray();

      const selected = docs.map(normalizeTask);
      info(`Found ${selected.length} stale in_progress task(s) for ${assignee}`);
      emit({ ok: true, action, tasks: selected });
      return;
    }

    if (action === "task_claim") {
      const taskId = parseObjectId(String(args["task-id"] || ""), "task-id");
      const assignee = String(args.assignee || "").trim();
      assert(knownAssignees.has(assignee), `assignee must be one of: ${Array.from(knownAssignees).join(", ")}`);
      const agent = String(args.agent || assignee);

      // This filter enforces idempotent claiming under concurrent cron runs.
      const filter = {
        _id: taskId,
        assignee,
        status: "todo",
        trigger_state: "READY"
      };

      const update = {
        $set: {
          status: "in_progress",
          updated_at: nowIso()
        },
        $push: {
          agent_logs: createLog(agent, "Task claimed for execution")
        }
      };

      const result = await tasks.findOneAndUpdate(filter, update, { returnDocument: "after" });
      if (!result) {
        warn(`Task ${taskId.toString()} was not claimable (already claimed, not READY, or assignee mismatch)`);
        emit({ ok: false, action, claimed: false, taskId: taskId.toString() });
        return;
      }

      success(`Claimed task ${taskId.toString()} for ${assignee}`);
      emit({ ok: true, action, claimed: true, task: normalizeTask(result) });
      return;
    }

    if (action === "task_append_log") {
      const taskId = parseObjectId(String(args["task-id"] || ""), "task-id");
      const agent = String(args.agent || "").trim();
      const message = String(args.message || "").trim();
      assert(agent.length > 0, "agent is required");
      assert(message.length > 0, "message is required");

      const result = await tasks.findOneAndUpdate(
        { _id: taskId },
        {
          $set: { updated_at: nowIso() },
          $push: { agent_logs: createLog(agent, message) }
        },
        { returnDocument: "after" }
      );

      assert(result, `Task not found: ${taskId.toString()}`);
      success(`Appended log to task ${taskId.toString()}`);
      emit({ ok: true, action, task: normalizeTask(result) });
      return;
    }

    if (action === "task_mark_blocked") {
      const taskId = parseObjectId(String(args["task-id"] || ""), "task-id");
      const assignee = String(args.assignee || "").trim();
      const reason = String(args.reason || args.message || "").trim();
      const agent = String(args.agent || assignee);

      assert(assignee.length > 0, "assignee is required");
      assert(reason.length > 0, "reason is required");

      const current = await tasks.findOne({ _id: taskId });
      assert(current, `Task not found: ${taskId.toString()}`);
      assert(canTransition(transitions, current.status, "blocked"), `Cannot transition ${current.status} -> blocked`);

      const result = await tasks.findOneAndUpdate(
        { _id: taskId, assignee },
        {
          $set: { status: "blocked", trigger_state: "RETRY", updated_at: nowIso() },
          $push: { agent_logs: createLog(agent, `Blocked: ${reason}`) }
        },
        { returnDocument: "after" }
      );

      assert(result, `Task assignee mismatch for ${taskId.toString()}`);
      warn(`Marked task ${taskId.toString()} as blocked`);
      emit({ ok: true, action, task: normalizeTask(result) });
      return;
    }

    if (action === "task_transition_status") {
      const taskId = parseObjectId(String(args["task-id"] || ""), "task-id");
      const toStatus = String(args["to-status"] || "").trim();
      const agent = String(args.agent || "garry");
      const note = String(args.note || `Status transition requested: ${toStatus}`);
      assert(allowedStatuses.has(toStatus), statusMsg(allowedStatuses));

      const current = await tasks.findOne({ _id: taskId });
      assert(current, `Task not found: ${taskId.toString()}`);
      assert(canTransition(transitions, current.status, toStatus), `Cannot transition ${current.status} -> ${toStatus}`);

      const result = await tasks.findOneAndUpdate(
        { _id: taskId, status: current.status },
        {
          $set: {
            status: toStatus,
            updated_at: nowIso()
          },
          $push: {
            agent_logs: createLog(agent, note)
          }
        },
        { returnDocument: "after" }
      );

      assert(result, `Task update race detected for ${taskId.toString()}`);
      success(`Transitioned task ${taskId.toString()} to ${toStatus}`);
      emit({ ok: true, action, task: normalizeTask(result) });
      return;
    }

    if (action === "task_complete_with_output") {
      const taskId = parseObjectId(String(args["task-id"] || ""), "task-id");
      const assignee = String(args.assignee || "").trim();
      const summary = String(args.summary || "").trim();
      const link = String(args.link || "").trim();
      const agent = String(args.agent || assignee);
      const finalStatus = String(args["final-status"] || "review");

      assert(assignee.length > 0, "assignee is required");
      assert(summary.length > 0, "summary is required");
      assert(allowedStatuses.has(finalStatus), statusMsg(allowedStatuses));

      const current = await tasks.findOne({ _id: taskId });
      assert(current, `Task not found: ${taskId.toString()}`);
      assert(canTransition(transitions, current.status, finalStatus), `Cannot transition ${current.status} -> ${finalStatus}`);

      const result = await tasks.findOneAndUpdate(
        { _id: taskId, assignee },
        {
          $set: {
            status: finalStatus,
            output_data: { link, summary },
            updated_at: nowIso()
          },
          $push: { agent_logs: createLog(agent, `Task output submitted. Status -> ${finalStatus}`) }
        },
        { returnDocument: "after" }
      );

      assert(result, `Task assignee mismatch for ${taskId.toString()}`);
      success(`Updated task ${taskId.toString()} to ${finalStatus}`);
      emit({ ok: true, action, task: normalizeTask(result) });
      return;
    }

    if (action === "task_release_dependencies") {
      const orchestrator = String(args.agent || "garry");
      const statusFilter = String(args.status || "todo");
      const waiting = await tasks
        .find({
          status: statusFilter,
          trigger_state: "WAITING",
          "dependencies.0": { $exists: true }
        })
        .toArray();

      let released = 0;
      for (const task of waiting) {
        const deps = task.dependencies || [];
        if (deps.length === 0) {
          continue;
        }

        const doneCount = await tasks.countDocuments({
          _id: { $in: deps },
          status: "done"
        });

        if (doneCount !== deps.length) {
          continue;
        }

        const updateResult = await tasks.updateOne(
          { _id: task._id, trigger_state: "WAITING" },
          {
            $set: {
              trigger_state: "READY",
              updated_at: nowIso()
            },
            $push: {
              agent_logs: createLog(orchestrator, "Dependencies resolved. trigger_state -> READY")
            }
          }
        );

        if (updateResult.modifiedCount > 0) {
          released += 1;
        }
      }

      if (released === 0) {
        info("No dependency-gated tasks were released");
      } else {
        success(`Released ${released} task(s) from WAITING -> READY`);
      }

      emit({
        ok: true,
        action,
        released
      });
      return;
    }

    if (action === "document_create") {
      const payload = await parsePayload(args);
      const title = String(args.title || payload.title || "").trim();
      const contentFile = String(args["content-file"] || payload.content_file || "").trim();
      let contentMd = String(args["content-md"] || payload.contentMd || payload.content_md || "").trim();
      const assignee = String(args.assignee || payload.assignee || "").trim();
      const source = String(args.source || payload.source || "agent").trim();
      const agentId = String(args.agent || payload.agentId || payload.agent_id || assignee).trim();
      const taskIdRaw = String(args["task-id"] || payload.taskId || payload.task_id || "").trim();
      const url = String(args.url || payload.url || "").trim();
      let metadata = payload.metadata;
      const contextModeRaw = args["context-mode"] || payload.context_mode || payload.contextMode || payload.metadata?.contextMode;
      const delegationSafeRaw =
        args["delegation-safe"] ??
        payload.delegation_safe ??
        payload.delegationSafe ??
        payload.metadata?.delegationSafe;
      const sourceDocumentIdsRaw = toArray(
        args["source-document-ids"] ||
          payload.source_document_ids ||
          payload.sourceDocumentIds ||
          payload.metadata?.sourceDocumentIds
      );
      const allowContentFile = parseBooleanInput(
        args["allow-content-file"] ?? payload.allow_content_file ?? payload.allowContentFile,
        "allow-content-file"
      );

      if (!contentMd && contentFile) {
        assert(
          allowContentFile === true,
          "content-file is disabled by default. Use --content-md for text deliverables. " +
            "If you must ingest an existing file, pass --allow-content-file true explicitly."
        );
        warn("Using disk-backed content via --content-file (explicit override enabled).");
        // Load markdown from disk only when explicitly overridden.
        const contentPath = path.resolve(process.cwd(), contentFile);
        contentMd = String(await readFile(contentPath, "utf8")).trim();
      }
      if (args.metadata) {
        metadata = JSON.parse(String(args.metadata));
      }

      assert(title.length >= 3, "title must be at least 3 characters");
      assert(contentMd.length > 0, "content-md is required for document_create");
      assert(knownAssignees.has(assignee), `assignee must be one of: ${Array.from(knownAssignees).join(", ")}`);
      assert(allowedDocumentSources.has(source), `source must be one of: ${Array.from(allowedDocumentSources).join(", ")}`);
      assert(agentId.length > 0, "agent is required");
      if (metadata !== undefined) {
        assert(metadata && typeof metadata === "object" && !Array.isArray(metadata), "metadata must be a JSON object");
      }

      const contextMode = contextModeRaw ? String(contextModeRaw).trim().toLowerCase() : undefined;
      if (contextMode) {
        assert(["full", "summary"].includes(contextMode), "context-mode must be one of: full, summary");
      }
      const delegationSafe = parseBooleanInput(delegationSafeRaw, "delegation-safe");
      const sourceDocumentIds = sourceDocumentIdsRaw.map((id) => String(parseObjectId(String(id), "source-document-id")));

      const normalizedMetadata = {
        ...(metadata || {})
      };
      if (contextMode) {
        normalizedMetadata.contextMode = contextMode;
      }
      if (delegationSafe !== undefined) {
        normalizedMetadata.delegationSafe = delegationSafe;
      }
      if (sourceDocumentIds.length > 0) {
        normalizedMetadata.sourceDocumentIds = sourceDocumentIds;
      }
      if (normalizedMetadata.delegationSafe === true) {
        assert(
          normalizedMetadata.contextMode === "full",
          "delegation-safe documents must set context-mode=full"
        );
      }

      const taskId = taskIdRaw ? parseObjectId(taskIdRaw, "task-id") : undefined;
      if (taskId) {
        const taskExists = await tasks.countDocuments({ _id: taskId }, { limit: 1 });
        assert(taskExists > 0, `Task not found: ${taskId.toString()}`);
      }

      const timestamp = nowIso();
      const created = {
        title,
        contentMd,
        assignee,
        agentId,
        taskId,
        source,
        url: url || undefined,
        metadata: Object.keys(normalizedMetadata).length > 0 ? normalizedMetadata : undefined,
        created_at: timestamp,
        updated_at: timestamp
      };

      const result = await documents.insertOne(created);

      if (taskId) {
        await tasks.updateOne(
          { _id: taskId },
          {
            $set: { updated_at: timestamp },
            $addToSet: { linked_document_ids: result.insertedId },
            $push: { agent_logs: createLog(agentId, `Linked document ${result.insertedId.toString()} to task`) }
          }
        );

        await activities.insertOne(
          createActivity({
            source: "document",
            status: "ok",
            eventType: "task_linked_document",
            message: `Linked document "${title}" to task ${taskId.toString()}`,
            assignee,
            agentId,
            taskId: taskId.toString(),
            metadata: {
              documentId: result.insertedId.toString()
            }
          })
        );
      }

      await activities.insertOne(
        createActivity({
          source: "document",
          status: "ok",
          eventType: "document_created",
          message: `Created document "${title}"`,
          assignee,
          agentId,
          taskId: taskId ? taskId.toString() : undefined,
          metadata: {
            documentId: result.insertedId.toString(),
            source
          }
        })
      );

      const createdDocument = await documents.findOne({ _id: result.insertedId });
      assert(createdDocument, "Document was created but not retrievable");
      success(`Created document ${result.insertedId.toString()}`);
      emit({ ok: true, action, document: normalizeDocument(createdDocument) });
      return;
    }

    if (action === "document_get") {
      const documentId = parseObjectId(String(args["document-id"] || ""), "document-id");
      const found = await documents.findOne({ _id: documentId });
      assert(found, `Document not found: ${documentId.toString()}`);
      emit({ ok: true, action, document: normalizeDocument(found) });
      return;
    }

    if (action === "document_list") {
      const assignee = args.assignee ? String(args.assignee).trim() : undefined;
      const source = args.source ? String(args.source).trim() : undefined;
      const taskIdRaw = args["task-id"] ? String(args["task-id"]).trim() : undefined;
      const queryText = args.q ? String(args.q).trim() : undefined;
      const limit = Number(args.limit || 25);

      if (assignee) {
        assert(knownAssignees.has(assignee), `assignee must be one of: ${Array.from(knownAssignees).join(", ")}`);
      }
      if (source) {
        assert(allowedDocumentSources.has(source), `source must be one of: ${Array.from(allowedDocumentSources).join(", ")}`);
      }
      assert(Number.isInteger(limit) && limit > 0 && limit <= 200, "limit must be an integer between 1 and 200");

      const query = {};
      if (assignee) {
        query.assignee = assignee;
      }
      if (source) {
        query.source = source;
      }
      if (taskIdRaw) {
        query.taskId = parseObjectId(taskIdRaw, "task-id");
      }
      if (queryText) {
        query.$or = [
          { title: { $regex: queryText, $options: "i" } },
          { contentMd: { $regex: queryText, $options: "i" } }
        ];
      }

      const listed = await documents.find(query).sort({ created_at: -1 }).limit(limit).toArray();
      emit({ ok: true, action, documents: listed.map(normalizeDocument) });
      return;
    }

    if (action === "document_link_to_task") {
      const taskId = parseObjectId(String(args["task-id"] || ""), "task-id");
      const documentId = parseObjectId(String(args["document-id"] || ""), "document-id");
      const agentId = String(args.agent || "garry");
      const timestamp = nowIso();

      const task = await tasks.findOne({ _id: taskId });
      assert(task, `Task not found: ${taskId.toString()}`);
      const document = await documents.findOne({ _id: documentId });
      assert(document, `Document not found: ${documentId.toString()}`);

      const alreadyLinked = (task.linked_document_ids || []).some(
        (candidate) => String(candidate) === documentId.toString()
      );

      if (!alreadyLinked) {
        await tasks.updateOne(
          { _id: taskId },
          {
            $set: { updated_at: timestamp },
            $addToSet: { linked_document_ids: documentId },
            $push: { agent_logs: createLog(agentId, `Linked document ${documentId.toString()} to task`) }
          }
        );
      }

      await documents.updateOne(
        { _id: documentId },
        {
          $set: {
            taskId,
            updated_at: timestamp
          }
        }
      );

      if (!alreadyLinked) {
        await activities.insertOne(
          createActivity({
            source: "document",
            status: "ok",
            eventType: "task_linked_document",
            message: `Linked document "${document.title}" to task ${taskId.toString()}`,
            assignee: document.assignee,
            agentId,
            taskId: taskId.toString(),
            metadata: {
              documentId: documentId.toString()
            }
          })
        );
      }

      success(`Linked document ${documentId.toString()} to task ${taskId.toString()}`);
      emit({ ok: true, action, alreadyLinked, taskId: taskId.toString(), documentId: documentId.toString() });
      return;
    }

    if (action === "notification_poll_for_assignee") {
      const assignee = String(args.assignee || "").trim();
      assert(knownAssignees.has(assignee), `assignee must be one of: ${Array.from(knownAssignees).join(", ")}`);
      const status = String(args.status || "pending").trim();
      assert(
        ["pending", "delivered", "failed"].includes(status),
        "status must be one of: pending, delivered, failed"
      );
      const limit = Number(args.limit || 10);
      assert(Number.isInteger(limit) && limit > 0 && limit <= 200, "limit must be an integer between 1 and 200");

      // Oldest-first ordering avoids starvation when delivery falls behind.
      const docs = await notifications
        .find({
          mentionedAssignee: assignee,
          status
        })
        .sort({ created_at: 1 })
        .limit(limit)
        .toArray();

      info(`Found ${docs.length} ${status} notification(s) for ${assignee}`);
      emit({ ok: true, action, notifications: docs.map(normalizeNotification) });
      return;
    }

    if (action === "notification_mark_delivered") {
      const notificationId = parseObjectId(String(args["notification-id"] || ""), "notification-id");
      const assignee = args.assignee ? String(args.assignee).trim() : undefined;
      const agent = String(args.agent || assignee || "notification-worker").trim();
      if (assignee) {
        assert(knownAssignees.has(assignee), `assignee must be one of: ${Array.from(knownAssignees).join(", ")}`);
      }

      const timestamp = nowIso();
      const filter = assignee
        ? {
            _id: notificationId,
            mentionedAssignee: assignee
          }
        : { _id: notificationId };
      const update = {
        $set: {
          status: "delivered",
          delivered_at: timestamp,
          updated_at: timestamp
        },
        $inc: {
          attempts: 1
        },
        $unset: {
          failed_at: "",
          lastError: ""
        }
      };
      const result = await notifications.findOneAndUpdate(filter, update, { returnDocument: "after" });
      assert(result, `Notification not found or assignee mismatch: ${notificationId.toString()}`);

      await activities.insertOne(
        createActivity({
          source: "system",
          status: "ok",
          eventType: "notification_delivered",
          message: `Delivered notification ${notificationId.toString()} to ${result.mentionedAssignee}`,
          assignee: result.mentionedAssignee,
          agentId: agent,
          taskId: result.taskId ? String(result.taskId) : undefined,
          metadata: {
            notificationId: notificationId.toString(),
            messageId: result.messageId ? String(result.messageId) : undefined
          }
        })
      );

      success(`Marked notification ${notificationId.toString()} as delivered`);
      emit({ ok: true, action, notification: normalizeNotification(result) });
      return;
    }

    if (action === "notification_mark_failed") {
      const notificationId = parseObjectId(String(args["notification-id"] || ""), "notification-id");
      const assignee = args.assignee ? String(args.assignee).trim() : undefined;
      const errorMessage = String(args.error || args.reason || "").trim();
      const agent = String(args.agent || assignee || "notification-worker").trim();
      assert(errorMessage.length > 0, "error is required");
      if (assignee) {
        assert(knownAssignees.has(assignee), `assignee must be one of: ${Array.from(knownAssignees).join(", ")}`);
      }

      const timestamp = nowIso();
      const filter = assignee
        ? {
            _id: notificationId,
            mentionedAssignee: assignee
          }
        : { _id: notificationId };
      const update = {
        $set: {
          status: "failed",
          failed_at: timestamp,
          updated_at: timestamp,
          lastError: errorMessage
        },
        $inc: {
          attempts: 1
        }
      };
      const result = await notifications.findOneAndUpdate(filter, update, { returnDocument: "after" });
      assert(result, `Notification not found or assignee mismatch: ${notificationId.toString()}`);

      await activities.insertOne(
        createActivity({
          source: "system",
          status: "error",
          eventType: "notification_failed",
          message: `Failed notification ${notificationId.toString()} for ${result.mentionedAssignee}: ${errorMessage}`,
          assignee: result.mentionedAssignee,
          agentId: agent,
          taskId: result.taskId ? String(result.taskId) : undefined,
          metadata: {
            notificationId: notificationId.toString(),
            messageId: result.messageId ? String(result.messageId) : undefined,
            error: errorMessage
          }
        })
      );

      warn(`Marked notification ${notificationId.toString()} as failed`);
      emit({ ok: true, action, notification: normalizeNotification(result) });
      return;
    }

    if (action === "task_bootstrap_indexes") {
      await tasks.createIndex({ assignee: 1, status: 1, trigger_state: 1, priority: 1, created_at: 1 });
      await tasks.createIndex({ status: 1, updated_at: -1 });
      await tasks.createIndex({ trigger_state: 1, status: 1 });
      await tasks.createIndex({ dependencies: 1 });
      await documents.createIndex({ taskId: 1, created_at: -1 });
      await documents.createIndex({ assignee: 1, created_at: -1 });
      await documents.createIndex({ source: 1, created_at: -1 });
      await activities.createIndex({ assignee: 1, created_at: -1 });
      await activities.createIndex({ source: 1, created_at: -1 });
      await activities.createIndex({ eventType: 1, created_at: -1 });
      await notifications.createIndex({ mentionedAssignee: 1, status: 1, created_at: -1 });
      await notifications.createIndex({ status: 1, created_at: -1 });
      await notifications.createIndex({ taskId: 1, created_at: -1 });
      await notifications.createIndex({ messageId: 1, mentionedAssignee: 1 }, { unique: true });
      success("Ensured mission-control task, document, activity, and notification indexes");
      emit({
        ok: true,
        action,
        collections: {
          tasks: tasksCollectionName,
          documents: documentsCollectionName,
          activities: activitiesCollectionName,
          notifications: notificationsCollectionName
        }
      });
      return;
    }

    if (action === "task_review_queue") {
      const docs = await tasks.find({ status: "review" }).toArray();
      emit({ ok: true, action, tasks: docs.map(normalizeTask) });
      return;
    }

    if (action === "task_get") {
      const taskId = parseObjectId(String(args["task-id"] || ""), "task-id");
      const found = await tasks.findOne({ _id: taskId });
      assert(found, `Task not found: ${taskId.toString()}`);
      emit({ ok: true, action, task: normalizeTask(found) });
      return;
    }

    if (action === "task_reassign") {
      const taskId = parseObjectId(String(args["task-id"] || ""), "task-id");
      const assignee = String(args.assignee || "").trim();
      const agent = String(args.agent || "garry");
      assert(assignee.length > 0, "assignee is required");
      assert(knownAssignees.has(assignee), `assignee must be one of: ${Array.from(knownAssignees).join(", ")}`);
      const current = await tasks.findOne({ _id: taskId });
      assert(current, `Task not found: ${taskId.toString()}`);
      const result = await tasks.findOneAndUpdate(
        { _id: taskId },
        {
          $set: { assignee, updated_at: nowIso() },
          $push: { agent_logs: createLog(agent, `Reassigned to ${assignee}`) }
        },
        { returnDocument: "after" }
      );
      assert(result, `Task reassign failed for ${taskId.toString()}`);
      success(`Reassigned task ${taskId.toString()} to ${assignee}`);
      emit({ ok: true, action, task: normalizeTask(result) });
      return;
    }

    if (action === "task_submit") {
      // Alias for task_complete_with_output — same params: --task-id, --assignee, --summary, --link, --agent
      const taskId = parseObjectId(String(args["task-id"] || ""), "task-id");
      const assignee = String(args.assignee || "").trim();
      const summary = String(args.summary || "").trim();
      const link = String(args.link || "").trim();
      const agent = String(args.agent || assignee);
      const finalStatus = String(args["final-status"] || "review");
      assert(assignee.length > 0, "assignee is required");
      assert(summary.length > 0, "summary is required");
      assert(allowedStatuses.has(finalStatus), statusMsg(allowedStatuses));
      const current = await tasks.findOne({ _id: taskId });
      assert(current, `Task not found: ${taskId.toString()}`);
      assert(canTransition(transitions, current.status, finalStatus), `Cannot transition ${current.status} -> ${finalStatus}`);
      const result = await tasks.findOneAndUpdate(
        { _id: taskId, assignee },
        {
          $set: {
            status: finalStatus,
            output_data: { link, summary },
            updated_at: nowIso()
          },
          $push: { agent_logs: createLog(agent, `Task output submitted. Status -> ${finalStatus}`) }
        },
        { returnDocument: "after" }
      );
      assert(result, `Task assignee mismatch for ${taskId.toString()}`);
      success(`Submitted task ${taskId.toString()} to ${finalStatus}`);
      emit({ ok: true, action, task: normalizeTask(result) });
      return;
    }

    if (action === "task_list") {
      const assignee = args.assignee ? String(args.assignee).trim() : null;
      const status = args.status ? String(args.status).trim() : null;
      const limit = Math.min(Math.max(Number(args.limit) || 20, 1), 100);
      const query = {};
      if (assignee) {
        assert(knownAssignees.has(assignee), `assignee must be one of: ${Array.from(knownAssignees).join(", ")}`);
        query.assignee = assignee;
      }
      if (status) {
        assert(allowedStatuses.has(status), statusMsg(allowedStatuses));
        query.status = status;
      }
      const docs = await tasks.find(query).sort({ updated_at: -1 }).limit(limit).toArray();
      emit({ ok: true, action, tasks: docs.map(normalizeTask), count: docs.length });
      return;
    }

    if (action === "task_update") {
      const taskId = parseObjectId(String(args["task-id"] || ""), "task-id");
      const agent = String(args.agent || "garry");
      const current = await tasks.findOne({ _id: taskId });
      assert(current, `Task not found: ${taskId.toString()}`);

      const updates = {};
      if (args.status !== undefined) {
        const toStatus = String(args.status).trim();
        assert(allowedStatuses.has(toStatus), statusMsg(allowedStatuses));
        assert(canTransition(transitions, current.status, toStatus), `Cannot transition ${current.status} -> ${toStatus}`);
        updates.status = toStatus;
      }
      if (args.description !== undefined) updates.description = String(args.description).trim();
      if (args["task-name"] !== undefined) {
        const name = String(args["task-name"]).trim();
        assert(
          name.length >= 3,
          "task_name must be at least 3 characters. Provide --task-name with a descriptive title"
        );
        updates.task_name = name;
      }
      if (args.priority !== undefined) {
        const priority = String(args.priority).trim();
        assert(allowedPriorities.has(priority), `priority must be one of: ${Array.from(allowedPriorities).join(", ")}`);
        updates.priority = priority;
      }
      if (args.assignee !== undefined) {
        const assignee = String(args.assignee).trim();
        assert(knownAssignees.has(assignee), `assignee must be one of: ${Array.from(knownAssignees).join(", ")}`);
        updates.assignee = assignee;
      }
      if (Object.keys(updates).length === 0) {
        fail("At least one of --status, --description, --task-name, --priority, --assignee is required");
        process.exitCode = 1;
        return;
      }
      updates.updated_at = nowIso();

      const result = await tasks.findOneAndUpdate(
        { _id: taskId },
        {
          $set: updates,
          $push: { agent_logs: createLog(agent, `Task updated: ${Object.keys(updates).filter((k) => k !== "updated_at").join(", ")}`) }
        },
        { returnDocument: "after" }
      );
      assert(result, `Task update failed for ${taskId.toString()}`);
      success(`Updated task ${taskId.toString()}`);
      emit({ ok: true, action, task: normalizeTask(result) });
      return;
    }

    if (action === "task_set_trigger") {
      const taskId = parseObjectId(String(args["task-id"] || ""), "task-id");
      const triggerState = String(args["trigger-state"] || args.trigger_state || "").trim();
      const agent = String(args.agent || "garry");
      assert(allowedTriggers.has(triggerState), `trigger-state must be one of: ${Array.from(allowedTriggers).join(", ")}`);

      const result = await tasks.findOneAndUpdate(
        { _id: taskId },
        {
          $set: { trigger_state: triggerState, updated_at: nowIso() },
          $push: { agent_logs: createLog(agent, `trigger_state -> ${triggerState}`) }
        },
        { returnDocument: "after" }
      );
      assert(result, `Task not found: ${taskId.toString()}`);
      success(`Set task ${taskId.toString()} trigger_state to ${triggerState}`);
      emit({ ok: true, action, task: normalizeTask(result) });
      return;
    }

    throw new Error(`Unsupported action: ${action}`);
  });
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
