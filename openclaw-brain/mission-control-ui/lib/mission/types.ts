import type { ObjectId } from "mongodb"
import type {
  ACTIVITY_SOURCES,
  ACTIVITY_STATUSES,
  ASSIGNEES,
  DOCUMENT_SOURCES,
  NOTIFICATION_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TRIGGER_STATES,
} from "@/lib/mission/constants"

export type Assignee = (typeof ASSIGNEES)[number]
export type TaskStatus = (typeof TASK_STATUSES)[number]
export type TaskPriority = (typeof TASK_PRIORITIES)[number]
export type TaskTriggerState = (typeof TASK_TRIGGER_STATES)[number]

export type TaskLog = {
  timestamp: string
  agent: string
  message: string
}

export type TaskOutput = {
  link: string
  summary: string
}

export type TaskDocument = {
  _id?: ObjectId
  task_name: string
  description: string
  assignee: Assignee
  labels?: string[]
  status: TaskStatus
  priority: TaskPriority
  trigger_state: TaskTriggerState
  dependencies: ObjectId[]
  linked_document_ids?: ObjectId[]
  output_data: TaskOutput
  agent_logs: TaskLog[]
  created_at: string
  updated_at: string
}

export type Task = Omit<TaskDocument, "_id" | "dependencies" | "linked_document_ids" | "labels"> & {
  id: string
  labels: string[]
  dependencies: string[]
  linked_document_ids: string[]
  message_count: number
}

export type ActivitySource = (typeof ACTIVITY_SOURCES)[number]
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number]
export type DocumentSource = (typeof DOCUMENT_SOURCES)[number]
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number]

export type ActivityDocument = {
  _id?: ObjectId
  source: ActivitySource
  status: ActivityStatus
  eventType: string
  message: string
  dedupeKey?: string
  assignee?: Assignee
  agentId?: string
  sessionKey?: string
  jobId?: string
  taskId?: string
  metadata?: Record<string, unknown>
  created_at: string
}

export type Activity = Omit<ActivityDocument, "_id"> & {
  id: string
}

export type TaskMessageDocument = {
  _id?: ObjectId
  taskId: ObjectId
  author: string
  authorAssignee?: Assignee
  content: string
  mentions: Assignee[]
  linked_document_ids?: ObjectId[]
  created_at: string
  updated_at: string
}

export type TaskMessage = Omit<TaskMessageDocument, "_id" | "taskId" | "linked_document_ids"> & {
  id: string
  taskId: string
  linked_document_ids: string[]
}

export type NotificationDocument = {
  _id?: ObjectId
  taskId: ObjectId
  messageId: ObjectId
  mentionedAssignee: Assignee
  status: NotificationStatus
  content: string
  attempts: number
  delivered_at?: string
  failed_at?: string
  lastError?: string
  created_at: string
  updated_at: string
}

export type Notification = Omit<NotificationDocument, "_id" | "taskId" | "messageId"> & {
  id: string
  taskId: string
  messageId: string
}

export type MissionDocumentRecord = {
  _id?: ObjectId
  title: string
  contentMd: string
  assignee: Assignee
  agentId: string
  // Legacy single-task link kept for backward compatibility during migration.
  taskId?: ObjectId
  // New reusable linkage model: one document can be attached to many tasks.
  linked_task_ids?: ObjectId[]
  source: DocumentSource
  url?: string
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type MissionDocument = Omit<MissionDocumentRecord, "_id" | "taskId" | "linked_task_ids"> & {
  id: string
  taskId?: string
  linked_task_ids: string[]
}

export type AgentHealth = {
  assignee: Assignee
  taskCounts: {
    todo: number
    in_progress: number
    review: number
    blocked: number
    done: number
  }
  artifactSignals: {
    unlinkedDocuments: number
    reviewOrDoneWithoutDocuments: number
  }
  lastActivityAt?: string
  lastActivityMessage?: string
  lastActivityStatus?: ActivityStatus
  nextCronAt?: string
  nextCronInSeconds?: number
  stale: boolean
}
