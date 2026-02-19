import type { ObjectId } from "mongodb"
import { getMissionDb } from "@/lib/mongodb"
import { getMissionEnv } from "@/lib/env"

export type AuthUserDocument = {
  _id?: ObjectId
  username: string
  passwordHash: string
  createdAt: string
  updatedAt: string
}

export type AuthUser = Omit<AuthUserDocument, "_id"> & {
  id: string
}

let usersIndexEnsured = false

async function getUsersCollection() {
  const env = getMissionEnv()
  const db = await getMissionDb()
  return db.collection<AuthUserDocument>(env.usersCollection)
}

/**
 * Ensures the unique index on username exists. Idempotent.
 */
export async function ensureUsersIndex() {
  if (usersIndexEnsured) {
    return
  }
  const users = await getUsersCollection()
  await users.createIndex({ username: 1 }, { unique: true })
  usersIndexEnsured = true
}

/**
 * Finds a user by username (case-insensitive lookup uses lowercase).
 *
 * @param username - Login username (will be lowercased for lookup)
 * @returns User document or null
 */
export async function findUserByUsername(username: string): Promise<AuthUser | null> {
  const users = await getUsersCollection()
  const normalized = username.trim().toLowerCase()
  if (!normalized) {
    return null
  }
  const doc = await users.findOne({ username: normalized })
  if (!doc || !doc._id) {
    return null
  }
  return {
    id: doc._id.toString(),
    username: doc.username,
    passwordHash: doc.passwordHash,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

/**
 * Inserts a new user. Call ensureUsersIndex() before first use.
 *
 * @param username - Login username (stored lowercase)
 * @param passwordHash - Bcrypt hash of (peppered) password
 * @returns Created user
 * @throws If username already exists
 */
export async function createUser(
  username: string,
  passwordHash: string,
): Promise<AuthUser> {
  await ensureUsersIndex()
  const users = await getUsersCollection()
  const normalized = username.trim().toLowerCase()
  if (!normalized || normalized.length < 2) {
    throw new Error("Username must be at least 2 characters")
  }
  const now = new Date().toISOString()
  const doc: AuthUserDocument = {
    username: normalized,
    passwordHash,
    createdAt: now,
    updatedAt: now,
  }
  try {
    const result = await users.insertOne(doc)
    if (!result.acknowledged || !result.insertedId) {
      throw new Error("Failed to create user")
    }
    return {
      id: result.insertedId.toString(),
      username: doc.username,
      passwordHash: doc.passwordHash,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }
  } catch (err: unknown) {
    const mongoErr = err as { code?: number }
    if (mongoErr.code === 11000) {
      throw new Error("Username already exists")
    }
    throw err
  }
}
