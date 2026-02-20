#!/usr/bin/env node

import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { MongoClient, ObjectId } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";

const color = {
  reset: "\u001b[0m",
  green: "\u001b[32m",
  red: "\u001b[31m",
  cyan: "\u001b[36m"
};

function info(message) {
  process.stdout.write(`${color.cyan}${message}${color.reset}\n`);
}

function success(message) {
  process.stdout.write(`${color.green}${message}${color.reset}\n`);
}

function fail(message) {
  process.stderr.write(`${color.red}${message}${color.reset}\n`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function runCli(scriptDir, mongoUri, args) {
  return new Promise((resolve, reject) => {
    // Run the production CLI exactly how agents will execute it.
    const child = spawn("node", ["./mission-control-cli.mjs", ...args, "--mongo-uri", mongoUri, "--json"], {
      cwd: scriptDir,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`CLI failed (${args[0]}): ${stderr || stdout}`));
        return;
      }
      try {
        // CLI can emit colored status lines before JSON; parse the trailing JSON block safely.
        const cleaned = stdout.replace(/\u001b\[[0-9;]*m/g, "").trim();
        const jsonStart = cleaned.indexOf("{");
        if (jsonStart < 0) {
          throw new Error(`No JSON payload found in output: ${cleaned}`);
        }
        const parsed = JSON.parse(cleaned.slice(jsonStart));
        resolve(parsed);
      } catch (error) {
        reject(new Error(`Failed to parse CLI JSON (${args[0]}): ${stdout}\n${String(error)}`));
      }
    });
  });
}

