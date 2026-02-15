#!/usr/bin/env node

import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { MongoClient, ObjectId } from "mongodb";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const color = {
  reset: "\u001b[0m",
  red: "\u001b[31m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  cyan: "\u001b[36m"
};

const KNOWN_ASSIGNEES = new Set([
  "garry",
  "corey",
  "tony",
  "michael",
  "shuri",
  "ralph",
  "vision",
  "loki",
  "quill",
  "wanda",
  "pepper",
  "friday",
  "wong"
]);

const MARKDOWN_EXTENSIONS = new Set([".md", ".markdown", ".mdx"]);

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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
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
    // Env files are optional in local environments.
  }
}

async function bootstrapEnv(workspaceRoot) {
  await loadEnvFile(path.join(workspaceRoot, ".env"));
  await loadEnvFile(path.join(workspaceRoot, ".env.local"));
}

async function listMarkdownFilesRecursively(startDir) {
  const discovered = [];
  const entries = await readdir(startDir, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(startDir, entry.name);
    if (entry.isDirectory()) {
      const nested = await listMarkdownFilesRecursively(absolutePath);
      discovered.push(...nested);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (MARKDOWN_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      discovered.push(absolutePath);
    }
  }
  return discovered;
}

function inferAssignee(workspaceDirName) {
  if (workspaceDirName === "workspace") {
    return "garry";
  }
  if (workspaceDirName.startsWith("workspace-")) {
    const candidate = workspaceDirName.slice("workspace-".length).trim().toLowerCase();
    if (KNOWN_ASSIGNEES.has(candidate)) {
      return candidate;
    }
  }
  return "garry";
}

function inferTitle(filePath, content) {
  const headingMatch = content.match(/^#\s+(.+)$/m);
  if (headingMatch?.[1]) {
    return headingMatch[1].trim().slice(0, 200);
  }
  return path.basename(filePath, path.extname(filePath)).replace(/[-_]+/g, " ").slice(0, 200);
}

function inferTaskId(content, importPath) {
  // Prefer explicit task id markers in content before using path heuristics.
  const contentMatch = content.match(/task[_\s-]?id\s*[:=]\s*([a-fA-F0-9]{24})/i);
  if (contentMatch?.[1]) {
    return contentMatch[1];
  }
  const pathMatch = importPath.match(/([a-fA-F0-9]{24})/);
  if (pathMatch?.[1]) {
    return pathMatch[1];
  }
  return undefined;
}

function nowIso() {
  return new Date().toISOString();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const workspaceRoot = path.resolve(__dirname, "..");
  await bootstrapEnv(workspaceRoot);

  const mongoUri = String(args["mongo-uri"] || process.env.MISSION_CONTROL_MONGO_URI || "");
  assert(mongoUri, "MISSION_CONTROL_MONGO_URI is required (or pass --mongo-uri)");

  const dbName = String(args.db || process.env.MISSION_CONTROL_DB || "mission-control");
  const tasksCollectionName = String(args["tasks-collection"] || process.env.MISSION_CONTROL_TASKS_COLLECTION || "tasks");
  const documentsCollectionName = String(
    args["documents-collection"] || process.env.MISSION_CONTROL_DOCUMENTS_COLLECTION || "documents"
  );
  const activitiesCollectionName = String(
    args["activities-collection"] || process.env.MISSION_CONTROL_ACTIVITIES_COLLECTION || "activities"
  );
  const rootDir = path.resolve(args["root-dir"] || path.join(workspaceRoot, ".."));
  const dryRun = Boolean(args["dry-run"]);

  const rootEntries = await readdir(rootDir, { withFileTypes: true });
  const workspaceDirs = rootEntries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("workspace"))
    .map((entry) => path.join(rootDir, entry.name));

  assert(workspaceDirs.length > 0, `No workspace directories found under ${rootDir}`);

  const candidateFiles = [];
  for (const workspaceDir of workspaceDirs) {
    for (const folder of ["drafts", "memory"]) {
      const folderPath = path.join(workspaceDir, folder);
      try {
        const folderStats = await stat(folderPath);
        if (!folderStats.isDirectory()) {
          continue;
        }
      } catch {
        continue;
      }
      const files = await listMarkdownFilesRecursively(folderPath);
      candidateFiles.push(...files);
    }
  }

  info(`Discovered ${candidateFiles.length} markdown files under drafts/ and memory/.`);
  if (candidateFiles.length === 0) {
    success("Nothing to backfill.");
    return;
  }

  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db(dbName);
  const tasks = db.collection(tasksCollectionName);
  const documents = db.collection(documentsCollectionName);
  const activities = db.collection(activitiesCollectionName);

  let scanned = 0;
  let inserted = 0;
  let linked = 0;
  let skippedExisting = 0;
  let skippedEmpty = 0;
  let unresolvedTaskRefs = 0;

  try {
    for (const absolutePath of candidateFiles) {
      scanned += 1;
      const importPath = path.relative(rootDir, absolutePath).split(path.sep).join("/");

      const existing = await documents.countDocuments(
        {
          source: "import",
          "metadata.importPath": importPath
        },
        { limit: 1 }
      );
      if (existing > 0) {
        skippedExisting += 1;
        continue;
      }

      const contentMd = String(await readFile(absolutePath, "utf8"));
      if (!contentMd.trim()) {
        skippedEmpty += 1;
        continue;
      }

      const workspaceName = importPath.split("/")[0] || "workspace";
      const assignee = inferAssignee(workspaceName);
      const agentId = assignee;
      const inferredTaskId = inferTaskId(contentMd, importPath);
      let taskObjectId;
      if (inferredTaskId && ObjectId.isValid(inferredTaskId)) {
        const taskExists = await tasks.countDocuments({ _id: new ObjectId(inferredTaskId) }, { limit: 1 });
        if (taskExists > 0) {
          taskObjectId = new ObjectId(inferredTaskId);
        } else {
          unresolvedTaskRefs += 1;
        }
      } else if (inferredTaskId) {
        unresolvedTaskRefs += 1;
      }

      const fileStats = await stat(absolutePath);
      const title = inferTitle(absolutePath, contentMd);
      const timestamp = nowIso();
      const documentPayload = {
        title,
        contentMd,
        assignee,
        agentId,
        taskId: taskObjectId,
        source: "import",
        created_at: timestamp,
        updated_at: timestamp,
        metadata: {
          importPath,
          importedBy: "mission-control-backfill",
          importedAt: timestamp,
          fileModifiedAt: fileStats.mtime.toISOString(),
          inferredTaskId: inferredTaskId || null
        }
      };

      if (dryRun) {
        info(`[dry-run] Would import: ${importPath}`);
        continue;
      }

      const insertedResult = await documents.insertOne(documentPayload);
      inserted += 1;

      if (taskObjectId) {
        linked += 1;
        await tasks.updateOne(
          { _id: taskObjectId },
          {
            $set: { updated_at: timestamp },
            $addToSet: { linked_document_ids: insertedResult.insertedId },
            $push: {
              agent_logs: {
                timestamp,
                agent: "migration",
                message: `Backfilled document ${insertedResult.insertedId.toString()} from ${importPath}`
              }
            }
          }
        );
      }

      await activities.insertOne({
        source: "document",
        status: "ok",
        eventType: "document_backfilled",
        message: `Imported markdown artifact from ${importPath}`,
        assignee,
        agentId: "migration",
        taskId: taskObjectId ? taskObjectId.toString() : undefined,
        metadata: {
          importPath,
          documentId: insertedResult.insertedId.toString()
        },
        created_at: timestamp
      });
    }
  } finally {
    await client.close();
  }

  success("Backfill complete.");
  info(`Scanned files: ${scanned}`);
  info(`Inserted documents: ${inserted}`);
  info(`Linked to tasks: ${linked}`);
  info(`Skipped existing imports: ${skippedExisting}`);
  info(`Skipped empty files: ${skippedEmpty}`);
  if (unresolvedTaskRefs > 0) {
    warn(`Unresolved inferred task references: ${unresolvedTaskRefs}`);
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
