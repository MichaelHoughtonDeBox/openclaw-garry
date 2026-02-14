import { MongoClient } from "mongodb"
import { getMissionEnv } from "@/lib/env"
import type {
  ActivityDocument,
  MissionDocumentRecord,
  NotificationDocument,
  TaskDocument,
  TaskMessageDocument,
} from "@/lib/mission/types"

declare global {
  var __missionMongoClientPromise: Promise<MongoClient> | undefined
  var __missionIndexesEnsured: boolean | undefined
}

function getMongoClientPromise() {
  if (global.__missionMongoClientPromise) {
    return global.__missionMongoClientPromise
  }

  const env = getMissionEnv()
  global.__missionMongoClientPromise = new MongoClient(env.mongoUri, {
    maxPoolSize: 10,
  }).connect()

  return global.__missionMongoClientPromise
}

export async function getMissionDb() {
  const env = getMissionEnv()
  const client = await getMongoClientPromise()
  return client.db(env.dbName)
}

export async function getMissionCollections() {
  const env = getMissionEnv()
  const db = await getMissionDb()
  return {
    db,
    tasks: db.collection<TaskDocument>(env.tasksCollection),
    activities: db.collection<ActivityDocument>(env.activitiesCollection),
    documents: db.collection<MissionDocumentRecord>(env.documentsCollection),
    messages: db.collection<TaskMessageDocument>(env.messagesCollection),
    notifications: db.collection<NotificationDocument>(env.notificationsCollection),
  }
}

export async function ensureMissionIndexes() {
  if (global.__missionIndexesEnsured) {
    return
  }

  const { tasks, activities, documents, messages, notifications } = await getMissionCollections()

  // Task queue indexes keep polling and status views fast.
  await tasks.createIndex({ assignee: 1, status: 1, trigger_state: 1, priority: 1, created_at: 1 })
  await tasks.createIndex({ status: 1, updated_at: -1 })
  await tasks.createIndex({ trigger_state: 1, status: 1 })
  await tasks.createIndex({ dependencies: 1 })

  // Activities indexes drive observability screens and per-agent health lookups.
  await activities.createIndex({ assignee: 1, created_at: -1 })
  await activities.createIndex({ source: 1, created_at: -1 })
  await activities.createIndex({ jobId: 1, created_at: -1 })
  await activities.createIndex({ taskId: 1, created_at: -1 })
  await activities.createIndex({ eventType: 1, created_at: -1 })
  await activities.createIndex({ dedupeKey: 1 }, { unique: true, sparse: true })

  // Document indexes support task traversal and per-agent views.
  await documents.createIndex({ taskId: 1, created_at: -1 })
  await documents.createIndex({ linked_task_ids: 1, created_at: -1 })
  await documents.createIndex({ assignee: 1, created_at: -1 })
  await documents.createIndex({ source: 1, created_at: -1 })
  await documents.createIndex({ agentId: 1, created_at: -1 })

  // Thread indexes keep task discussion queries deterministic and cheap.
  await messages.createIndex({ taskId: 1, created_at: -1 })
  await messages.createIndex({ mentions: 1, created_at: -1 })
  await messages.createIndex({ authorAssignee: 1, created_at: -1 })

  // Notification indexes optimize worker polling and idempotent fan-out inserts.
  await notifications.createIndex({ mentionedAssignee: 1, status: 1, created_at: -1 })
  await notifications.createIndex({ status: 1, created_at: -1 })
  await notifications.createIndex({ taskId: 1, created_at: -1 })
  await notifications.createIndex({ messageId: 1, mentionedAssignee: 1 }, { unique: true })

  global.__missionIndexesEnsured = true
}
