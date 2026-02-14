"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TaskPriorityBadge } from "@/components/mission/status-badge"
import type { Task } from "@/lib/mission/types"

type ReviewQueuePanelProps = {
  tasks: Task[]
  onOpenTask: (task: Task) => void
}

export function ReviewQueuePanel({ tasks, onOpenTask }: ReviewQueuePanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Review queue</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {tasks.length === 0 ? (
          <p className="text-xs text-muted-foreground">No tasks awaiting review.</p>
        ) : (
          tasks.map((task) => (
            <div key={task.id} className="rounded-md border p-2">
              <p className="text-xs font-medium">{task.task_name}</p>
              <p className="text-[11px] text-muted-foreground">assignee: {task.assignee}</p>
              <div className="mt-2 flex items-center justify-between">
                <TaskPriorityBadge priority={task.priority} />
                <Button size="sm" variant="outline" onClick={() => onOpenTask(task)}>
                  Open
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
