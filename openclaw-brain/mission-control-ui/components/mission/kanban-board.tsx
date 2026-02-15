"use client"

import { useMemo, useState } from "react"
import { FileText, GitBranch, MessageSquareMore, Search, StretchHorizontal, Unplug } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TaskPriorityBadge, TaskStatusBadge, TriggerStateBadge } from "@/components/mission/status-badge"
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
    return "border-l-destructive"
  }
  if (priority === "normal") {
    return "border-l-amber-500/70"
  }
  return "border-l-emerald-500/70"
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
              className={`border-border/70 bg-card/85 ${isDropTarget ? "ring-2 ring-primary/30" : ""}`}
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
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs uppercase tracking-wide">{status.replace("_", " ")}</CardTitle>
                  <span className="text-xs text-muted-foreground">{tasks.length}</span>
                </div>
                {blockedByDependency ? (
                  <p className="flex items-center gap-1 text-[10px] text-amber-600">
                    <Unplug className="size-3" />
                    {waitingCount} waiting on dependencies
                  </p>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-2">
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
                        // The payload includes source status so we can enforce legal transitions on drop.
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
                      className={`w-full rounded-xl border border-l-2 p-2 text-left transition ${
                        priorityCardAccent(task.priority)
                      } ${
                        selectedTaskId === task.id
                          ? "border-primary/50 bg-primary/10 shadow-[0_0_0_1px_rgba(0,0,0,0.02)]"
                          : "border-border/70 bg-background/70 hover:border-primary/30 hover:bg-background"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <TaskPriorityBadge priority={task.priority} compact />
                        <p className="text-[10px] text-muted-foreground">{formatRelativeTime(task.updated_at)}</p>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs font-semibold leading-4">{task.task_name}</p>
                      <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                        {compactDescription(task.description)}
                      </p>

                      <div className="mt-2 flex items-center gap-2">
                        <div className="grid size-5 shrink-0 place-items-center rounded-full border border-border/70 bg-muted/30 text-[10px] font-semibold">
                          {assigneeInitials(task.assignee)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-medium">
                            {getAssigneeProfile(task.assignee).displayName}
                          </p>
                          <p className="truncate text-[10px] text-muted-foreground">
                            {getAssigneeProfile(task.assignee).role}
                          </p>
                        </div>
                      </div>

                      {task.labels.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {task.labels.slice(0, 2).map((label) => (
                            <Badge key={`${task.id}-${label}`} variant="outline" className="rounded-md text-[10px]">
                              {label}
                            </Badge>
                          ))}
                          {task.labels.length > 2 ? (
                            <Badge variant="outline" className="rounded-md text-[10px]">
                              +{task.labels.length - 2}
                            </Badge>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="mt-2 flex flex-wrap gap-1">
                        <TaskStatusBadge status={task.status} compact />
                        <TriggerStateBadge triggerState={task.trigger_state} compact />
                      </div>

                      <div className="mt-2 grid grid-cols-3 gap-1 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MessageSquareMore className="size-3.5" />
                          {task.message_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="size-3.5" />
                          {task.linked_document_ids.length}
                        </span>
                        <span className="flex items-center gap-1">
                          <GitBranch className="size-3.5" />
                          {task.dependencies.length}
                        </span>
                      </div>
                      {task.trigger_state === "WAITING" ? (
                        <p className="mt-1 text-[10px] text-amber-600">
                          Waiting on {task.dependencies.length} dependency
                          {task.dependencies.length === 1 ? "" : "ies"}
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
