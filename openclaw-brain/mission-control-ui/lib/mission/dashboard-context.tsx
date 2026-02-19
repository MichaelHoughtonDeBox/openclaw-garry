"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import {
  ackNotificationDelivery,
  appendTaskLog,
  createTaskMessage,
  createDocument,
  createTask,
  deleteTask,
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

export type DocumentFilters = {
  assignee?: Assignee
  source?: DocumentSource
  q: string
  taskId: string
}

export type DashboardContextValue = {
  // Data
  snapshot: DashboardSnapshot | null
  documents: MissionDocument[]
  notifications: Notification[]
  taskMessagesByTaskId: Record<string, TaskMessage[]>

  // UI state
  loading: boolean
  refreshing: boolean
  notificationsLoading: boolean
  busy: boolean
  error: string | null
  selectedTaskId: string | null
  selectedDocument: MissionDocument | null
  taskMessagesLoading: boolean
  boardFilter: "all" | "focused" | TaskStatus
  boardSearch: string
  focusedAssignee: Assignee | undefined
  feedScope: FeedScope
  feedAssignee: Assignee | undefined
  notificationStatusFilter: NotificationStatus | "all"
  notificationAssigneeFilter: Assignee | undefined
  documentFilters: DocumentFilters
  streamConnected: boolean
  lastReloadDurationMs: number | undefined
  pendingNotificationCount: number
  operator: string

  // Derived
  queueSize: number
  activeAgentCount: number
  activeMentionAssignees: Assignee[]
  selectedTask: Task | null
  selectedTaskLinkedDocuments: MissionDocument[]

  // Setters
  setSelectedTaskId: (id: string | null) => void
  setSelectedDocument: (doc: MissionDocument | null) => void
  setBoardFilter: (filter: "all" | "focused" | TaskStatus) => void
  setBoardSearch: (search: string) => void
  setFeedScope: (scope: FeedScope) => void
  setFeedAssignee: (assignee: Assignee | undefined) => void
  setNotificationStatusFilter: (status: NotificationStatus | "all") => void
  setNotificationAssigneeFilter: (assignee: Assignee | undefined) => void
  setDocumentFilters: (patch: Partial<DocumentFilters> | ((prev: DocumentFilters) => DocumentFilters)) => void
  setOperator: (operator: string) => void

  // Actions
  reload: () => Promise<void>
  handleFocusAssignee: (assignee?: Assignee) => void
  handleOpenDocumentById: (documentId: string) => Promise<void>
  handleCreateTask: (input: Parameters<typeof createTask>[0]) => Promise<void>
  handleTransitionStatus: (input: {
    taskId: string
    toStatus: TaskStatus
    note?: string
  }) => Promise<void>
  handleAppendLog: (input: { taskId: string; message: string }) => Promise<void>
  handleCreateTaskMessage: (input: {
    taskId: string
    content: string
    linked_document_ids?: string[]
  }) => Promise<void>
  handleReleaseDependencies: () => Promise<void>
  handleCreateDocument: (input: Parameters<typeof createDocument>[0]) => Promise<void>
  handleLinkDocuments: (input: { taskId: string; documentIds: string[] }) => Promise<void>
  handleUpdateDocument: (input: Parameters<typeof updateDocument>[0]) => Promise<void>
  handleAcknowledgeNotification: (input: {
    notificationId: string
    status: "delivered" | "failed"
    error?: string
  }) => Promise<void>
  handleDropStatusChange: (input: { taskId: string; toStatus: TaskStatus }) => Promise<void>
  handleDeleteTask: (taskId: string) => Promise<void>
}

const DashboardContext = createContext<DashboardContextValue | null>(null)

export function useDashboard() {
  const ctx = useContext(DashboardContext)
  if (!ctx) {
    throw new Error("useDashboard must be used within DashboardProvider")
  }
  return ctx
}

type DashboardProviderProps = {
  children: ReactNode
}

/**
 * Provides shared dashboard state, data fetching, and handlers to all mission control views.
 * Wraps the shell and page content; consumers use useDashboard() to access.
 *
 * @param props.children - Shell and page content (typically DashboardShell)
 * @returns Provider wrapping children
 */