async function main() {
  const scriptDir = process.cwd();
  const memoryMongo = await MongoMemoryServer.create();
  const mongoUri = memoryMongo.getUri();
  const mongoClient = new MongoClient(mongoUri);

  info("Running mission control smoke test with in-memory MongoDB...");

  try {
    await mongoClient.connect();
    const tasks = mongoClient.db("mission-control").collection("tasks");
    const documents = mongoClient.db("mission-control").collection("documents");
    const activities = mongoClient.db("mission-control").collection("activities");
    const notifications = mongoClient.db("mission-control").collection("notifications");

    await runCli(scriptDir, mongoUri, ["task_bootstrap_indexes"]);

    const createCorey = await runCli(scriptDir, mongoUri, [
      "task_create",
      "--task-name",
      "Corey task",
      "--description",
      "Corey validates onboarding funnel issues.",
      "--assignee",
      "corey",
      "--priority",
      "urgent"
    ]);
    const coreyTaskId = createCorey.insertedId;

    const createTony = await runCli(scriptDir, mongoUri, [
      "task_create",
      "--task-name",
      "Tony dependent task",
      "--description",
      "Tony ships engineering changes after Corey analysis.",
      "--assignee",
      "tony",
      "--priority",
      "normal",
      "--trigger-state",
      "WAITING",
      "--dependencies",
      coreyTaskId
    ]);
    const tonyTaskId = createTony.insertedId;

    const coreyPoll = await runCli(scriptDir, mongoUri, ["task_poll_ready_for_assignee", "--assignee", "corey", "--limit", "1"]);
    assert(coreyPoll.tasks.length === 1, "Corey should see one READY task");
    assert(coreyPoll.tasks[0]._id === coreyTaskId, "Corey polled unexpected task");

    const firstClaim = await runCli(scriptDir, mongoUri, ["task_claim", "--task-id", coreyTaskId, "--assignee", "corey", "--agent", "corey"]);
    assert(firstClaim.claimed === true, "Corey should claim the task");
    const secondClaim = await runCli(scriptDir, mongoUri, ["task_claim", "--task-id", coreyTaskId, "--assignee", "corey", "--agent", "corey"]);
    assert(secondClaim.claimed === false, "Second claim should be rejected for idempotency");

    await runCli(scriptDir, mongoUri, [
      "task_append_log",
      "--task-id",
      coreyTaskId,
      "--agent",
      "corey",
      "--message",
      "Completed onboarding analysis deliverable."
    ]);

    const coreyDocument = await runCli(scriptDir, mongoUri, [
      "document_create",
      "--task-id",
      coreyTaskId,
      "--assignee",
      "corey",
      "--agent",
      "corey",
      "--title",
      "Corey onboarding findings",
      "--content-md",
      "# Findings\n\n- Drop-off happens on step 2.\n- Primary cause is unclear pricing.",
      "--source",
      "agent"
    ]);
    const coreyDocumentId = coreyDocument.document?._id;
    assert(Boolean(coreyDocumentId), "Document create should return inserted document id");

    await runCli(scriptDir, mongoUri, [
      "task_complete_with_output",
      "--task-id",
      coreyTaskId,
      "--assignee",
      "corey",
      "--agent",
      "corey",
      "--summary",
      "Corey finished analysis and posted recommendations.",
      "--link",
      `mongo://documents/${coreyDocumentId}`,
      "--final-status",
      "review"
    ]);

    await runCli(scriptDir, mongoUri, [
      "task_transition_status",
      "--task-id",
      coreyTaskId,
      "--to-status",
      "done",
      "--agent",
      "garry",
      "--note",
      "Reviewed and approved."
    ]);

    const release = await runCli(scriptDir, mongoUri, ["task_release_dependencies", "--agent", "garry"]);
    assert(release.released === 1, "Exactly one dependency-gated task should be released");

    const tonyPoll = await runCli(scriptDir, mongoUri, ["task_poll_ready_for_assignee", "--assignee", "tony", "--limit", "1"]);
    assert(tonyPoll.tasks.length === 1, "Tony should see one READY task after release");
    assert(tonyPoll.tasks[0]._id === tonyTaskId, "Tony polled unexpected task");

    const tonyClaim = await runCli(scriptDir, mongoUri, ["task_claim", "--task-id", tonyTaskId, "--assignee", "tony", "--agent", "tony"]);
    assert(tonyClaim.claimed === true, "Tony should claim the released task");

    await runCli(scriptDir, mongoUri, [
      "task_mark_blocked",
      "--task-id",
      tonyTaskId,
      "--assignee",
      "tony",
      "--agent",
      "tony",
      "--reason",
      "Waiting for deployment window."
    ]);

    // Validate auditable history by checking both tasks have logs.
    const docs = await tasks.find({}).toArray();
    const coreyTask = docs.find((doc) => String(doc._id) === coreyTaskId);
    const tonyTask = docs.find((doc) => String(doc._id) === tonyTaskId);
    assert((coreyTask?.agent_logs?.length || 0) >= 3, "Corey task should have an auditable log trail");
    assert((tonyTask?.agent_logs?.length || 0) >= 2, "Tony task should have an auditable log trail");
    assert(
      (coreyTask?.linked_document_ids || []).some((documentId) => String(documentId) === coreyDocumentId),
      "Corey task should have linked document id"
    );

    const persistedDocument = await documents.findOne({ _id: new ObjectId(coreyDocumentId) });
    assert(Boolean(persistedDocument), "Backed document should be persisted");
    assert(String(persistedDocument.taskId) === coreyTaskId, "Document should reference the linked task");

    const documentActivities = await activities
      .find({
        eventType: { $in: ["document_created", "task_linked_document"] },
        assignee: "corey"
      })
      .toArray();
    assert(documentActivities.length >= 2, "Document lifecycle events should be emitted to activities");

    // Simulate @all mention fan-out by seeding two recipient notifications for one message.
    const fanoutMessageId = new ObjectId();
    const coreyNotificationId = new ObjectId();
    const tonyNotificationId = new ObjectId();
    const notificationTimestamp = new Date().toISOString();
    await notifications.insertMany([
      {
        _id: coreyNotificationId,
        taskId: new ObjectId(coreyTaskId),
        messageId: fanoutMessageId,
        mentionedAssignee: "corey",
        status: "pending",
        content: "@all Please review the latest artifacts.",
        attempts: 0,
        created_at: notificationTimestamp,
        updated_at: notificationTimestamp
      },
      {
        _id: tonyNotificationId,
        taskId: new ObjectId(coreyTaskId),
        messageId: fanoutMessageId,
        mentionedAssignee: "tony",
        status: "pending",
        content: "@all Please review the latest artifacts.",
        attempts: 0,
        created_at: notificationTimestamp,
        updated_at: notificationTimestamp
      }
    ]);

    const coreyNotificationPoll = await runCli(scriptDir, mongoUri, [
      "notification_poll_for_assignee",
      "--assignee",
      "corey",
      "--status",
      "pending",
      "--limit",
      "5"
    ]);
    assert(coreyNotificationPoll.notifications.length === 1, "Corey should see one pending notification");
    assert(
      coreyNotificationPoll.notifications[0]._id === coreyNotificationId.toString(),
      "Corey polled unexpected notification"
    );

    await runCli(scriptDir, mongoUri, [
      "notification_mark_delivered",
      "--notification-id",
      coreyNotificationId.toString(),
      "--assignee",
      "corey",
      "--agent",
      "corey"
    ]);
    await runCli(scriptDir, mongoUri, [
      "notification_mark_failed",
      "--notification-id",
      tonyNotificationId.toString(),
      "--assignee",
      "tony",
      "--agent",
      "tony",
      "--error",
      "Agent session unavailable."
    ]);

    const updatedCoreyNotification = await notifications.findOne({ _id: coreyNotificationId });
    const updatedTonyNotification = await notifications.findOne({ _id: tonyNotificationId });
    assert(updatedCoreyNotification?.status === "delivered", "Corey notification should be marked delivered");
    assert(updatedCoreyNotification?.attempts === 1, "Corey notification attempts should increment");
    assert(updatedTonyNotification?.status === "failed", "Tony notification should be marked failed");
    assert(updatedTonyNotification?.attempts === 1, "Tony notification attempts should increment");
    assert(updatedTonyNotification?.lastError === "Agent session unavailable.", "Tony failure reason should persist");

    const notificationActivities = await activities
      .find({
        eventType: { $in: ["notification_delivered", "notification_failed"] }
      })
      .toArray();
    assert(notificationActivities.length >= 2, "Notification delivery outcomes should be emitted to activities");

    // Stale in_progress poll: returns empty when no tasks match (corey/tony tasks are done/blocked, not stale in_progress).
    const coreyStalePoll = await runCli(scriptDir, mongoUri, [
      "task_poll_stale_in_progress_for_assignee",
      "--assignee",
      "corey",
      "--stale-minutes",
      "60",
      "--limit",
      "1"
    ]);
    assert(Array.isArray(coreyStalePoll.tasks), "Stale poll should return tasks array");
    assert(coreyStalePoll.tasks.length === 0, "Corey should see no stale in_progress tasks (his task is done)");

    const tonyStalePoll = await runCli(scriptDir, mongoUri, [
      "task_poll_stale_in_progress_for_assignee",
      "--assignee",
      "tony",
      "--stale-minutes",
      "60",
      "--limit",
      "1"
    ]);
    assert(Array.isArray(tonyStalePoll.tasks), "Stale poll should return tasks array");
    assert(tonyStalePoll.tasks.length === 0, "Tony should see no stale in_progress tasks (his task is blocked, not in_progress)");

    success("Smoke test passed: task, document, notification, stale-poll, and observability flows are working.");
  } finally {
    await mongoClient.close();
    await memoryMongo.stop();
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
