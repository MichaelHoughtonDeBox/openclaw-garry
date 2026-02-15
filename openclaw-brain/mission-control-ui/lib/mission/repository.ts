import { ObjectId } from "mongodb"
import { ensureMissionIndexes, getMissionCollections } from "@/lib/mongodb"
import {
  ASSIGNEES,
  ACTIVE_DEFAULT_ASSIGNEES,
  MENTION_ALL_TOKEN,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TRIGGER_STATES,
  TRANSITIONS,
} from "@/lib/mission/constants"
import type {
  Activity,
  ActivityDocument,
  ActivitySource,
  ActivityStatus,
  AgentHealth,
  Assignee,
  DocumentSource,
  MissionDocument,
  MissionDocumentRecord,
  Notification,
  NotificationDocument,
  NotificationStatus,
  Task,
  TaskDocument,
  TaskMessage,
  TaskMessageDocument,
  TaskPriority,
  TaskStatus,
  TaskTriggerState,
} from "@/lib/mission/types"

type ListTasksFilters = {
  status?: TaskStatus
  assignee?: Assignee
  q?: string
}

type ListActivitiesFilters = {
  source?: ActivitySource
  status?: ActivityStatus
  assignee?: Assignee
  eventType?: string
  limit?: number
  before?: string
}

type ListDocumentsFilters = {
  assignee?: Assignee
  taskId?: string
  source?: DocumentSource
  q?: string
  before?: string
  limit?: number
}

type ListTaskMessagesFilters = {
  taskId: string
  before?: string
  limit?: number
}

type ListNotificationsFilters = {
  assignee?: Assignee
  status?: NotificationStatus
  before?: string
  limit?: number
}

function parseObjectId(value: string, label = "id") {
  if (!ObjectId.isValid(value)) {
    throw new Error(`Invalid ${label}`)
  }
  return new ObjectId(value)
}

function nowIso() {
  return new Date().toISOString()
}

function resolveAuthorAssignee(operator: string): Assignee | undefined {
  const normalized = operator.trim().toLowerCase()
  return ASSIGNEES.includes(normalized as Assignee) ? (normalized as Assignee) : undefined
}

function extractMentions(content: string): Assignee[] {
  const mentions = new Set<Assignee>()
  const mentionRegex = /@([a-zA-Z0-9_-]+)/g

  // Mentions are derived from message text so fan-out remains deterministic.
  for (const [, rawMention] of content.matchAll(mentionRegex)) {
    const normalized = rawMention.toLowerCase()
    if (normalized === MENTION_ALL_TOKEN) {
      for (const assignee of ASSIGNEES) {
        mentions.add(assignee)
      }
      continue
    }
    if (ASSIGNEES.includes(normalized as Assignee)) {
      mentions.add(normalized as Assignee)
    }
  }

  return [...mentions]
}

function normalizeLabels(labels: string[]): string[] {
  // Keep labels deterministic so cards can render compact chips without duplicates or whitespace drift.
  const seen = new Set<string>()
  const normalized: string[] = []
  for (const label of labels) {
    const candidate = label.trim().toLowerCase()
    if (!candidate || seen.has(candidate)) {
      continue
    }
    seen.add(candidate)
    normalized.push(candidate)
    if (normalized.length >= 12) {
      break
    }
  }
  return normalized
}

function toTask(doc: TaskDocument): Task {
  if (!doc._id) {
    throw new Error("Task document is missing _id")
  }
  return {
    id: String(doc._id),
    task_name: doc.task_name,
    description: doc.description,
    assignee: doc.assignee,
    labels: doc.labels ?? [],
    status: doc.status,
    priority: doc.priority,
    trigger_state: doc.trigger_state,
    dependencies: (doc.dependencies ?? []).map((dependency) => String(dependency)),
    linked_document_ids: (doc.linked_document_ids ?? []).map((documentId) => String(documentId)),
    message_count: 0,
    output_data: doc.output_data,
    agent_logs: doc.agent_logs ?? [],
    created_at: doc.created_at,
    updated_at: doc.updated_at,
  }
}

function toActivity(doc: ActivityDocument): Activity {
  if (!doc._id) {
    throw new Error("Activity document is missing _id")
  }
  return {
    id: String(doc._id),
    source: doc.source,
    status: doc.status,
    eventType: doc.eventType,
    message: doc.message,
    dedupeKey: doc.dedupeKey,
    assignee: doc.assignee,
    agentId: doc.agentId,
    sessionKey: doc.sessionKey,
    jobId: doc.jobId,
    taskId: doc.taskId,
    metadata: doc.metadata,
    created_at: doc.created_at,
  }
}

function toTaskMessage(doc: TaskMessageDocument): TaskMessage {
  if (!doc._id) {
    throw new Error("Task message document is missing _id")
  }
  return {
    id: String(doc._id),
    taskId: String(doc.taskId),
    author: doc.author,
    authorAssignee: doc.authorAssignee,
    content: doc.content,
    mentions: doc.mentions ?? [],
    linked_document_ids: (doc.linked_document_ids ?? []).map((documentId) => String(documentId)),
    created_at: doc.created_at,
    updated_at: doc.updated_at,
  }
}

