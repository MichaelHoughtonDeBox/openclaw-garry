#!/usr/bin/env node

/**
 * Seeds the first Mission Control auth user into MongoDB.
 * Run with: MISSION_CONTROL_MONGO_URI=... MISSION_CONTROL_SESSION_SECRET=... node scripts/seed-auth-user.mjs <username> <password>
 *
 * Optional: MISSION_CONTROL_PASSWORD_PEPPER for extra password security.
 * Optional: MISSION_CONTROL_DB, MISSION_CONTROL_USERS_COLLECTION
 */

import { readFile } from "node:fs/promises"
import { join } from "node:path"
import process from "node:process"
import { MongoClient } from "mongodb"
import bcrypt from "bcryptjs"

const SALT_ROUNDS = 12

const color = {
  reset: "\u001b[0m",
  cyan: "\u001b[36m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  red: "\u001b[31m",
}

function info(msg) {
  process.stdout.write(`${color.cyan}${msg}${color.reset}\n`)
}
function success(msg) {
  process.stdout.write(`${color.green}${msg}${color.reset}\n`)
}
function fail(msg) {
  process.stderr.write(`${color.red}${msg}${color.reset}\n`)
}

function parseEnvText(content) {
  const env = {}
  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue
    const sep = trimmed.indexOf("=")
    const key = trimmed.slice(0, sep).trim()
    const value = trimmed.slice(sep + 1).trim().replace(/^['"]|['"]$/g, "")
    env[key] = value
  }
  return env
}

async function loadEnv() {
  const candidates = [
    join(process.cwd(), ".env.local"),
    join(process.cwd(), ".env"),
  ]
  for (const p of candidates) {
    try {
      const content = await readFile(p, "utf8")
      const parsed = parseEnvText(content)
      for (const [k, v] of Object.entries(parsed)) {
        if (!(k in process.env) || process.env[k] === "") {
          process.env[k] = v
        }
      }
      info(`Loaded env from ${p}`)
      break
    } catch {
      // ignore
    }
  }
}

async function main() {
  await loadEnv()

  const mongoUri = process.env.MISSION_CONTROL_MONGO_URI
  const sessionSecret = process.env.MISSION_CONTROL_SESSION_SECRET
  const pepper = process.env.MISSION_CONTROL_PASSWORD_PEPPER ?? ""
  const dbName = process.env.MISSION_CONTROL_DB ?? "mission-control"
  const usersCollection = process.env.MISSION_CONTROL_USERS_COLLECTION ?? "users"

  const username = process.argv[2]
  const password = process.argv[3]

  if (!mongoUri) {
    fail("MISSION_CONTROL_MONGO_URI is required")
    process.exit(1)
  }
  if (!sessionSecret || sessionSecret.length < 32) {
    fail("MISSION_CONTROL_SESSION_SECRET is required and must be at least 32 characters")
    process.exit(1)
  }
  if (!username || !password) {
    fail("Usage: node scripts/seed-auth-user.mjs <username> <password>")
    process.exit(1)
  }
  if (password.length < 8) {
    fail("Password must be at least 8 characters")
    process.exit(1)
  }

  const normalized = username.trim().toLowerCase()
  if (normalized.length < 2) {
    fail("Username must be at least 2 characters")
    process.exit(1)
  }

  const toHash = pepper ? `${pepper}${password}` : password
  const passwordHash = await bcrypt.hash(toHash, SALT_ROUNDS)

  const client = new MongoClient(mongoUri)
  try {
    await client.connect()
    const db = client.db(dbName)
    const users = db.collection(usersCollection)

    await users.createIndex({ username: 1 }, { unique: true })

    const existing = await users.findOne({ username: normalized })
    if (existing) {
      fail(`User "${normalized}" already exists.`)
      process.exit(1)
    }

    const now = new Date().toISOString()
    await users.insertOne({
      username: normalized,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    })

    success(`Created user "${normalized}" successfully.`)
  } finally {
    await client.close()
  }
}

main().catch((err) => {
  fail(err.message ?? String(err))
  process.exit(1)
})
