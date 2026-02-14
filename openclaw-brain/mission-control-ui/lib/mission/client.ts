"use client"

import type {
  Activity,
  AgentHealth,
  Assignee,
  DocumentSource,
  MissionDocument,
  Notification,
  Task,
  TaskMessage,
  TaskPriority,
  TaskStatus,
} from "@/lib/mission/types"

type JsonHeaders = Record<string, string>

function buildHeaders(operator?: string): JsonHeaders {
  const headers: JsonHeaders = {
    "Content-Type": "application/json",
  }
  if (operator) {
    headers["x-operator-name"] = operator
  }
  return headers
}

async function parseJson<T>(response: Response): Promise<T> {
  const payload = await response.json()
  if (!response.ok) {
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : `Request failed with status ${response.status}`
    throw new Error(message)
  }
  return payload as T
}

export type TasksResponse = {
  tasks: Task[]
  grouped: Record<TaskStatus, Task[]>
}

export type DashboardSnapshot = {
  tasks: TasksResponse
  reviewQueue: Task[]
  activities: Activity[]
  health: AgentHealth[]
}

export type DocumentsResponse = {
  documents: MissionDocument[]
  nextCursor?: string
  hasMore: boolean
}

export type TaskMessagesResponse = {
  messages: TaskMessage[]
  nextCursor?: string
  hasMore: boolean
}

export type NotificationsResponse = {
  notifications: Notification[]
  nextCursor?: string
  hasMore: boolean
}

export type DocumentsQuery = {
  assignee?: Assignee
  taskId?: string
  source?: DocumentSource
  q?: string
  before?: string
  limit?: number
}

export async function fetchTasks(): Promise<TasksResponse> {
  const response = await fetch("/api/tasks", { cache: "no-store" })
  return parseJson<TasksResponse>(response)
}

export async function fetchReviewQueue(): Promise<Task[]> {
  const response = await fetch("/api/review-queue", { cache: "no-store" })
  const payload = await parseJson<{ tasks: Task[] }>(response)
  return payload.tasks
}

export async function fetchActivities(limit = 40): Promise<Activity[]> {
  const response = await fetch(`/api/activities?limit=${limit}`, { cache: "no-store" })
  const payload = await parseJson<{ activities: Activity[] }>(response)
  return payload.activities
}

export async function fetchAgentHealth(): Promise<AgentHealth[]> {
  const response = await fetch("/api/agents/health", { cache: "no-store" })
  const payload = await parseJson<{ health: AgentHealth[] }>(response)
  return payload.health
}

export async function fetchDocuments(query: DocumentsQuery = {}): Promise<DocumentsResponse> {
  const params = new URLSearchParams()
  if (query.assignee) {
    params.set("assignee", query.assignee)
  }
  if (query.taskId) {
    params.set("taskId", query.taskId)
  }
  if (query.source) {
    params.set("source", query.source)
  }
  if (query.q) {
    params.set("q", query.q)
  }
  if (query.before) {
    params.set("before", query.before)
  }
  if (query.limit) {
    params.set("limit", String(query.limit))
  }
  const search = params.toString()
  const response = await fetch(`/api/documents${search ? `?${search}` : ""}`, { cache: "no-store" })
  return parseJson<DocumentsResponse>(response)
}

export async function fetchDocument(documentId: string): Promise<MissionDocument> {
  const response = await fetch(`/api/documents/${documentId}`, { cache: "no-store" })
  const payload = await parseJson<{ document: MissionDocument }>(response)
  return payload.document
}

export async function fetchTaskMessages(taskId: string, input: { before?: string; limit?: number } = {}) {
  const params = new URLSearchParams()
  if (input.before) {
    params.set("before", input.before)
  }
  if (input.limit) {
    params.set("limit", String(input.limit))
  }
  const search = params.toString()
  const response = await fetch(`/api/tasks/${taskId}/messages${search ? `?${search}` : ""}`, { cache: "no-store" })
  return parseJson<TaskMessagesResponse>(response)
}

export async function createTaskMessage(input: {
  taskId: string
  content: string
  linked_document_ids?: string[]
  operator: string
}) {
  const response = await fetch(`/api/tasks/${input.taskId}/messages`, {
    method: "POST",
    headers: buildHeaders(input.operator),
    body: JSON.stringify({
      content: input.content,
      linked_document_ids: input.linked_document_ids ?? [],
      operator: input.operator,
    }),
  })
  return parseJson<{ message: TaskMessage; enqueuedNotificationCount: number }>(response)
}