function toNotification(doc: NotificationDocument): Notification {
  if (!doc._id) {
    throw new Error("Notification document is missing _id")
  }
  return {
    id: String(doc._id),
    taskId: String(doc.taskId),
    messageId: String(doc.messageId),
    mentionedAssignee: doc.mentionedAssignee,
    status: doc.status,
    content: doc.content,
    attempts: doc.attempts,
    delivered_at: doc.delivered_at,
    failed_at: doc.failed_at,
    lastError: doc.lastError,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
  }
}

function toMissionDocument(doc: MissionDocumentRecord): MissionDocument {
  if (!doc._id) {
    throw new Error("Document is missing _id")
  }
  const linkedTaskIds = new Set((doc.linked_task_ids ?? []).map((taskId) => String(taskId)))
  if (doc.taskId) {
    linkedTaskIds.add(String(doc.taskId))
  }
  return {
    id: String(doc._id),
    title: doc.title,
    contentMd: doc.contentMd,
    assignee: doc.assignee,
    agentId: doc.agentId,
    taskId: doc.taskId ? String(doc.taskId) : undefined,
    linked_task_ids: [...linkedTaskIds],
    source: doc.source,
    url: doc.url,
    metadata: doc.metadata,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
  }
}

async function insertActivity(input: Omit<ActivityDocument, "_id" | "created_at"> & { created_at?: string }) {
  const { activities } = await getMissionCollections()
  const activityDoc: ActivityDocument = {
    source: input.source,
    status: input.status,
    eventType: input.eventType,
    message: input.message,
    assignee: input.assignee,
    agentId: input.agentId,
    sessionKey: input.sessionKey,
    jobId: input.jobId,
    taskId: input.taskId,
    metadata: input.metadata,
    created_at: input.created_at ?? nowIso(),
  }
  // Only persist dedupeKey when explicitly provided, avoiding unique-index collisions on null.
  if (input.dedupeKey) {
    activityDoc.dedupeKey = input.dedupeKey
  }
  await activities.insertOne(activityDoc)
}

function buildStatusGroups(tasks: Task[]) {
  const groups: Record<TaskStatus, Task[]> = {
    todo: [],
    in_progress: [],
    blocked: [],
    review: [],
    done: [],
  }
  for (const task of tasks) {
    groups[task.status].push(task)
  }
  return groups
}

function priorityScore(priority: TaskPriority): number {
  return TASK_PRIORITIES.indexOf(priority)
}

function isTransitionAllowed(from: TaskStatus, to: TaskStatus) {
  return TRANSITIONS[from]?.includes(to) ?? false
}

export async function listTasks(filters: ListTasksFilters = {}) {
  await ensureMissionIndexes()
  const { tasks, messages } = await getMissionCollections()

  const query: Record<string, unknown> = {}
  if (filters.status) {
    query.status = filters.status
  }
  if (filters.assignee) {
    query.assignee = filters.assignee
  }
  if (filters.q) {
    query.$or = [
      { task_name: { $regex: filters.q, $options: "i" } },
      { description: { $regex: filters.q, $options: "i" } },
    ]
  }

  const docs = await tasks.find(query).toArray()
  const normalized = docs
    .map((doc) => toTask(doc))
    .sort((left, right) => {
      const byStatus = TASK_STATUSES.indexOf(left.status) - TASK_STATUSES.indexOf(right.status)
      if (byStatus !== 0) {
        return byStatus
      }
      const byPriority = priorityScore(left.priority) - priorityScore(right.priority)
      if (byPriority !== 0) {
        return byPriority
      }
      return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()
    })

  const taskObjectIds = docs.flatMap((doc) => (doc._id ? [doc._id] : []))
  let messageCountByTaskId = new Map<string, number>()
  if (taskObjectIds.length > 0) {
    const messageCounts = await messages
      .aggregate<{ _id: ObjectId; count: number }>([
        {
          $match: {
            taskId: { $in: taskObjectIds },
          },
        },
        {
          $group: {
            _id: "$taskId",
            count: { $sum: 1 },
          },
        },
      ])
      .toArray()
    messageCountByTaskId = new Map(messageCounts.map((item) => [String(item._id), item.count]))
  }

  const enrichedTasks = normalized.map((task) => ({
    ...task,
    message_count: messageCountByTaskId.get(task.id) ?? 0,
  }))

  return {
    tasks: enrichedTasks,
    grouped: buildStatusGroups(enrichedTasks),
  }
}

