import { z } from "zod"
import {
  ACTIVITY_SOURCES,
  ACTIVITY_STATUSES,
  ASSIGNEES,
  DOCUMENT_SOURCES,
  NOTIFICATION_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TRIGGER_STATES,
} from "@/lib/mission/constants"

export const objectIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Expected a valid 24-character ObjectId")

export const createTaskSchema = z.object({
  task_name: z.string().min(3).max(160),
  description: z.string().min(5).max(12_000),
  assignee: z.enum(ASSIGNEES),
  priority: z.enum(TASK_PRIORITIES).default("normal"),
  dependencies: z.array(objectIdSchema).default([]),
  linked_document_ids: z.array(objectIdSchema).default([]),
  trigger_state: z.enum(TASK_TRIGGER_STATES).optional(),
  operator: z.string().min(2).max(64).optional(),
})

export const updateTaskStatusSchema = z.object({
  toStatus: z.enum(TASK_STATUSES),
  note: z.string().min(3).max(4000).optional(),
  operator: z.string().min(2).max(64).optional(),
})

export const appendTaskLogSchema = z.object({
  message: z.string().min(1).max(4000),
  operator: z.string().min(2).max(64).optional(),
})

export const createTaskMessageSchema = z.object({
  content: z.string().min(1).max(4000),
  linked_document_ids: z.array(objectIdSchema).default([]),
  operator: z.string().min(2).max(64).optional(),
})

export const listTaskMessagesQuerySchema = z.object({
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

export const releaseDependenciesSchema = z.object({
  operator: z.string().min(2).max(64).optional(),
  status: z.enum(TASK_STATUSES).default("todo"),
})

export const createDocumentSchema = z.object({
  title: z.string().min(3).max(200),
  contentMd: z.string().min(1).max(120_000),
  assignee: z.enum(ASSIGNEES),
  agentId: z.string().min(1).max(120),
  taskId: objectIdSchema.optional(),
  linked_task_ids: z.array(objectIdSchema).default([]),
  source: z.enum(DOCUMENT_SOURCES).default("agent"),
  url: z
    .union([z.string().url().max(2_000), z.literal("")])
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  metadata: z.record(z.string(), z.unknown()).optional(),
  operator: z.string().min(2).max(64).optional(),
})

export const updateDocumentSchema = z
  .object({
    title: z.string().min(3).max(200).optional(),
    contentMd: z.string().min(1).max(120_000).optional(),
    source: z.enum(DOCUMENT_SOURCES).optional(),
    // Accept empty-string/null in PATCH to make explicit URL clearing possible.
    url: z.union([z.string().url().max(2_000), z.literal(""), z.null()]).optional(),
    metadata: z.union([z.record(z.string(), z.unknown()), z.null()]).optional(),
    linked_task_ids: z.array(objectIdSchema).optional(),
    operator: z.string().min(2).max(64).optional(),
  })
  .refine(
    (payload) =>
      payload.title !== undefined ||
      payload.contentMd !== undefined ||
      payload.source !== undefined ||
      payload.url !== undefined ||
      payload.metadata !== undefined ||
      payload.linked_task_ids !== undefined,
    {
      message: "At least one document field must be updated",
      path: ["title"],
    },
  )

export const listDocumentsQuerySchema = z.object({
  assignee: z.enum(ASSIGNEES).optional(),
  taskId: objectIdSchema.optional(),
  source: z.enum(DOCUMENT_SOURCES).optional(),
  q: z.string().min(1).max(200).optional(),
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

export const linkDocumentToTaskSchema = z.object({
  documentId: objectIdSchema,
  operator: z.string().min(2).max(64).optional(),
})

export const ingestActivitySchema = z.object({
  source: z.enum(ACTIVITY_SOURCES),
  status: z.enum(ACTIVITY_STATUSES).default("info"),
  eventType: z.string().min(3).max(120),
  message: z.string().min(1).max(4000),
  dedupeKey: z.string().min(3).max(240).optional(),
  assignee: z.enum(ASSIGNEES).optional(),
  agentId: z.string().min(1).max(120).optional(),
  sessionKey: z.string().min(1).max(240).optional(),
  jobId: z.string().min(1).max(120).optional(),
  taskId: objectIdSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  created_at: z.string().datetime().optional(),
})

export const ingestActivitiesRequestSchema = z.object({
  events: z.array(ingestActivitySchema).min(1).max(200),
})

export const listNotificationsQuerySchema = z.object({
  assignee: z.enum(ASSIGNEES).optional(),
  status: z.enum(NOTIFICATION_STATUSES).optional(),
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

export const ackNotificationSchema = z
  .object({
    status: z.enum(["delivered", "failed"]),
    error: z.string().min(1).max(500).optional(),
    operator: z.string().min(2).max(64).optional(),
  })
  .refine((payload) => payload.status === "delivered" || Boolean(payload.error), {
    message: "error is required when status is failed",
    path: ["error"],
  })
