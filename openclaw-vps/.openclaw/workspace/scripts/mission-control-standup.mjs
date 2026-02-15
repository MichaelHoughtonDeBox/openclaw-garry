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

function getUtcBounds(dateStr) {
  const day = dateStr ? new Date(`${dateStr}T00:00:00.000Z`) : new Date();
  const start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 0, 0, 0, 0));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function formatDateLabel(date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric", timeZone: "UTC" });
}

function compactTask(task) {
  return {
    id: String(task._id),
    task_name: task.task_name,
    assignee: task.assignee,
    status: task.status,
    updated_at: task.updated_at
  };
}

function markdownList(tasks, emptyLabel = "none") {
  if (tasks.length === 0) {
    return [`- ${emptyLabel}`];
  }
  return tasks.map((task) => `- ${task.assignee}: ${task.task_name}`);
}

function renderMarkdown(payload) {
  const lines = [];
  lines.push(`📊 DAILY STANDUP — ${payload.date_label} (UTC)`);
  lines.push("");
  lines.push("✅ COMPLETED TODAY");
  lines.push(...markdownList(payload.completed_today));
  lines.push("");
  lines.push("🔄 IN PROGRESS");
  lines.push(...markdownList(payload.in_progress));
  lines.push("");
  lines.push("🚫 BLOCKED");
  lines.push(...markdownList(payload.blocked));
  lines.push("");
  lines.push("👀 NEEDS REVIEW");
  lines.push(...markdownList(payload.review));
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

  const { start, end } = getUtcBounds(args.date ? String(args.date) : "");

  const client = new MongoClient(uri);
  await client.connect();
  try {
    const tasks = client.db(dbName).collection(collectionName);

    // Completed uses updated_at as the delivery timestamp.
    const completedToday = await tasks
      .find({
        status: "done",
        updated_at: {
          $gte: start.toISOString(),
          $lt: end.toISOString()
        }
      })
      .toArray();

    const inProgress = await tasks.find({ status: "in_progress" }).toArray();
    const blocked = await tasks.find({ status: "blocked" }).toArray();
    const review = await tasks.find({ status: "review" }).toArray();

    const payload = {
      generated_at: new Date().toISOString(),
      date_label: formatDateLabel(start),
      window_start_utc: start.toISOString(),
      window_end_utc: end.toISOString(),
      completed_today: completedToday.map(compactTask),
      in_progress: inProgress.map(compactTask),
      blocked: blocked.map(compactTask),
      review: review.map(compactTask)
    };

    if (asJson) {
      process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
      return;
    }
    info(renderMarkdown(payload));
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