export async function createTask(input: {
  task_name: string
  description: string
  assignee: Assignee
  labels: string[]
  priority: TaskPriority
  dependencies: string[]
  linked_document_ids: string[]
  trigger_state?: TaskTriggerState
  operator: string
}) {
  await ensureMissionIndexes()
  const { tasks, documents } = await getMissionCollections()
  const timestamp = nowIso()

  const dependencies = input.dependencies.map((dependencyId) => parseObjectId(dependencyId))
  const linkedDocumentIds = [...new Set(input.linked_document_ids)].map((documentId) =>
    parseObjectId(documentId, "document id"),
  )
  const labels = normalizeLabels(input.labels)
  const triggerState =
    input.trigger_state ?? (dependencies.length > 0 ? ("WAITING" satisfies TaskTriggerState) : ("READY" satisfies TaskTriggerState))

  if (!TASK_TRIGGER_STATES.includes(triggerState)) {
    throw new Error("Invalid trigger state")
  }
  if (linkedDocumentIds.length > 0) {
    const existingCount = await documents.countDocuments({ _id: { $in: linkedDocumentIds } })
    if (existingCount !== linkedDocumentIds.length) {
      throw new Error("Cannot link missing documents to the task")
    }
  }

  const logEntry = {
    timestamp,
    agent: input.operator,
    message: `Task created and assigned to ${input.assignee}${linkedDocumentIds.length ? ` with ${linkedDocumentIds.length} linked document(s)` : ""}`,
  }

  const result = await tasks.insertOne({
    task_name: input.task_name,
    description: input.description,
    assignee: input.assignee,
    labels,
    status: "todo",
    priority: input.priority,
    trigger_state: triggerState,
    dependencies,
    linked_document_ids: linkedDocumentIds,
    output_data: {
      link: "",
      summary: "",
    },
    agent_logs: [logEntry],
    created_at: timestamp,
    updated_at: timestamp,
  })

  if (linkedDocumentIds.length > 0) {
    await documents.updateMany(
      { _id: { $in: linkedDocumentIds } },
      {
        $set: { updated_at: timestamp },
        $addToSet: { linked_task_ids: result.insertedId },
      },
    )
  }

  await insertActivity({
    source: "operator",
    status: "ok",
    eventType: "task_created",
    message: `Created task "${input.task_name}" for ${input.assignee}`,
    assignee: input.assignee,
    taskId: String(result.insertedId),
    metadata: {
      operator: input.operator,
      priority: input.priority,
      labels,
      dependencyCount: dependencies.length,
      linkedDocumentCount: linkedDocumentIds.length,
    },
  })

  const createdTask = await tasks.findOne({ _id: result.insertedId })
  if (!createdTask) {
    throw new Error("Task was created but not retrievable")
  }

  return toTask(createdTask)
}

export async function listReviewQueue() {
  const { tasks } = await getMissionCollections()
  const docs = await tasks.find({ status: "review" }).sort({ updated_at: -1 }).toArray()
  return docs.map((doc) => toTask(doc))
}

export async function appendTaskLog(input: {
  taskId: string
  operator: string
  message: string
}) {
  const { tasks } = await getMissionCollections()
  const taskObjectId = parseObjectId(input.taskId)
  const timestamp = nowIso()

  const updated = await tasks.findOneAndUpdate(
    { _id: taskObjectId },
    {
      $set: { updated_at: timestamp },
      $push: {
        agent_logs: {
          timestamp,
          agent: input.operator,
          message: input.message,
        },
      },
    },
    { returnDocument: "after" },
  )

  if (!updated) {
    throw new Error("Task not found")
  }

  await insertActivity({
    source: "task",
    status: "info",
    eventType: "task_log_appended",
    message: input.message,
    assignee: updated.assignee,
    taskId: input.taskId,
    metadata: {
      operator: input.operator,
    },
  })

  return toTask(updated)
}

export async function createTaskMessage(input: {
  taskId: string
  content: string
  operator: string
  linked_document_ids: string[]
}) {
  await ensureMissionIndexes()
  const { tasks, documents, messages, notifications } = await getMissionCollections()
  const taskObjectId = parseObjectId(input.taskId, "task id")
  const linkedDocumentIds = [...new Set(input.linked_document_ids)].map((documentId) =>
    parseObjectId(documentId, "document id"),
  )

  const task = await tasks.findOne({ _id: taskObjectId })
  if (!task) {
    throw new Error("Task not found")
  }
  if (linkedDocumentIds.length > 0) {
    const existingCount = await documents.countDocuments({ _id: { $in: linkedDocumentIds } })
    if (existingCount !== linkedDocumentIds.length) {
      throw new Error("Cannot link missing documents to the task message")
    }
  }

  const authorAssignee = resolveAuthorAssignee(input.operator)
  const mentions = extractMentions(input.content).filter((assignee) => assignee !== authorAssignee)
  const timestamp = nowIso()

  const inserted = await messages.insertOne({
    taskId: taskObjectId,
    author: input.operator,
    authorAssignee,
    content: input.content,
    mentions,
    linked_document_ids: linkedDocumentIds,
    created_at: timestamp,
    updated_at: timestamp,
  })

  if (mentions.length > 0) {
    await notifications.insertMany(
      mentions.map((mentionedAssignee) => ({
        taskId: taskObjectId,
        messageId: inserted.insertedId,
        mentionedAssignee,
        status: "pending" satisfies NotificationStatus,
        content: input.content,
        attempts: 0,
        created_at: timestamp,
        updated_at: timestamp,
      })),
      { ordered: false },
    )
  }

  await insertActivity({
    source: "task",
    status: "info",
    eventType: "message_created",
    message: `Message added on task "${task.task_name}"`,
    assignee: task.assignee,
    taskId: input.taskId,
    metadata: {
      operator: input.operator,
      mentionCount: mentions.length,
      linkedDocumentCount: linkedDocumentIds.length,
    },
  })

  if (mentions.length > 0) {
    await insertActivity({
      source: "system",
      status: "ok",
      eventType: "notification_enqueued",
      message: `Queued ${mentions.length} mention notification(s) for task "${task.task_name}"`,
      assignee: task.assignee,
      taskId: input.taskId,
      metadata: {
        operator: input.operator,
        recipients: mentions,
      },
    })
  }

  const createdMessage = await messages.findOne({ _id: inserted.insertedId })
  if (!createdMessage) {
    throw new Error("Task message was created but not retrievable")
  }

  return {
    message: toTaskMessage(createdMessage),
    enqueuedNotificationCount: mentions.length,
  }
}

