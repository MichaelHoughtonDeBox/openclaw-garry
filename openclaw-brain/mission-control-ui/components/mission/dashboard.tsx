"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Link2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AgentsRail } from "@/components/mission/agents-rail"
import { DocumentComposerDialog } from "@/components/mission/document-composer-dialog"
import { DocumentDetailSheet } from "@/components/mission/document-detail-sheet"
import { DocumentListPanel } from "@/components/mission/document-list-panel"
import { KanbanBoard } from "@/components/mission/kanban-board"
import { LiveFeedPanel } from "@/components/mission/live-feed-panel"
import { ReviewQueuePanel } from "@/components/mission/review-queue-panel"
import { TaskComposerDialog } from "@/components/mission/task-composer-dialog"
import { TaskDetailSheet } from "@/components/mission/task-detail-sheet"
import { TopCommandBar } from "@/components/mission/top-command-bar"
import {
  ackNotificationDelivery,
  appendTaskLog,
  createTaskMessage,
  createDocument,
  createTask,
  fetchDocument,
  fetchTaskMessages,
  fetchDocuments,
  fetchDashboardSnapshot,
  fetchNotifications,
  linkDocumentToTask,
  openMissionStream,
  releaseDependencies,
  transitionTaskStatus,
  updateDocument,
  type DashboardSnapshot,
  type MissionStreamTick,
} from "@/lib/mission/client"
import { TASK_STATUSES } from "@/lib/mission/constants"
import { type FeedScope } from "@/lib/mission/presentation"
import type {
  Assignee,
  DocumentSource,
  MissionDocument,
  Notification,
  NotificationStatus,
  Task,
  AgentHealth,
  TaskMessage,
  TaskStatus,
} from "@/lib/mission/types"

function groupTasks(tasks: Task[]) {
  const grouped: Record<TaskStatus, Task[]> = {
    todo: [],
    in_progress: [],
    blocked: [],
    review: [],
    done: [],
  }
  for (const task of tasks) {
    grouped[task.status].push(task)
  }
  for (const status of TASK_STATUSES) {
    grouped[status].sort((left, right) => {
      return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()
    })
  }
  return grouped
}

function patchSnapshotTask(snapshot: DashboardSnapshot, task: Task): DashboardSnapshot {
  const previousTask = snapshot.tasks.tasks.find((candidate) => candidate.id === task.id)
  const mergedTask =
    previousTask && task.message_count === 0
      ? {
          ...task,
          message_count: previousTask.message_count,
        }
      : task
  const existing = snapshot.tasks.tasks.some((candidate) => candidate.id === task.id)
  const tasks = existing
    ? snapshot.tasks.tasks.map((candidate) => (candidate.id === mergedTask.id ? mergedTask : candidate))
    : [mergedTask, ...snapshot.tasks.tasks]
  const grouped = groupTasks(tasks)
  return {
    ...snapshot,
    tasks: { tasks, grouped },
    reviewQueue: tasks.filter((candidate) => candidate.status === "review"),
  }
}

const POLL_INTERVAL_MS = 30_000

