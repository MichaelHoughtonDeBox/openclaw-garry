"use client"

import { useMemo, useState } from "react"
import { FileText, GitBranch, MessageSquareMore, Search, StretchHorizontal, Unplug } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TaskPriorityBadge, TriggerStateBadge } from "@/components/mission/status-badge"
import { TRANSITIONS } from "@/lib/mission/constants"
import { assigneeInitials, formatRelativeTime, getAssigneeProfile } from "@/lib/mission/presentation"
import type { Assignee, Task, TaskStatus } from "@/lib/mission/types"

const KANBAN_ORDER: TaskStatus[] = ["todo", "in_progress", "review", "blocked", "done"]
const TAB_ORDER: Array<"all" | "focused" | TaskStatus> = ["all", "focused", ...KANBAN_ORDER]
type BoardFilter = "all" | "focused" | TaskStatus

type KanbanBoardProps = {
  grouped: Record<TaskStatus, Task[]>
  allTasks: Task[]
  boardFilter: BoardFilter
  search: string
  assigneeFilter?: Assignee
  busy?: boolean
  selectedTaskId?: string
  onBoardFilterChange: (filter: BoardFilter) => void
  onSearchChange: (search: string) => void
  onSelectTask: (task: Task) => void
  onDropStatusChange?: (input: { taskId: string; toStatus: TaskStatus }) => Promise<void>
}

function normalize(value: string) {
  return value.trim().toLowerCase()
}