export async function listTaskMessages(filters: ListTaskMessagesFilters) {
  await ensureMissionIndexes()
  const { messages } = await getMissionCollections()
  const taskObjectId = parseObjectId(filters.taskId, "task id")
  const query: Record<string, unknown> = {
    taskId: taskObjectId,
  }
  if (filters.before) {
    query.created_at = { $lt: filters.before }
  }

  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200)
  const docs = await messages.find(query).sort({ created_at: -1 }).limit(limit + 1).toArray()
  const hasMore = docs.length > limit
  const records = docs.slice(0, limit).map((doc) => toTaskMessage(doc))
  const nextCursor = hasMore ? records.at(-1)?.created_at : undefined

  return {
    messages: records,
    nextCursor,
    hasMore,
  }
}

export async function listNotifications(filters: ListNotificationsFilters = {}) {
  await ensureMissionIndexes()
  const { notifications } = await getMissionCollections()
  const query: Record<string, unknown> = {}

  if (filters.assignee) {
    query.mentionedAssignee = filters.assignee
  }
  if (filters.status) {
    query.status = filters.status
  }
  if (filters.before) {
    query.created_at = { $lt: filters.before }
  }

  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200)
  const docs = await notifications.find(query).sort({ created_at: -1 }).limit(limit + 1).toArray()
  const hasMore = docs.length > limit
  const records = docs.slice(0, limit).map((doc) => toNotification(doc))
  const nextCursor = hasMore ? records.at(-1)?.created_at : undefined

  return {
    notifications: records,
    nextCursor,
    hasMore,
  }
}

export async function ackNotificationDelivery(input: {
  notificationId: string
  status: Extract<NotificationStatus, "delivered" | "failed">
  operator: string
  error?: string
}) {
  await ensureMissionIndexes()
  const { notifications } = await getMissionCollections()
  const notificationObjectId = parseObjectId(input.notificationId, "notification id")
  const current = await notifications.findOne({ _id: notificationObjectId })
  if (!current) {
    throw new Error("Notification not found")
  }

  const timestamp = nowIso()
  const updated = await notifications.findOneAndUpdate(
    { _id: notificationObjectId },
    {
      $set: {
        status: input.status,
        updated_at: timestamp,
        delivered_at: input.status === "delivered" ? timestamp : current.delivered_at,
        failed_at: input.status === "failed" ? timestamp : current.failed_at,
        lastError: input.status === "failed" ? input.error : undefined,
      },
      $inc: {
        attempts: 1,
      },
    },
    { returnDocument: "after" },
  )

  if (!updated) {
    throw new Error("Notification update race detected, please retry")
  }

  await insertActivity({
    source: "system",
    status: input.status === "delivered" ? "ok" : "error",
    eventType: input.status === "delivered" ? "notification_delivered" : "notification_failed",
    message:
      input.status === "delivered"
        ? `Delivered mention notification to ${updated.mentionedAssignee}`
        : `Failed mention notification for ${updated.mentionedAssignee}: ${input.error ?? "unknown error"}`,
    assignee: updated.mentionedAssignee,
    taskId: String(updated.taskId),
    metadata: {
      operator: input.operator,
      notificationId: input.notificationId,
      messageId: String(updated.messageId),
      error: input.error,
    },
  })

  return toNotification(updated)
}

