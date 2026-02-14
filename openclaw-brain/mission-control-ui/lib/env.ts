import { z } from "zod"

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback
  }
  return value === "1" || value.toLowerCase() === "true"
}

const rawEnvSchema = z.object({
  MISSION_CONTROL_MONGO_URI: z.string().min(1, "MISSION_CONTROL_MONGO_URI is required"),
  MISSION_CONTROL_DB: z.string().min(1).optional(),
  MISSION_CONTROL_TASKS_COLLECTION: z.string().min(1).optional(),
  MISSION_CONTROL_ACTIVITIES_COLLECTION: z.string().min(1).optional(),
  MISSION_CONTROL_DOCUMENTS_COLLECTION: z.string().min(1).optional(),
  MISSION_CONTROL_MESSAGES_COLLECTION: z.string().min(1).optional(),
  MISSION_CONTROL_NOTIFICATIONS_COLLECTION: z.string().min(1).optional(),
  MISSION_CONTROL_AUTH_ENABLED: z.string().optional(),
  MISSION_CONTROL_AUTH_USER: z.string().optional(),
  MISSION_CONTROL_AUTH_PASSWORD: z.string().optional(),
  MISSION_CONTROL_MUTATION_SECRET: z.string().optional(),
  MISSION_CONTROL_INGEST_TOKEN: z.string().optional(),
  MISSION_CONTROL_POLL_INTERVAL_MS: z.string().optional(),
})

export type MissionEnv = {
  mongoUri: string
  dbName: string
  tasksCollection: string
  activitiesCollection: string
  documentsCollection: string
  messagesCollection: string
  notificationsCollection: string
  authEnabled: boolean
  authUser: string
  authPassword: string
  mutationSecret: string
  ingestToken: string
  pollIntervalMs: number
}

let cachedEnv: MissionEnv | null = null

export function getMissionEnv(): MissionEnv {
  if (cachedEnv) {
    return cachedEnv
  }

  const parsed = rawEnvSchema.parse(process.env)
  const pollIntervalRaw = Number.parseInt(parsed.MISSION_CONTROL_POLL_INTERVAL_MS ?? "7000", 10)

  cachedEnv = {
    mongoUri: parsed.MISSION_CONTROL_MONGO_URI,
    dbName: parsed.MISSION_CONTROL_DB ?? "mission-control",
    tasksCollection: parsed.MISSION_CONTROL_TASKS_COLLECTION ?? "tasks",
    activitiesCollection: parsed.MISSION_CONTROL_ACTIVITIES_COLLECTION ?? "activities",
    documentsCollection: parsed.MISSION_CONTROL_DOCUMENTS_COLLECTION ?? "documents",
    messagesCollection: parsed.MISSION_CONTROL_MESSAGES_COLLECTION ?? "messages",
    notificationsCollection: parsed.MISSION_CONTROL_NOTIFICATIONS_COLLECTION ?? "notifications",
    authEnabled: parseBoolean(parsed.MISSION_CONTROL_AUTH_ENABLED, false),
    authUser: parsed.MISSION_CONTROL_AUTH_USER ?? "admin",
    authPassword: parsed.MISSION_CONTROL_AUTH_PASSWORD ?? "",
    mutationSecret: parsed.MISSION_CONTROL_MUTATION_SECRET ?? "",
    ingestToken: parsed.MISSION_CONTROL_INGEST_TOKEN ?? "",
    pollIntervalMs: Number.isFinite(pollIntervalRaw) && pollIntervalRaw >= 2000 ? pollIntervalRaw : 7000,
  }

  return cachedEnv
}
