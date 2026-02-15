"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MessageSquareMore } from "lucide-react"
import { TaskPriorityBadge } from "@/components/mission/status-badge"
import { Badge } from "@/components/ui/badge"
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
              {task.labels.length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {task.labels.slice(0, 2).map((label) => (
                    <Badge key={`${task.id}-${label}`} variant="outline" className="rounded-md text-[10px]">
                      {label}
                    </Badge>
                  ))}
                </div>
              ) : null}
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TaskPriorityBadge priority={task.priority} compact />
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <MessageSquareMore className="size-3.5" />
                    {task.message_count}
                  </span>
                </div>
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