export async function transitionTaskStatus(input: {
  taskId: string
  toStatus: TaskStatus
  operator: string
  note?: string
}) {
  const { tasks } = await getMissionCollections()
  const taskObjectId = parseObjectId(input.taskId)
  const current = await tasks.findOne({ _id: taskObjectId })

  if (!current) {
    throw new Error("Task not found")
  }
  if (!isTransitionAllowed(current.status, input.toStatus)) {
    throw new Error(`Transition ${current.status} -> ${input.toStatus} is not allowed`)
  }

  const timestamp = nowIso()
  const note = input.note ?? `Status updated to ${input.toStatus}`

  const updated = await tasks.findOneAndUpdate(
    { _id: taskObjectId, status: current.status },
    {
      $set: {
        status: input.toStatus,
        updated_at: timestamp,
      },
      $push: {
        agent_logs: {
          timestamp,
          agent: input.operator,
          message: note,
        },
      },
    },
    { returnDocument: "after" },
  )

  if (!updated) {
    throw new Error("Task update race detected, please retry")
  }

  await insertActivity({
    source: "operator",
    status: "ok",
    eventType: "task_status_changed",
    message: `${current.status} -> ${input.toStatus}: ${note}`,
    assignee: updated.assignee,
    taskId: input.taskId,
    metadata: {
      operator: input.operator,
      from: current.status,
      to: input.toStatus,
    },
  })

  return toTask(updated)
}

export async function releaseDependencies(input: {
  operator: string
  status: TaskStatus
}) {
  const { tasks } = await getMissionCollections()
  const waitingTasks = await tasks
    .find({
      status: input.status,
      trigger_state: "WAITING",
      "dependencies.0": { $exists: true },
    })
    .toArray()

  const releasedTaskIds: string[] = []

  // Iterate sequentially to preserve deterministic log ordering for audit trails.
  for (const task of waitingTasks) {
    if (!task._id) {
      continue
    }
    const doneDependencies = await tasks.countDocuments({
      _id: { $in: task.dependencies ?? [] },
      status: "done",
    })
    if (doneDependencies !== (task.dependencies ?? []).length) {
      continue
    }

    const timestamp = nowIso()
    const result = await tasks.updateOne(
      { _id: task._id, trigger_state: "WAITING" },
      {
        $set: {
          trigger_state: "READY",
          updated_at: timestamp,
        },
        $push: {
          agent_logs: {
            timestamp,
            agent: input.operator,
            message: "Dependencies resolved. trigger_state -> READY",
          },
        },
      },
    )

    if (result.modifiedCount > 0) {
      releasedTaskIds.push(String(task._id))
      await insertActivity({
        source: "system",
        status: "ok",
        eventType: "dependency_released",
        message: `Released dependency-gated task "${task.task_name}"`,
        assignee: task.assignee,
        taskId: String(task._id),
        metadata: {
          operator: input.operator,
        },
      })
    }
  }

  return {
    releasedCount: releasedTaskIds.length,
    releasedTaskIds,
  }
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
  await ensureMissionIndexes()
  const { tasks, documents } = await getMissionCollections()
  const timestamp = nowIso()
  const taskObjectId = input.taskId ? parseObjectId(input.taskId, "task id") : undefined
  const linkedTaskIds = [
    ...new Set([
      ...(taskObjectId ? [String(taskObjectId)] : []),
      ...input.linked_task_ids,
    ]),
  ].map((taskId) => parseObjectId(taskId, "task id"))

  if (linkedTaskIds.length > 0) {
    const existingCount = await tasks.countDocuments({ _id: { $in: linkedTaskIds } })
    if (existingCount !== linkedTaskIds.length) {
      throw new Error("Cannot attach document to a missing task")
    }
  }

  const result = await documents.insertOne({
    title: input.title,
    contentMd: input.contentMd,
    assignee: input.assignee,
    agentId: input.agentId,
    taskId: taskObjectId,
    linked_task_ids: linkedTaskIds,
    source: input.source,
    url: input.url,
    metadata: input.metadata,
    created_at: timestamp,
    updated_at: timestamp,
  })

  if (linkedTaskIds.length > 0) {
    await tasks.updateMany(
      { _id: { $in: linkedTaskIds } },
      {
        $set: { updated_at: timestamp },
        $addToSet: { linked_document_ids: result.insertedId },
        $push: {
          agent_logs: {
            timestamp,
            agent: input.operator,
            message: `Linked document ${result.insertedId.toString()} to task`,
          },
        },
      },
    )

    for (const linkedTaskId of linkedTaskIds) {
      await insertActivity({
        source: "document",
        status: "ok",
        eventType: "task_linked_document",
        message: `Linked document "${input.title}" to task ${String(linkedTaskId)}`,
        assignee: input.assignee,
        agentId: input.agentId,
        taskId: String(linkedTaskId),
        metadata: {
          operator: input.operator,
          documentId: result.insertedId.toString(),
        },
      })
    }
  }

  await insertActivity({
    source: "document",
    status: "ok",
    eventType: "document_created",
    message: `Created document "${input.title}"`,
    assignee: input.assignee,
    agentId: input.agentId,
    taskId: input.taskId,
    metadata: {
      operator: input.operator,
      documentId: result.insertedId.toString(),
      source: input.source,
      linkedTaskCount: linkedTaskIds.length,
    },
  })

  const created = await documents.findOne({ _id: result.insertedId })
  if (!created) {
    throw new Error("Document was created but not retrievable")
  }
  return toMissionDocument(created)
}