function compactDescription(value: string) {
  // Keep card summaries readable by flattening markdown-ish syntax into plain text.
  return value
    .replace(/[#*_`>\[\]\(\)]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function priorityCardAccent(priority: Task["priority"]) {
  if (priority === "urgent") {
    return "border-l-4 border-l-destructive"
  }
  if (priority === "normal") {
    return "border-l-4 border-l-amber-500/80"
  }
  return "border-l-4 border-l-emerald-500/70"
}

/** Status-specific accent for column headers — mission-control industrial tone */
function statusColumnAccent(status: TaskStatus) {
  const base = "border-b-2"
  switch (status) {
    case "todo":
      return `${base} border-b-slate-400/50 dark:border-b-slate-500/40`
    case "in_progress":
      return `${base} border-b-sky-500/60 dark:border-b-sky-400/50`
    case "review":
      return `${base} border-b-amber-500/60 dark:border-b-amber-400/50`
    case "blocked":
      return `${base} border-b-rose-500/60 dark:border-b-rose-400/50`
    case "done":
      return `${base} border-b-emerald-500/50 dark:border-b-emerald-400/40`
    default:
      return base
  }
}

export function KanbanBoard({
  grouped,
  allTasks,
  boardFilter,
  search,
  assigneeFilter,
  busy,
  selectedTaskId,
  onBoardFilterChange,
  onSearchChange,
  onSelectTask,
  onDropStatusChange,
}: KanbanBoardProps) {
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null)
  const [dropStatus, setDropStatus] = useState<TaskStatus | null>(null)

  const filteredTaskIds = useMemo(() => {
    const query = normalize(search)
    const results = allTasks.filter((task) => {
      if (assigneeFilter && task.assignee !== assigneeFilter) {
        return false
      }
      if (!query) {
        return true
      }
      const signature = normalize(
        `${task.task_name} ${task.description} ${task.labels.join(" ")} ${task.assignee} ${task.priority}`,
      )
      return signature.includes(query)
    })
    return new Set(results.map((task) => task.id))
  }, [allTasks, assigneeFilter, search])

  const visibleStatuses = boardFilter === "all" || boardFilter === "focused" ? KANBAN_ORDER : [boardFilter]

  async function handleDrop(event: React.DragEvent<HTMLDivElement>, toStatus: TaskStatus) {
    event.preventDefault()
    const rawPayload = event.dataTransfer.getData("application/openclaw-task")
    setDropStatus(null)
    setDraggingTaskId(null)
    if (!rawPayload || !onDropStatusChange) {
      return
    }
    try {
      const payload = JSON.parse(rawPayload) as { taskId: string; fromStatus: TaskStatus }
      if (payload.fromStatus === toStatus) {
        return
      }
      if (!TRANSITIONS[payload.fromStatus]?.includes(toStatus)) {
        return
      }
      await onDropStatusChange({ taskId: payload.taskId, toStatus })
    } catch {
      // Ignore malformed drag payloads so the board remains interactive.
    }
  }

  return (
    <section className="space-y-3">
      <Card className="border-border/60 bg-card/90">
        <CardHeader className="space-y-3 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm uppercase tracking-[0.16em] text-muted-foreground">Mission queue</CardTitle>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <StretchHorizontal className="size-3.5" />
              drag cards to transition status
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {TAB_ORDER.map((filterKey) => {
              if (filterKey === "focused" && !assigneeFilter) {
                return null
              }
              const count =
                filterKey === "all"
                  ? allTasks.filter((task) => filteredTaskIds.has(task.id)).length
                  : filterKey === "focused"
                    ? allTasks.filter((task) => filteredTaskIds.has(task.id)).length
                  : grouped[filterKey]?.filter((task) => filteredTaskIds.has(task.id)).length ?? 0
              return (
                <Button
                  key={filterKey}
                  type="button"
                  size="sm"
                  variant={boardFilter === filterKey ? "default" : "outline"}
                  className="h-7 px-2 text-[11px]"
                  onClick={() => onBoardFilterChange(filterKey)}
                >
                  {filterKey.replace("_", " ")}
                  <Badge variant="secondary" className="ml-1 rounded-md text-[10px]">
                    {count}
                  </Badge>
                </Button>
              )
            })}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-2 size-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              className="h-8 pl-8 text-xs"
              placeholder="Search queue by title, tag, assignee, or priority..."
            />
          </div>
        </CardHeader>
      </Card>

      <div className={`grid gap-3 ${visibleStatuses.length >= 4 ? "xl:grid-cols-4 2xl:grid-cols-5" : "md:grid-cols-2"}`}>
        {visibleStatuses.map((status) => {
          const tasks = (grouped[status] ?? []).filter((task) => filteredTaskIds.has(task.id))
          const isDropTarget = dropStatus === status && draggingTaskId !== null

          const waitingCount = tasks.filter((task) => task.trigger_state === "WAITING").length
          const blockedByDependency = waitingCount > 0 && status === "todo"

          return (
            <Card
              key={status}
              className={`overflow-hidden border-border/70 bg-card/85 ${isDropTarget ? "ring-2 ring-primary/50 ring-offset-2 dark:ring-offset-background" : ""}`}
              onDragOver={(event) => {
                if (!onDropStatusChange) {
                  return
                }
                event.preventDefault()
                setDropStatus(status)
              }}
              onDragLeave={() => setDropStatus((current) => (current === status ? null : current))}
              onDrop={(event) => void handleDrop(event, status)}
            >
              <CardHeader className={`pb-3 pt-3 ${statusColumnAccent(status)}`}>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/90">
                    {status.replace("_", " ")}
                  </CardTitle>
                  <span className="rounded-md bg-muted/60 px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                    {tasks.length}
                  </span>
                </div>
                {blockedByDependency ? (
                  <p className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-500">
                    <Unplug className="size-3" />
                    {waitingCount} waiting on dependencies
                  </p>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-2.5">
                {tasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No tasks</p>
                ) : (
                  tasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      draggable={Boolean(onDropStatusChange)}
                      onDragStart={(event) => {
                        if (!onDropStatusChange) {
                          return
                        }
                        setDraggingTaskId(task.id)
                        event.dataTransfer.setData(
                          "application/openclaw-task",
                          JSON.stringify({ taskId: task.id, fromStatus: task.status }),
                        )
                        event.dataTransfer.effectAllowed = "move"
                      }}
                      onDragEnd={() => {
                        setDraggingTaskId(null)
                        setDropStatus(null)
                      }}
                      onClick={() => onSelectTask(task)}
                      className={`group relative w-full rounded-lg border p-3 text-left transition-all duration-200 ease-out ${
                        priorityCardAccent(task.priority)
                      } ${
                        selectedTaskId === task.id
                          ? "border-primary/60 bg-primary/10 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.12)] dark:shadow-[0_2px_14px_-4px_rgba(0,0,0,0.5)] ring-1 ring-primary/20"
                          : "border-border/60 bg-background/80 hover:border-border hover:bg-background hover:shadow-[0_4px_12px_-2px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.3)] active:scale-[0.99]"
                      } ${draggingTaskId === task.id ? "opacity-60" : ""}`}
                    >
                      {/* Header: task name as primary focus */}
                      <div className="space-y-1.5">
                        <p className="line-clamp-2 text-[13px] font-semibold leading-snug tracking-tight text-foreground">
                          {task.task_name}
                        </p>
                        <div className="flex items-center justify-between gap-2">
                          <TaskPriorityBadge priority={task.priority} compact />
                          <span className="text-[10px] text-muted-foreground">{formatRelativeTime(task.updated_at)}</span>
                        </div>
                      </div>

                      {/* Description preview */}
                      <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                        {compactDescription(task.description)}
                      </p>

                      {/* Compact meta row: assignee + artifacts */}
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="grid size-6 shrink-0 place-items-center rounded-full border border-border/60 bg-muted/50 text-[10px] font-semibold text-foreground/80">
                            {assigneeInitials(task.assignee)}
                          </div>
                          <p className="truncate text-[11px] font-medium text-foreground/90">
                            {getAssigneeProfile(task.assignee).displayName}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-2 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-0.5">
                            <MessageSquareMore className="size-3" />
                            {task.message_count}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <FileText className="size-3" />
                            {task.linked_document_ids.length}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <GitBranch className="size-3" />
                            {task.dependencies.length}
                          </span>
                        </div>
                      </div>

                      {/* Labels + trigger state — bottom row */}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {task.labels.slice(0, 2).map((label) => (
                          <Badge key={`${task.id}-${label}`} variant="outline" className="rounded-md text-[10px]">
                            {label}
                          </Badge>
                        ))}
                        {task.labels.length > 2 ? (
                          <Badge variant="outline" className="rounded-md text-[10px]">+{task.labels.length - 2}</Badge>
                        ) : null}
                        <TriggerStateBadge triggerState={task.trigger_state} compact />
                      </div>

                      {task.trigger_state === "WAITING" ? (
                        <p className="mt-1.5 text-[10px] text-amber-600 dark:text-amber-500">
                          Waiting on {task.dependencies.length} dependency{task.dependencies.length === 1 ? "" : "ies"}
                        </p>
                      ) : null}
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
      {busy ? <p className="text-[11px] text-muted-foreground">Updating queue…</p> : null}
    </section>
  )
}