export function DashboardProvider({ children }: DashboardProviderProps) {
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
  const [documentFilters, setDocumentFiltersState] = useState<DocumentFilters>({
    q: "",
    taskId: "",
  })
  const [operator, setOperator] = useState("michael")
  const lastStreamRevisionRef = useRef<string>("")
  const reloadInFlightRef = useRef(false)

  const setDocumentFilters = useCallback(
    (patch: Partial<DocumentFilters> | ((prev: DocumentFilters) => DocumentFilters)) => {
      setDocumentFiltersState((prev) => (typeof patch === "function" ? patch(prev) : { ...prev, ...patch }))
    },
    [],
  )

  const selectedTask = useMemo(
    () => snapshot?.tasks.tasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, snapshot],
  )

  const selectedTaskLinkedDocuments = useMemo(() => {
    if (!selectedTask) return []
    const linkedIds = new Set(selectedTask.linked_document_ids)
    return documents.filter((doc) => linkedIds.has(doc.id))
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
    if (health.length === 0) return []
    const active = health
      .filter((agent: AgentHealth) => !agent.stale)
      .map((agent: AgentHealth) => agent.assignee)
    return active.length > 0 ? active : health.map((agent: AgentHealth) => agent.assignee)
  }, [snapshot?.health])

  const reload = useCallback(async () => {
    if (reloadInFlightRef.current) return
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
        fetchNotifications({ status: "pending", limit: 120 }),
      ])
      setSnapshot(nextSnapshot)
      setDocuments(nextDocuments.documents)
      setNotifications(nextNotifications.notifications)
      setPendingNotificationCount(pendingNotifications.notifications.length)
      setLastReloadDurationMs(Math.max(1, Math.round(performance.now() - startedAt)))
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "Failed to load dashboard data."
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
      onConnected: () => setStreamConnected(true),
      onTick: (payload: MissionStreamTick) => {
        setStreamConnected(true)
        setPendingNotificationCount(payload.pendingNotificationCount)
        if (payload.revision === lastStreamRevisionRef.current) return
        lastStreamRevisionRef.current = payload.revision
        void reload()
      },
      onError: () => setStreamConnected(false),
    })
    return () => {
      setStreamConnected(false)
      unsubscribe()
    }
  }, [reload])

  useEffect(() => {
    if (!selectedTaskId) return
    let cancelled = false
    async function loadTaskMessages(taskId: string) {
      setTaskMessagesLoading(true)
      try {
        const response = await fetchTaskMessages(taskId, { limit: 100 })
        if (cancelled) return
        setTaskMessagesByTaskId((current) => ({
          ...current,
          [taskId]: response.messages,
        }))
      } catch (caughtError) {
        if (!cancelled) {
          const message =
            caughtError instanceof Error ? caughtError.message : "Failed to load task messages."
          setError(message)
        }
      } finally {
        if (!cancelled) setTaskMessagesLoading(false)
      }
    }
    void loadTaskMessages(selectedTaskId)
    return () => {
      cancelled = true
    }
  }, [selectedTaskId])

  const handleFocusAssignee = useCallback(
    (assignee?: Assignee) => {
      setFocusedAssignee(assignee)
      setBoardFilter((current) => (assignee ? "focused" : current === "focused" ? "all" : current))
      setFeedAssignee(assignee)
      setNotificationAssigneeFilter(assignee)
      setDocumentFilters((current) => ({ ...current, assignee }))
    },
    [setDocumentFilters],
  )

  const handleOpenDocumentById = useCallback(
    async (documentId: string) => {
      const existing = documents.find((d) => d.id === documentId)
      if (existing) {
        setSelectedDocument(existing)
        return
      }
      try {
        const loaded = await fetchDocument(documentId)
        setDocuments((current) => [
          loaded,
          ...current.filter((item) => item.id !== loaded.id),
        ])
        setSelectedDocument(loaded)
      } catch (caughtError) {
        const message =
          caughtError instanceof Error ? caughtError.message : "Failed to load document."
        setError(message)
      }
    },
    [documents],
  )

  const handleCreateTask = useCallback(
    async (input: Parameters<typeof createTask>[0]) => {
      setBusy(true)
      try {
        const result = await createTask(input)
        setSnapshot((current) => (current ? patchSnapshotTask(current, result.task) : current))
        setSelectedTaskId(result.task.id)
        await reload()
      } finally {
        setBusy(false)
      }
    },
    [reload],
  )

  const handleTransitionStatus = useCallback(
    async (input: {
      taskId: string
      toStatus: TaskStatus
      note?: string
    }) => {
      setBusy(true)
      try {
        const result = await transitionTaskStatus({
          ...input,
          operator,
        })
        setSnapshot((current) => (current ? patchSnapshotTask(current, result.task) : current))
        await reload()
      } finally {
        setBusy(false)
      }
    },
    [operator, reload],
  )

  const handleAppendLog = useCallback(
    async (input: { taskId: string; message: string }) => {
      setBusy(true)
      try {
        const result = await appendTaskLog({
          ...input,
          operator,
        })
        setSnapshot((current) => (current ? patchSnapshotTask(current, result.task) : current))
        await reload()
      } finally {
        setBusy(false)
      }
    },
    [operator, reload],
  )

  const handleCreateTaskMessage = useCallback(
    async (input: {
      taskId: string
      content: string
      linked_document_ids?: string[]
    }) => {
      setBusy(true)
      try {
        const result = await createTaskMessage({
          ...input,
          linked_document_ids: input.linked_document_ids ?? [],
          operator,
        })
        setTaskMessagesByTaskId((current) => {
          const existing = current[input.taskId] ?? []
          return {
            ...current,
            [input.taskId]: [
              result.message,
              ...existing.filter((m) => m.id !== result.message.id),
            ],
          }
        })
        await reload()
      } finally {
        setBusy(false)
      }
    },
    [operator, reload],
  )

  const handleReleaseDependencies = useCallback(async () => {
    setBusy(true)
    try {
      await releaseDependencies(operator)
      await reload()
    } finally {
      setBusy(false)
    }
  }, [operator, reload])

  const handleCreateDocument = useCallback(
    async (input: Parameters<typeof createDocument>[0]) => {
      setBusy(true)
      try {
        const result = await createDocument(input)
        setDocuments((current) => [
          result.document,
          ...current.filter((item) => item.id !== result.document.id),
        ])
        setSelectedDocument(result.document)
        await reload()
      } finally {
        setBusy(false)
      }
    },
    [reload],
  )

  const handleLinkDocuments = useCallback(
    async (input: { taskId: string; documentIds: string[] }) => {
      if (input.documentIds.length === 0) return
      setBusy(true)
      try {
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
    },
    [operator, reload],
  )

  const handleUpdateDocument = useCallback(
    async (input: Parameters<typeof updateDocument>[0]) => {
      setBusy(true)
      try {
        const result = await updateDocument(input)
        setDocuments((current) =>
          current.map((doc) =>
            doc.id === result.document.id ? result.document : doc,
          ),
        )
        setSelectedDocument(result.document)
        await reload()
      } finally {
        setBusy(false)
      }
    },
    [reload],
  )

  const handleAcknowledgeNotification = useCallback(
    async (input: {
      notificationId: string
      status: "delivered" | "failed"
      error?: string
    }) => {
      setBusy(true)
      try {
        await ackNotificationDelivery({
          ...input,
          operator,
        })
        await reload()
      } finally {
        setBusy(false)
      }
    },
    [operator, reload],
  )

  const handleDropStatusChange = useCallback(
    async (input: { taskId: string; toStatus: TaskStatus }) => {
      await handleTransitionStatus({
        ...input,
        note: `Status moved from board drag/drop to ${input.toStatus}`,
      })
    },
    [handleTransitionStatus],
  )

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      setBusy(true)
      setError(null)
      try {
        await deleteTask({ taskId, operator })
        setSnapshot((current) => {
          if (!current) return current
          const tasks = current.tasks.tasks.filter((t) => t.id !== taskId)
          const grouped = groupTasks(tasks)
          return {
            ...current,
            tasks: { tasks, grouped },
            reviewQueue: tasks.filter((t) => t.status === "review"),
          }
        })
        setSelectedTaskId(null)
        await reload()
      } catch (caughtError) {
        const message =
          caughtError instanceof Error ? caughtError.message : "Failed to delete task."
        setError(message)
      } finally {
        setBusy(false)
      }
    },
    [operator, reload],
  )

  const value = useMemo<DashboardContextValue>(
    () => ({
      snapshot,
      documents,
      notifications,
      taskMessagesByTaskId,
      loading,
      refreshing,
      notificationsLoading,
      busy,
      error,
      selectedTaskId,
      selectedDocument,
      taskMessagesLoading,
      boardFilter,
      boardSearch,
      focusedAssignee,
      feedScope,
      feedAssignee,
      notificationStatusFilter,
      notificationAssigneeFilter,
      documentFilters,
      streamConnected,
      lastReloadDurationMs,
      pendingNotificationCount,
      operator,
      queueSize,
      activeAgentCount,
      activeMentionAssignees,
      selectedTask,
      selectedTaskLinkedDocuments,
      setSelectedTaskId,
      setSelectedDocument,
      setBoardFilter,
      setBoardSearch,
      setFeedScope,
      setFeedAssignee,
      setNotificationStatusFilter,
      setNotificationAssigneeFilter,
      setDocumentFilters,
      setOperator,
      reload,
      handleFocusAssignee,
      handleOpenDocumentById,
      handleCreateTask,
      handleTransitionStatus,
      handleAppendLog,
      handleCreateTaskMessage,
      handleReleaseDependencies,
      handleCreateDocument,
      handleLinkDocuments,
      handleUpdateDocument,
      handleAcknowledgeNotification,
      handleDropStatusChange,
      handleDeleteTask,
    }),
    [
      snapshot,
      documents,
      notifications,
      taskMessagesByTaskId,
      loading,
      refreshing,
      notificationsLoading,
      busy,
      error,
      selectedTaskId,
      selectedDocument,
      taskMessagesLoading,
      boardFilter,
      boardSearch,
      focusedAssignee,
      feedScope,
      feedAssignee,
      notificationStatusFilter,
      notificationAssigneeFilter,
      documentFilters,
      streamConnected,
      lastReloadDurationMs,
      pendingNotificationCount,
      operator,
      queueSize,
      activeAgentCount,
      activeMentionAssignees,
      selectedTask,
      selectedTaskLinkedDocuments,
      setDocumentFilters,
      reload,
      handleFocusAssignee,
      handleOpenDocumentById,
      handleCreateTask,
      handleTransitionStatus,
      handleAppendLog,
      handleCreateTaskMessage,
      handleReleaseDependencies,
      handleCreateDocument,
      handleLinkDocuments,
      handleUpdateDocument,
      handleAcknowledgeNotification,
      handleDropStatusChange,
      handleDeleteTask,
    ],
  )

  return (
    <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
  )
}