export async function listDocuments(filters: ListDocumentsFilters = {}) {
  await ensureMissionIndexes()
  const { documents } = await getMissionCollections()
  const query: Record<string, unknown> = {}
  const andClauses: Record<string, unknown>[] = []

  if (filters.assignee) {
    query.assignee = filters.assignee
  }
  if (filters.taskId) {
    const taskObjectId = parseObjectId(filters.taskId, "task id")
    andClauses.push({
      $or: [{ taskId: taskObjectId }, { linked_task_ids: taskObjectId }],
    })
  }
  if (filters.source) {
    query.source = filters.source
  }
  if (filters.q) {
    andClauses.push({
      $or: [
        { title: { $regex: filters.q, $options: "i" } },
        { contentMd: { $regex: filters.q, $options: "i" } },
      ],
    })
  }
  if (filters.before) {
    query.created_at = { $lt: filters.before }
  }
  if (andClauses.length > 0) {
    query.$and = andClauses
  }

  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200)
  const docs = await documents.find(query).sort({ created_at: -1 }).limit(limit + 1).toArray()
  const hasMore = docs.length > limit
  const records = docs.slice(0, limit).map((doc) => toMissionDocument(doc))
  const nextCursor = hasMore ? records.at(-1)?.created_at : undefined

  return {
    documents: records,
    nextCursor,
    hasMore,
  }
}

export async function getDocument(documentId: string) {
  const { documents } = await getMissionCollections()
  const objectId = parseObjectId(documentId, "document id")
  const doc = await documents.findOne({ _id: objectId })
  if (!doc) {
    throw new Error("Document not found")
  }
  return toMissionDocument(doc)
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
  await ensureMissionIndexes()
  const { tasks, documents } = await getMissionCollections()
  const documentObjectId = parseObjectId(input.documentId, "document id")
  const existingDocument = await documents.findOne({ _id: documentObjectId })
  if (!existingDocument) {
    throw new Error("Document not found")
  }

  const timestamp = nowIso()
  const setPatch: Record<string, unknown> = {
    updated_at: timestamp,
  }
  const unsetPatch: Record<string, "" | 1> = {}

  if (input.title !== undefined) {
    setPatch.title = input.title
  }
  if (input.contentMd !== undefined) {
    setPatch.contentMd = input.contentMd
  }
  if (input.source !== undefined) {
    setPatch.source = input.source
  }
  if (input.url !== undefined) {
    if (input.url === null || input.url === "") {
      unsetPatch.url = ""
    } else {
      setPatch.url = input.url
    }
  }
  if (input.metadata !== undefined) {
    if (input.metadata === null) {
      unsetPatch.metadata = ""
    } else {
      setPatch.metadata = input.metadata
    }
  }

  let addedTaskIds: ObjectId[] = []
  let removedTaskIds: ObjectId[] = []
  if (input.linked_task_ids !== undefined) {
    const requestedLinkedTaskIds = [...new Set(input.linked_task_ids)].map((taskId) =>
      parseObjectId(taskId, "task id"),
    )
    if (requestedLinkedTaskIds.length > 0) {
      const taskCount = await tasks.countDocuments({ _id: { $in: requestedLinkedTaskIds } })
      if (taskCount !== requestedLinkedTaskIds.length) {
        throw new Error("Cannot link document to missing tasks")
      }
    }

    const previousLinkedTaskIds = new Set([
      ...(existingDocument.taskId ? [String(existingDocument.taskId)] : []),
      ...(existingDocument.linked_task_ids ?? []).map((taskId) => String(taskId)),
    ])
    const nextLinkedTaskIds = new Set([
      ...(existingDocument.taskId ? [String(existingDocument.taskId)] : []),
      ...requestedLinkedTaskIds.map((taskId) => String(taskId)),
    ])

    addedTaskIds = [...nextLinkedTaskIds]
      .filter((taskId) => !previousLinkedTaskIds.has(taskId))
      .map((taskId) => parseObjectId(taskId, "task id"))
    removedTaskIds = [...previousLinkedTaskIds]
      .filter((taskId) => !nextLinkedTaskIds.has(taskId))
      .map((taskId) => parseObjectId(taskId, "task id"))

    setPatch.linked_task_ids = [...nextLinkedTaskIds].map((taskId) => parseObjectId(taskId, "task id"))
  }

  const updateOperation: {
    $set: Record<string, unknown>
    $unset?: Record<string, "" | 1>
  } = { $set: setPatch }
  if (Object.keys(unsetPatch).length > 0) {
    updateOperation.$unset = unsetPatch
  }

  await documents.updateOne({ _id: documentObjectId }, updateOperation)

  if (addedTaskIds.length > 0) {
    await tasks.updateMany(
      { _id: { $in: addedTaskIds } },
      {
        $set: { updated_at: timestamp },
        $addToSet: { linked_document_ids: documentObjectId },
        $push: {
          agent_logs: {
            timestamp,
            agent: input.operator,
            message: `Linked document ${input.documentId} to task`,
          },
        },
      },
    )
  }

  if (removedTaskIds.length > 0) {
    await tasks.updateMany(
      { _id: { $in: removedTaskIds } },
      {
        $set: { updated_at: timestamp },
        $pull: { linked_document_ids: documentObjectId },
        $push: {
          agent_logs: {
            timestamp,
            agent: input.operator,
            message: `Unlinked document ${input.documentId} from task`,
          },
        },
      },
    )
  }

  await insertActivity({
    source: "document",
    status: "ok",
    eventType: "document_updated",
    message: `Updated document "${input.title ?? existingDocument.title}"`,
    assignee: existingDocument.assignee,
    agentId: existingDocument.agentId,
    taskId: existingDocument.taskId ? String(existingDocument.taskId) : undefined,
    metadata: {
      operator: input.operator,
      documentId: input.documentId,
      linkedTaskAdds: addedTaskIds.map((taskId) => String(taskId)),
      linkedTaskRemovals: removedTaskIds.map((taskId) => String(taskId)),
    },
  })

  const updatedDocument = await documents.findOne({ _id: documentObjectId })
  if (!updatedDocument) {
    throw new Error("Document disappeared during update")
  }
  return toMissionDocument(updatedDocument)
}

