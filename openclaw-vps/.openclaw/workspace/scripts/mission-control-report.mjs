#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { MongoClient } from "mongodb";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const color = {
  reset: "\u001b[0m",
  cyan: "\u001b[36m",
  red: "\u001b[31m"
};

function info(message) {
  process.stdout.write(`${color.cyan}${message}${color.reset}\n`);
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

async function loadEnv(workspaceRoot) {
  for (const envName of [".env", ".env.local"]) {
    try {
      const content = await readFile(path.join(workspaceRoot, envName), "utf8");
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
      // Env files are optional in local clones.
    }
  }
}

function latestBlockReason(task) {
  const logs = task.agent_logs || [];
  for (let index = logs.length - 1; index >= 0; index -= 1) {
    const message = String(logs[index]?.message || "");
    if (message.startsWith("Blocked:")) {
      return message.replace("Blocked:", "").trim();
    }
  }
  return "No blocker reason logged";
}

function normalizeTask(task) {
  return {
    id: String(task._id),
    task_name: task.task_name,
    assignee: task.assignee,
    status: task.status,
    priority: task.priority,
    trigger_state: task.trigger_state,
    updated_at: task.updated_at
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push(`# Mission Control Snapshot (${report.generated_at})`);
  lines.push("");
  lines.push("## READY Tasks By Assignee");
  for (const [assignee, count] of Object.entries(report.ready_by_assignee)) {
    lines.push(`- ${assignee}: ${count}`);
  }
  if (Object.keys(report.ready_by_assignee).length === 0) {
    lines.push("- none");
  }

  lines.push("");
  lines.push("## Blocked Tasks");
  if (report.blocked_tasks.length === 0) {
    lines.push("- none");
  } else {
    for (const task of report.blocked_tasks) {
      lines.push(`- ${task.task_name} (${task.assignee}) - ${task.blocker}`);
    }
  }

  lines.push("");
  lines.push("## Review Queue");
  if (report.review_tasks.length === 0) {
    lines.push("- none");
  } else {
    for (const task of report.review_tasks) {
      lines.push(`- ${task.task_name} (${task.assignee})`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const workspaceRoot = path.resolve(__dirname, "..");
  await loadEnv(workspaceRoot);

  const uri = String(args["mongo-uri"] || process.env.MISSION_CONTROL_MONGO_URI || "");
  if (!uri) {
    throw new Error("MISSION_CONTROL_MONGO_URI is required (or pass --mongo-uri)");
  }
  const dbName = String(args.db || process.env.MISSION_CONTROL_DB || "mission-control");
  const collectionName = String(args.collection || process.env.MISSION_CONTROL_TASKS_COLLECTION || "tasks");
  const asJson = Boolean(args.json);

  const client = new MongoClient(uri);
  await client.connect();
  try {
    const tasks = client.db(dbName).collection(collectionName);

    // READY queue visibility drives who can pick up work now.
    const readyTasks = await tasks.find({ status: "todo", trigger_state: "READY" }).toArray();
    const readyByAssignee = {};
    for (const task of readyTasks) {
      readyByAssignee[task.assignee] = (readyByAssignee[task.assignee] || 0) + 1;
    }

    const blocked = await tasks.find({ status: "blocked" }).toArray();
    const review = await tasks.find({ status: "review" }).toArray();

    const report = {
      generated_at: new Date().toISOString(),
      ready_by_assignee: readyByAssignee,
      blocked_tasks: blocked.map((task) => ({ ...normalizeTask(task), blocker: latestBlockReason(task) })),
      review_tasks: review.map(normalizeTask)
    };

    if (asJson) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return;
    }
    info(renderMarkdown(report));
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
