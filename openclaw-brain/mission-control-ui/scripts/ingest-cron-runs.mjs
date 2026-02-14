#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { MongoClient } from "mongodb"

const color = {
  reset: "\u001b[0m",
  cyan: "\u001b[36m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  red: "\u001b[31m",
}

function info(message) {
  process.stdout.write(`${color.cyan}${message}${color.reset}\n`)
}

function success(message) {
  process.stdout.write(`${color.green}${message}${color.reset}\n`)
}

function warn(message) {
  process.stdout.write(`${color.yellow}${message}${color.reset}\n`)
}

function fail(message) {
  process.stderr.write(`${color.red}${message}${color.reset}\n`)
}

function parseEnvText(content) {
  const env = {}
  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue
    }
    const separator = trimmed.indexOf("=")
    const key = trimmed.slice(0, separator).trim()
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "")
    env[key] = value
  }
  return env
}

async function loadEnvFile(filePath) {
  try {
    return parseEnvText(await readFile(filePath, "utf8"))
  } catch {
    return {}
  }
}

function deriveAssignee(sessionKey = "") {
  if (sessionKey.includes("agent:corey:")) {
    return "corey"
  }
  if (sessionKey.includes("agent:tony:")) {
    return "tony"
  }
  if (sessionKey.includes("agent:main:")) {
    return "garry"
  }
  return undefined
}

async function main() {
  const rootDir = process.cwd()
  const env = {
    ...(await loadEnvFile(path.join(rootDir, ".env"))),
    ...(await loadEnvFile(path.join(rootDir, ".env.local"))),
    ...process.env,
  }

  const mongoUri = env.MISSION_CONTROL_MONGO_URI
  if (!mongoUri) {
    throw new Error("MISSION_CONTROL_MONGO_URI is required")
  }

  const dbName = env.MISSION_CONTROL_DB || "mission-control"
  const activitiesCollection = env.MISSION_CONTROL_ACTIVITIES_COLLECTION || "activities"
  const runsDir = env.OPENCLAW_CRON_RUNS_DIR || "/root/.openclaw/cron/runs"

  info(`Reading cron run files from ${runsDir}`)
  const files = (await readdir(runsDir)).filter((name) => name.endsWith(".jsonl"))
  if (files.length === 0) {
    warn("No cron run files found. Nothing to ingest.")
    return
  }

  const client = new MongoClient(mongoUri)
  await client.connect()
  const collection = client.db(dbName).collection(activitiesCollection)

  try {
    let insertedCount = 0
    for (const fileName of files) {
      const filePath = path.join(runsDir, fileName)
      const lines = (await readFile(filePath, "utf8"))
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)

      for (const line of lines) {
        let parsed
        try {
          parsed = JSON.parse(line)
        } catch {
          // Skip corrupt lines but keep ingest running.
          warn(`Skipping invalid JSON line in ${fileName}`)
          continue
        }

        const dedupeKey = `${parsed.jobId ?? "unknown"}:${parsed.ts ?? parsed.runAtMs ?? "na"}:${parsed.sessionId ?? "na"}`
        const assignee = deriveAssignee(parsed.sessionKey ?? "")
        const status =
          parsed.status === "ok" || parsed.status === "error" || parsed.status === "skipped"
            ? parsed.status
            : "info"

        const result = await collection.updateOne(
          { dedupeKey },
          {
            $setOnInsert: {
              source: "cron",
              status,
              eventType: `cron_${parsed.action ?? "event"}`,
              message: parsed.summary || `Cron ${parsed.action ?? "run"} (${status})`,
              dedupeKey,
              assignee,
              jobId: parsed.jobId,
              sessionKey: parsed.sessionKey,
              metadata: {
                runAtMs: parsed.runAtMs,
                durationMs: parsed.durationMs,
                nextRunAtMs: parsed.nextRunAtMs,
                sessionId: parsed.sessionId,
                fileName,
              },
              created_at: parsed.ts ? new Date(parsed.ts).toISOString() : new Date().toISOString(),
            },
          },
          { upsert: true },
        )

        if (result.upsertedCount > 0) {
          insertedCount += 1
        }
      }
    }

    success(`Cron ingest complete. Inserted ${insertedCount} new activity events.`)
  } finally {
    await client.close()
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