export async function linkDocumentToTask(input: {
  documentId: string
  taskId: string
  operator: string
}) {
  await ensureMissionIndexes()
  const { tasks, documents } = await getMissionCollections()
  const taskObjectId = parseObjectId(input.taskId, "task id")
  const documentObjectId = parseObjectId(input.documentId, "document id")
  const timestamp = nowIso()

  const existingTask = await tasks.findOne({ _id: taskObjectId })
  if (!existingTask) {
    throw new Error("Task not found")
  }
  const existingDocument = await documents.findOne({ _id: documentObjectId })
  if (!existingDocument) {
    throw new Error("Document not found")
  }

  const alreadyLinked = (existingTask.linked_document_ids ?? []).some((candidate) => candidate.equals(documentObjectId))
  if (!alreadyLinked) {
    await tasks.updateOne(
      { _id: taskObjectId },
      {
        $set: { updated_at: timestamp },
        $addToSet: { linked_document_ids: documentObjectId },
        $push: {
          agent_logs: {
            timestamp,
            agent: input.operator,
            message: `Linked document ${input.documentId} to task`,
          },
        },
      },
    )
  }

  await documents.updateOne(
    { _id: documentObjectId },
    {
      $set: {
        updated_at: timestamp,
      },
      $addToSet: {
        linked_task_ids: taskObjectId,
      },
    },
  )

  if (!alreadyLinked) {
    await insertActivity({
      source: "document",
      status: "ok",
      eventType: "task_linked_document",
      message: `Linked document "${existingDocument.title}" to task ${input.taskId}`,
      assignee: existingDocument.assignee,
      agentId: existingDocument.agentId,
      taskId: input.taskId,
      metadata: {
        operator: input.operator,
        documentId: input.documentId,
      },
    })
  }

  const updatedTask = await tasks.findOne({ _id: taskObjectId })
  if (!updatedTask) {
    throw new Error("Task disappeared during update")
  }
  const updatedDocument = await documents.findOne({ _id: documentObjectId })
  if (!updatedDocument) {
    throw new Error("Document disappeared during update")
  }
  return {
    task: toTask(updatedTask),
    document: toMissionDocument(updatedDocument),
    alreadyLinked,
  }
}

export async function listActivities(filters: ListActivitiesFilters = {}) {
  const { activities } = await getMissionCollections()
  const query: Record<string, unknown> = {}

  if (filters.source) {
    query.source = filters.source
  }
  if (filters.status) {
    query.status = filters.status
  }
  if (filters.assignee) {
    query.assignee = filters.assignee
  }
  if (filters.eventType) {
    query.eventType = filters.eventType
  }
  if (filters.before) {
    query.created_at = { $lt: filters.before }
  }

  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200)
  const docs = await activities.find(query).sort({ created_at: -1 }).limit(limit + 1).toArray()
  const hasMore = docs.length > limit
  const records = docs.slice(0, limit).map((doc) => toActivity(doc))
  const nextCursor = hasMore ? records.at(-1)?.created_at : undefined

  return {
    activities: records,
    nextCursor,
    hasMore,
  }
}

export async function ingestActivities(events: Omit<ActivityDocument, "_id">[]) {
  const { activities } = await getMissionCollections()
  if (events.length === 0) {
    return { insertedCount: 0 }
  }
  let insertedCount = 0
  for (const event of events) {
    if (event.dedupeKey) {
      const result = await activities.updateOne(
        { dedupeKey: event.dedupeKey },
        { $setOnInsert: event },
        { upsert: true },
      )
      if (result.upsertedCount > 0) {
        insertedCount += 1
      }
      continue
    }

    await activities.insertOne(event)
    insertedCount += 1
  }
  return { insertedCount }
}