export function MissionControlDashboard() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null)
  const [documents, setDocuments] = useState<MissionDocument[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [selectedDocument, setSelectedDocument] = useState<MissionDocument | null>(null)
  const [taskMessagesByTaskId, setTaskMessagesByTaskId] = useState<Record<string, TaskMessage[]>>({})
  const [taskMessagesLoading, setTaskMessagesLoading] = useState(false)
  const [boardFilter, setBoardFilter] = useState<"all" | "focused" | TaskStatus>("all")
  const [boardSearch, setBoardSearch] = useState("")
  const [focusedAssignee, setFocusedAssignee] = useState<Assignee | undefined>()
  const [feedScope, setFeedScope] = useState<FeedScope>("all")
  const [feedAssignee, setFeedAssignee] = useState<Assignee | undefined>()
  const [notificationStatusFilter, setNotificationStatusFilter] = useState<NotificationStatus | "all">("all")
  const [notificationAssigneeFilter, setNotificationAssigneeFilter] = useState<Assignee | undefined>()
  const [streamConnected, setStreamConnected] = useState(false)
  const [lastReloadDurationMs, setLastReloadDurationMs] = useState<number | undefined>(undefined)
  const [pendingNotificationCount, setPendingNotificationCount] = useState(0)
  const [documentFilters, setDocumentFilters] = useState<{
    assignee?: Assignee
    source?: DocumentSource
    q: string
    taskId: string
  }>({
    q: "",
    taskId: "",
  })
  const [operator, setOperator] = useState("michael")
  const lastStreamRevisionRef = useRef<string>("")
  const reloadInFlightRef = useRef(false)

  const selectedTask = useMemo(
    () => snapshot?.tasks.tasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, snapshot],
  )

  const selectedTaskLinkedDocuments = useMemo(() => {
    if (!selectedTask) {
      return []
    }
    const linkedIds = new Set(selectedTask.linked_document_ids)
    return documents.filter((document) => linkedIds.has(document.id))
  }, [documents, selectedTask])

  const queueSize = useMemo(
    () => (snapshot?.tasks.tasks ?? []).filter((task) => task.status !== "done").length,
    [snapshot?.tasks.tasks],
  )

  const activeAgentCount = useMemo(
    () => (snapshot?.health ?? []).filter((agent) => !agent.stale).length,
    [snapshot?.health],
  )

  const activeMentionAssignees = useMemo(() => {
    const health = snapshot?.health ?? []
    if (health.length === 0) {
      return []
    }
    // Prefer currently active agents; fall back to all known health rows if all are stale.
    const active = health.filter((agent: AgentHealth) => !agent.stale).map((agent: AgentHealth) => agent.assignee)
    return active.length > 0 ? active : health.map((agent: AgentHealth) => agent.assignee)
  }, [snapshot?.health])

  const reload = useCallback(async () => {
    if (reloadInFlightRef.current) {
      return
    }
    reloadInFlightRef.current = true
    const startedAt = performance.now()
    try {
      setError(null)
      setRefreshing(true)
      setNotificationsLoading(true)
      const effectiveDocumentAssignee = documentFilters.assignee ?? focusedAssignee
      const effectiveNotificationAssignee = notificationAssigneeFilter ?? focusedAssignee
      const effectiveNotificationStatus =
        notificationStatusFilter === "all" ? undefined : notificationStatusFilter

      // Keep task/health/activity data and document artifacts in sync on each poll cycle.
      const [nextSnapshot, nextDocuments, nextNotifications, pendingNotifications] = await Promise.all([
        fetchDashboardSnapshot(),
        fetchDocuments({
          assignee: effectiveDocumentAssignee,
          source: documentFilters.source,
          q: documentFilters.q.trim() || undefined,
          taskId: documentFilters.taskId.trim() || undefined,
          limit: 40,
        }),
        fetchNotifications({
          assignee: effectiveNotificationAssignee,
          status: effectiveNotificationStatus,
          limit: 60,
        }),
        fetchNotifications({
          status: "pending",
          limit: 120,
        }),
      ])
      setSnapshot(nextSnapshot)
      setDocuments(nextDocuments.documents)
      setNotifications(nextNotifications.notifications)
      setPendingNotificationCount(pendingNotifications.notifications.length)
      setLastReloadDurationMs(Math.max(1, Math.round(performance.now() - startedAt)))
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Failed to load dashboard data."
      setError(message)
    } finally {
      reloadInFlightRef.current = false
      setRefreshing(false)
      setNotificationsLoading(false)
      setLoading(false)
    }
  }, [documentFilters, focusedAssignee, notificationAssigneeFilter, notificationStatusFilter])

  useEffect(() => {
    void reload()
    const timer = window.setInterval(reload, POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [reload])

  useEffect(() => {
    const unsubscribe = openMissionStream({
      onConnected: () => {
        setStreamConnected(true)
      },
      onTick: (payload: MissionStreamTick) => {
        setStreamConnected(true)
        setPendingNotificationCount(payload.pendingNotificationCount)
        if (payload.revision === lastStreamRevisionRef.current) {
          return
        }
        lastStreamRevisionRef.current = payload.revision
        void reload()
      },
      onError: () => {
        setStreamConnected(false)
      },
    })

    return () => {
      setStreamConnected(false)
      unsubscribe()
    }
  }, [reload])

  useEffect(() => {
    if (!selectedTaskId) {
      return
    }
    let cancelled = false

    async function loadTaskMessages(taskId: string) {
      setTaskMessagesLoading(true)
      try {
        const response = await fetchTaskMessages(taskId, { limit: 100 })
        if (cancelled) {
          return
        }
        setTaskMessagesByTaskId((current) => ({
          ...current,
          [taskId]: response.messages,
        }))
      } catch (caughtError) {
        if (cancelled) {
          return
        }
        const message = caughtError instanceof Error ? caughtError.message : "Failed to load task messages."
        setError(message)
      } finally {
        if (!cancelled) {
          setTaskMessagesLoading(false)
        }
      }
    }

    void loadTaskMessages(selectedTaskId)
    return () => {
      cancelled = true
    }
  }, [selectedTaskId])

  async function handleCreateTask(input: Parameters<typeof createTask>[0]) {
    setBusy(true)
    try {
      const result = await createTask(input)
      setSnapshot((current) => (current ? patchSnapshotTask(current, result.task) : current))
      setSelectedTaskId(result.task.id)
      await reload()
    } finally {
      setBusy(false)
    }
  }

  async function handleTransitionStatus(input: {
    taskId: string
    toStatus: TaskStatus
    note?: string
  }) {
    setBusy(true)
    try {
      const result = await transitionTaskStatus({
        taskId: input.taskId,
        toStatus: input.toStatus,
        note: input.note,
        operator,
      })
      setSnapshot((current) => (current ? patchSnapshotTask(current, result.task) : current))
      await reload()
    } finally {
      setBusy(false)
    }
  }

  async function handleAppendLog(input: { taskId: string; message: string }) {
    setBusy(true)
    try {
      const result = await appendTaskLog({
        taskId: input.taskId,
        message: input.message,
        operator,
      })
      setSnapshot((current) => (current ? patchSnapshotTask(current, result.task) : current))
      await reload()
    } finally {
      setBusy(false)
    }
  }

  async function handleCreateTaskMessage(input: {
    taskId: string
    content: string
    linked_document_ids?: string[]
  }) {
    setBusy(true)
    try {
      const result = await createTaskMessage({
        taskId: input.taskId,
        content: input.content,
        linked_document_ids: input.linked_document_ids ?? [],
        operator,
      })
      setTaskMessagesByTaskId((current) => {
        const existing = current[input.taskId] ?? []
        return {
          ...current,
          [input.taskId]: [result.message, ...existing.filter((message) => message.id !== result.message.id)],
        }
      })
      await reload()
    } finally {
      setBusy(false)
    }
  }

  async function handleReleaseDependencies() {
    setBusy(true)
    try {
      await releaseDependencies(operator)
      await reload()
    } finally {
      setBusy(false)
    }
  }

  async function handleCreateDocument(
    input: Parameters<typeof createDocument>[0],
  ) {
    setBusy(true)
    try {
      const result = await createDocument(input)
      setDocuments((current) => [result.document, ...current.filter((item) => item.id !== result.document.id)])
      setSelectedDocument(result.document)
      await reload()
    } finally {
      setBusy(false)
    }
  }

  async function handleLinkDocuments(input: { taskId: string; documentIds: string[] }) {
    if (input.documentIds.length === 0) {
      return
    }
    setBusy(true)
    try {
      // Preserve action order so logs read in the same order the operator selected.
      for (const documentId of input.documentIds) {
        await linkDocumentToTask({
          taskId: input.taskId,
          documentId,
          operator,
        })
      }
      await reload()
    } finally {
      setBusy(false)
    }
  }

  async function handleUpdateDocument(input: Parameters<typeof updateDocument>[0]) {
    setBusy(true)
    try {
      const result = await updateDocument(input)
      setDocuments((current) => current.map((document) => (document.id === result.document.id ? result.document : document)))
      setSelectedDocument(result.document)
      await reload()
    } finally {
      setBusy(false)
    }
  }

  async function handleAcknowledgeNotification(input: {
    notificationId: string
    status: "delivered" | "failed"
    error?: string
  }) {
    setBusy(true)
    try {
      await ackNotificationDelivery({
        notificationId: input.notificationId,
        status: input.status,
        error: input.error,
        operator,
      })
      await reload()
    } finally {
      setBusy(false)
    }
  }

  async function handleDropStatusChange(input: { taskId: string; toStatus: TaskStatus }) {
    await handleTransitionStatus({
      taskId: input.taskId,
      toStatus: input.toStatus,
      note: `Status moved from board drag/drop to ${input.toStatus}`,
    })
  }

  function handleFocusAssignee(assignee?: Assignee) {
    setFocusedAssignee(assignee)
    setBoardFilter((current) => {
      if (assignee) {
        return "focused"
      }
      return current === "focused" ? "all" : current
    })
    setFeedAssignee(assignee)
    setNotificationAssigneeFilter(assignee)
    setDocumentFilters((current) => ({
      ...current,
      assignee,
    }))
  }

  async function handleOpenDocumentById(documentId: string) {
    const existingDocument = documents.find((document) => document.id === documentId)
    if (existingDocument) {
      setSelectedDocument(existingDocument)
      return
    }
    try {
      const loadedDocument = await fetchDocument(documentId)
      setDocuments((current) => [loadedDocument, ...current.filter((item) => item.id !== loadedDocument.id)])
      setSelectedDocument(loadedDocument)
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Failed to load document."
      setError(message)
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-4 sm:px-6">
      <div className="mx-auto max-w-[1800px] space-y-3">
        <TopCommandBar
          operator={operator}
          onOperatorChange={setOperator}
          activeAgents={activeAgentCount}
          totalAgents={(snapshot?.health ?? []).length}
          queuedTasks={queueSize}
          pendingNotifications={pendingNotificationCount}
          refreshing={refreshing}
          streamConnected={streamConnected}
          lastReloadDurationMs={lastReloadDurationMs}
          onRefresh={() => void reload()}
          actions={
            <>
              <TaskComposerDialog
                operator={operator}
                availableDocuments={documents}
                disabled={busy}
                onCreateTask={handleCreateTask}
              />
              <DocumentComposerDialog
                operator={operator}
                disabled={busy}
                defaultAssignee={focusedAssignee ?? "corey"}
                defaultAgentId={focusedAssignee ?? "corey"}
                onCreateDocument={handleCreateDocument}
              />
              <Button
                disabled={busy || refreshing}
                variant="outline"
                size="sm"
                className="h-8"
                onClick={handleReleaseDependencies}
              >
                <Link2 className="size-3.5" />
                Release deps
              </Button>
            </>
          }
        />

        {error ? <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p> : null}
        {loading ? <p className="rounded-lg border border-border/70 bg-card/70 px-3 py-2 text-xs text-muted-foreground">Loading dashboard...</p> : null}

        <div className="grid gap-3 xl:grid-cols-[280px_minmax(0,1fr)_380px]">
          <AgentsRail
            health={snapshot?.health ?? []}
            focusedAssignee={focusedAssignee}
            onFocusAssignee={handleFocusAssignee}
          />

          <section className="space-y-3">
            <KanbanBoard
              grouped={
                snapshot?.tasks.grouped ?? {
                  todo: [],
                  in_progress: [],
                  blocked: [],
                  review: [],
                  done: [],
                }
              }
              allTasks={snapshot?.tasks.tasks ?? []}
              boardFilter={boardFilter}
              search={boardSearch}
              assigneeFilter={focusedAssignee}
              busy={busy}
              selectedTaskId={selectedTaskId ?? undefined}
              onBoardFilterChange={setBoardFilter}
              onSearchChange={setBoardSearch}
              onSelectTask={(task) => setSelectedTaskId(task.id)}
              onDropStatusChange={handleDropStatusChange}
            />

            <div className="grid gap-3 xl:grid-cols-2">
              <ReviewQueuePanel
                tasks={(snapshot?.reviewQueue ?? []).filter((task) =>
                  focusedAssignee ? task.assignee === focusedAssignee : true,
                )}
                onOpenTask={(task) => setSelectedTaskId(task.id)}
              />
              <DocumentListPanel
                documents={documents}
                filters={documentFilters}
                onFiltersChange={(patch) => setDocumentFilters((current) => ({ ...current, ...patch }))}
                onOpenDocument={(document) => setSelectedDocument(document)}
              />
            </div>
          </section>

          <LiveFeedPanel
            activities={snapshot?.activities ?? []}
            notifications={notifications}
            feedScope={feedScope}
            feedAssignee={feedAssignee}
            notificationStatusFilter={notificationStatusFilter}
            notificationAssigneeFilter={notificationAssigneeFilter}
            loadingNotifications={notificationsLoading}
            busy={busy}
            onFeedScopeChange={setFeedScope}
            onFeedAssigneeChange={setFeedAssignee}
            onNotificationStatusFilterChange={setNotificationStatusFilter}
            onNotificationAssigneeFilterChange={setNotificationAssigneeFilter}
            onAcknowledgeNotification={handleAcknowledgeNotification}
            onOpenTask={(taskId) => setSelectedTaskId(taskId)}
          />
        </div>
      </div>

      <TaskDetailSheet
        key={selectedTask?.id ?? "no-task-selected"}
        task={selectedTask}
        operator={operator}
        busy={busy}
        taskMessages={selectedTask ? taskMessagesByTaskId[selectedTask.id] ?? [] : []}
        taskMessagesLoading={taskMessagesLoading}
        mentionCandidates={activeMentionAssignees}
        linkedDocuments={selectedTaskLinkedDocuments}
        availableDocuments={documents}
        onClose={() => setSelectedTaskId(null)}
        onTransition={handleTransitionStatus}
        onAppendLog={handleAppendLog}
        onCreateTaskMessage={handleCreateTaskMessage}
        onLinkDocuments={handleLinkDocuments}
        onOpenDocument={handleOpenDocumentById}
        onCreateDocument={handleCreateDocument}
      />
      <DocumentDetailSheet
        key={selectedDocument?.id ?? "no-document-selected"}
        document={selectedDocument}
        operator={operator}
        busy={busy}
        onClose={() => setSelectedDocument(null)}
        onUpdateDocument={handleUpdateDocument}
      />
    </main>
  )
}
