"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { LayoutDashboard, Link2, RefreshCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { ActivityFeed } from "@/components/mission/activity-feed"
import { AgentHealthCards } from "@/components/mission/agent-health-cards"
import { DocumentComposerDialog } from "@/components/mission/document-composer-dialog"
import { DocumentDetailSheet } from "@/components/mission/document-detail-sheet"
import { DocumentListPanel } from "@/components/mission/document-list-panel"
import { KanbanBoard } from "@/components/mission/kanban-board"
import { ReviewQueuePanel } from "@/components/mission/review-queue-panel"
import { TaskComposerDialog } from "@/components/mission/task-composer-dialog"
import { TaskDetailSheet } from "@/components/mission/task-detail-sheet"
import {
  appendTaskLog,
  createTaskMessage,
  createDocument,
  createTask,
  fetchDocument,
  fetchTaskMessages,
  fetchDocuments,
  fetchDashboardSnapshot,
  linkDocumentToTask,
  releaseDependencies,
  transitionTaskStatus,
  updateDocument,
  type DashboardSnapshot,
} from "@/lib/mission/client"
import { TASK_STATUSES } from "@/lib/mission/constants"
import type {
  Assignee,
  DocumentSource,
  MissionDocument,
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
  const existing = snapshot.tasks.tasks.some((candidate) => candidate.id === task.id)
  const tasks = existing
    ? snapshot.tasks.tasks.map((candidate) => (candidate.id === task.id ? task : candidate))
    : [task, ...snapshot.tasks.tasks]
  const grouped = groupTasks(tasks)
  return {
    ...snapshot,
    tasks: { tasks, grouped },
    reviewQueue: tasks.filter((candidate) => candidate.status === "review"),
  }
}

const POLL_INTERVAL_MS = 7_000

export function MissionControlDashboard() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null)
  const [documents, setDocuments] = useState<MissionDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [selectedDocument, setSelectedDocument] = useState<MissionDocument | null>(null)
  const [taskMessagesByTaskId, setTaskMessagesByTaskId] = useState<Record<string, TaskMessage[]>>({})
  const [taskMessagesLoading, setTaskMessagesLoading] = useState(false)
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
    try {
      setError(null)
      setRefreshing(true)
      // Keep task/health/activity data and document artifacts in sync on each poll cycle.
      const [nextSnapshot, nextDocuments] = await Promise.all([
        fetchDashboardSnapshot(),
        fetchDocuments({
          assignee: documentFilters.assignee,
          source: documentFilters.source,
          q: documentFilters.q.trim() || undefined,
          taskId: documentFilters.taskId.trim() || undefined,
          limit: 40,
        }),
      ])
      setSnapshot(nextSnapshot)
      setDocuments(nextDocuments.documents)
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Failed to load dashboard data."
      setError(message)
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }, [documentFilters])

  useEffect(() => {
    reload()
    const timer = window.setInterval(reload, POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
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
    <main className="min-h-screen bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <LayoutDashboard className="size-4" />
                  Mission Control
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Observe agent execution and close task loops without leaving the board.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={operator}
                  onChange={(event) => setOperator(event.target.value)}
                  className="w-44"
                  placeholder="operator name"
                />
                <TaskComposerDialog
                  operator={operator}
                  availableDocuments={documents}
                  disabled={busy}
                  onCreateTask={handleCreateTask}
                />
                <DocumentComposerDialog
                  operator={operator}
                  disabled={busy}
                  defaultAssignee="corey"
                  defaultAgentId="corey"
                  onCreateDocument={handleCreateDocument}
                />
                <Button
                  disabled={busy || refreshing}
                  variant="outline"
                  size="sm"
                  onClick={handleReleaseDependencies}
                >
                  <Link2 className="size-3.5" />
                  Release dependencies
                </Button>
                <Button disabled={refreshing} variant="outline" size="sm" onClick={reload}>
                  <RefreshCcw className={`size-3 ${refreshing ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </div>
            <Separator />
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            {loading ? <p className="text-xs text-muted-foreground">Loading dashboard...</p> : null}
          </CardHeader>
          <CardContent className="space-y-4">
            <AgentHealthCards health={snapshot?.health ?? []} />

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
              selectedTaskId={selectedTaskId ?? undefined}
              onSelectTask={(task) => setSelectedTaskId(task.id)}
            />

            <div className="grid gap-4 xl:grid-cols-2">
              <ReviewQueuePanel tasks={snapshot?.reviewQueue ?? []} onOpenTask={(task) => setSelectedTaskId(task.id)} />
              <DocumentListPanel
                documents={documents}
                filters={documentFilters}
                onFiltersChange={(patch) => setDocumentFilters((current) => ({ ...current, ...patch }))}
                onOpenDocument={(document) => setSelectedDocument(document)}
              />
            </div>
            <ActivityFeed activities={snapshot?.activities ?? []} />
          </CardContent>
        </Card>
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