export async function getAgentHealth(input: { scope?: "all" | "active_defaults" } = {}) {
  const { tasks, activities, documents } = await getMissionCollections()
  const roster: Assignee[] =
    input.scope === "active_defaults"
      ? [...ACTIVE_DEFAULT_ASSIGNEES] as Assignee[]
      : [...ASSIGNEES] as Assignee[]
  const taskDocs = await tasks.find({ assignee: { $in: roster } }).toArray()
  const documentDocs = await documents
    .find({ assignee: { $in: roster } })
    .project<Pick<MissionDocumentRecord, "assignee" | "taskId">>({ assignee: 1, taskId: 1 })
    .toArray()
  const latestActivities = await activities
    .aggregate<{ assignee: Assignee; created_at: string; message: string; status: ActivityStatus }>([
      { $match: { assignee: { $in: roster } } },
      { $sort: { created_at: -1 } },
      {
        $group: {
          _id: "$assignee",
          assignee: { $first: "$assignee" },
          created_at: { $first: "$created_at" },
          message: { $first: "$message" },
          status: { $first: "$status" },
        },
      },
    ])
    .toArray()
  const latestCronByAssignee = await activities
    .aggregate<{ assignee: Assignee; nextRunAtMs?: number }>([
      {
        $match: {
          assignee: { $in: roster },
          source: "cron",
          "metadata.nextRunAtMs": { $exists: true },
        },
      },
      { $sort: { created_at: -1 } },
      {
        $group: {
          _id: "$assignee",
          assignee: { $first: "$assignee" },
          nextRunAtMs: { $first: "$metadata.nextRunAtMs" },
        },
      },
    ])
    .toArray()

  const latestByAssignee = new Map(latestActivities.map((item) => [item.assignee, item]))
  const latestCronByAssigneeMap = new Map(latestCronByAssignee.map((item) => [item.assignee, item.nextRunAtMs]))
  const now = Date.now()

  const health = roster.map<AgentHealth>((assignee) => {
    const assigneeTasks = taskDocs.filter((task) => task.assignee === assignee)
    const assigneeDocuments = documentDocs.filter((document) => document.assignee === assignee)
    const lastActivity = latestByAssignee.get(assignee)
    const nextCronAtMsRaw = latestCronByAssigneeMap.get(assignee)
    const nextCronAt =
      typeof nextCronAtMsRaw === "number" && Number.isFinite(nextCronAtMsRaw) && nextCronAtMsRaw > 0
        ? new Date(nextCronAtMsRaw).toISOString()
        : undefined
    const nextCronInSeconds =
      typeof nextCronAtMsRaw === "number" && Number.isFinite(nextCronAtMsRaw) && nextCronAtMsRaw > 0
        ? Math.max(0, Math.floor((nextCronAtMsRaw - now) / 1000))
        : undefined
    const lastActivityAtMs = lastActivity ? new Date(lastActivity.created_at).getTime() : 0
    const reviewOrDoneWithoutDocuments = assigneeTasks.filter(
      (task) =>
        (task.status === "review" || task.status === "done") &&
        (task.linked_document_ids?.length ?? 0) === 0,
    ).length

    return {
      assignee,
      taskCounts: {
        todo: assigneeTasks.filter((task) => task.status === "todo").length,
        in_progress: assigneeTasks.filter((task) => task.status === "in_progress").length,
        review: assigneeTasks.filter((task) => task.status === "review").length,
        blocked: assigneeTasks.filter((task) => task.status === "blocked").length,
        done: assigneeTasks.filter((task) => task.status === "done").length,
      },
      artifactSignals: {
        unlinkedDocuments: assigneeDocuments.filter((document) => !document.taskId).length,
        reviewOrDoneWithoutDocuments,
      },
      lastActivityAt: lastActivity?.created_at,
      lastActivityMessage: lastActivity?.message,
      lastActivityStatus: lastActivity?.status,
      nextCronAt,
      nextCronInSeconds,
      stale: !lastActivityAtMs || now - lastActivityAtMs > 20 * 60 * 1000,
    }
  })

  return health
}

export async function getRealtimeSignals() {
  const { tasks, activities, notifications, documents } = await getMissionCollections()
  const [latestTask, latestActivity, latestNotification, latestDocument, pendingNotificationCount] = await Promise.all([
    tasks.find({}, { projection: { updated_at: 1 } }).sort({ updated_at: -1 }).limit(1).next(),
    activities.find({}, { projection: { created_at: 1 } }).sort({ created_at: -1 }).limit(1).next(),
    notifications.find({}, { projection: { updated_at: 1 } }).sort({ updated_at: -1 }).limit(1).next(),
    documents.find({}, { projection: { updated_at: 1 } }).sort({ updated_at: -1 }).limit(1).next(),
    notifications.countDocuments({ status: "pending" }),
  ])

  const taskCursor = latestTask?.updated_at ?? "0"
  const activityCursor = latestActivity?.created_at ?? "0"
  const notificationCursor = latestNotification?.updated_at ?? "0"
  const documentCursor = latestDocument?.updated_at ?? "0"
  const revision = `${taskCursor}|${activityCursor}|${notificationCursor}|${documentCursor}|${pendingNotificationCount}`

  return {
    revision,
    taskCursor,
    activityCursor,
    notificationCursor,
    documentCursor,
    pendingNotificationCount,
    serverTime: nowIso(),
  }
}
