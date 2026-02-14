"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TaskPriorityBadge, TaskStatusBadge, TriggerStateBadge } from "@/components/mission/status-badge"
import type { Task, TaskStatus } from "@/lib/mission/types"

const KANBAN_ORDER: TaskStatus[] = ["todo", "in_progress", "review", "blocked", "done"]

type KanbanBoardProps = {
  grouped: Record<TaskStatus, Task[]>
  selectedTaskId?: string
  onSelectTask: (task: Task) => void
}

export function KanbanBoard({ grouped, selectedTaskId, onSelectTask }: KanbanBoardProps) {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {KANBAN_ORDER.map((status) => {
        const tasks = grouped[status] ?? []
        return (
          <Card key={status}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs uppercase tracking-wide">{status.replace("_", " ")}</CardTitle>
                <span className="text-xs text-muted-foreground">{tasks.length}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {tasks.length === 0 ? (
                <p className="text-xs text-muted-foreground">No tasks</p>
              ) : (
                tasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => onSelectTask(task)}
                    className={`w-full rounded-md border p-2 text-left transition hover:border-primary ${
                      selectedTaskId === task.id ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <p className="text-xs font-medium">{task.task_name}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{task.assignee}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <TaskStatusBadge status={task.status} />
                      <TaskPriorityBadge priority={task.priority} />
                      <TriggerStateBadge triggerState={task.trigger_state} />
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        )
      })}
    </section>
  )
}