export async function fetchNotifications(input: {
  assignee?: Assignee
  status?: "pending" | "delivered" | "failed"
  before?: string
  limit?: number
} = {}) {
  const params = new URLSearchParams()
  if (input.assignee) {
    params.set("assignee", input.assignee)
  }
  if (input.status) {
    params.set("status", input.status)
  }
  if (input.before) {
    params.set("before", input.before)
  }
  if (input.limit) {
    params.set("limit", String(input.limit))
  }
  const search = params.toString()
  const response = await fetch(`/api/notifications${search ? `?${search}` : ""}`, { cache: "no-store" })
  return parseJson<NotificationsResponse>(response)
}

export async function ackNotificationDelivery(input: {
  notificationId: string
  status: "delivered" | "failed"
  error?: string
  operator: string
}) {
  const response = await fetch(`/api/notifications/${input.notificationId}/deliver`, {
    method: "POST",
    headers: buildHeaders(input.operator),
    body: JSON.stringify({
      status: input.status,
      error: input.error,
      operator: input.operator,
    }),
  })
  return parseJson<{ notification: Notification }>(response)
}

export async function fetchDashboardSnapshot(limit = 40): Promise<DashboardSnapshot> {
  const [tasks, reviewQueue, activities, health] = await Promise.all([
    fetchTasks(),
    fetchReviewQueue(),
    fetchActivities(limit),
    fetchAgentHealth(),
  ])

  return {
    tasks,
    reviewQueue,
    activities,
    health,
  }
}

export async function createTask(input: {
  task_name: string
  description: string
  assignee: Assignee
  priority: TaskPriority
  dependencies: string[]
  linked_document_ids: string[]
  operator: string
}) {
  const response = await fetch("/api/tasks", {
    method: "POST",
    headers: buildHeaders(input.operator),
    body: JSON.stringify(input),
  })
  return parseJson<{ task: Task }>(response)
}

export async function transitionTaskStatus(input: {
  taskId: string
  toStatus: TaskStatus
  note?: string
  operator: string
}) {
  const response = await fetch(`/api/tasks/${input.taskId}/status`, {
    method: "PATCH",
    headers: buildHeaders(input.operator),
    body: JSON.stringify({
      toStatus: input.toStatus,
      note: input.note,
      operator: input.operator,
    }),
  })
  return parseJson<{ task: Task }>(response)
}

export async function appendTaskLog(input: {
  taskId: string
  message: string
  operator: string
}) {
  const response = await fetch(`/api/tasks/${input.taskId}/logs`, {
    method: "POST",
    headers: buildHeaders(input.operator),
    body: JSON.stringify({
      message: input.message,
      operator: input.operator,
    }),
  })
  return parseJson<{ task: Task }>(response)
}

export async function releaseDependencies(operator: string) {
  const response = await fetch("/api/tasks/release-dependencies", {
    method: "POST",
    headers: buildHeaders(operator),
    body: JSON.stringify({ operator, status: "todo" }),
  })
  return parseJson<{ releasedCount: number; releasedTaskIds: string[] }>(response)
}

export async function createDocument(input: {
  title: string
  contentMd: string
  assignee: Assignee
  agentId: string
  taskId?: string
  linked_task_ids: string[]
  source: DocumentSource
  url?: string
  metadata?: Record<string, unknown>
  operator: string
}) {
  const response = await fetch("/api/documents", {
    method: "POST",
    headers: buildHeaders(input.operator),
    body: JSON.stringify(input),
  })
  return parseJson<{ document: MissionDocument }>(response)
}

export async function updateDocument(input: {
  documentId: string
  title?: string
  contentMd?: string
  source?: DocumentSource
  url?: string | null
  metadata?: Record<string, unknown> | null
  linked_task_ids?: string[]
  operator: string
}) {
  const response = await fetch(`/api/documents/${input.documentId}`, {
    method: "PATCH",
    headers: buildHeaders(input.operator),
    body: JSON.stringify({
      title: input.title,
      contentMd: input.contentMd,
      source: input.source,
      url: input.url,
      metadata: input.metadata,
      linked_task_ids: input.linked_task_ids,
      operator: input.operator,
    }),
  })
  return parseJson<{ document: MissionDocument }>(response)
}

export async function linkDocumentToTask(input: {
  taskId: string
  documentId: string
  operator: string
}) {
  const response = await fetch(`/api/tasks/${input.taskId}/documents`, {
    method: "POST",
    headers: buildHeaders(input.operator),
    body: JSON.stringify({
      documentId: input.documentId,
      operator: input.operator,
    }),
  })
  return parseJson<{
    task: Task
    document: MissionDocument
    alreadyLinked: boolean
  }>(response)
}
