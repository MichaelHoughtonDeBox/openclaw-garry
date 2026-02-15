import { Badge } from "@/components/ui/badge"
import type { TaskPriority, TaskStatus, TaskTriggerState } from "@/lib/mission/types"

function variantForStatus(status: TaskStatus): "default" | "secondary" | "destructive" | "outline" {
  if (status === "done") {
    return "default"
  }
  if (status === "blocked") {
    return "destructive"
  }
  if (status === "review") {
    return "secondary"
  }
  return "outline"
}

function priorityVariant(priority: TaskPriority): "default" | "secondary" | "outline" {
  if (priority === "urgent") {
    return "default"
  }
  if (priority === "normal") {
    return "secondary"
  }
  return "outline"
}

export function TaskStatusBadge({ status, compact }: { status: TaskStatus; compact?: boolean }) {
  return (
    <Badge variant={variantForStatus(status)} className={compact ? "h-5 rounded-md px-1.5 text-[10px]" : undefined}>
      {status.replace("_", " ")}
    </Badge>
  )
}

export function TaskPriorityBadge({ priority, compact }: { priority: TaskPriority; compact?: boolean }) {
  return (
    <Badge variant={priorityVariant(priority)} className={compact ? "h-5 rounded-md px-1.5 text-[10px]" : undefined}>
      {compact ? priority : `priority: ${priority}`}
    </Badge>
  )
}

export function TriggerStateBadge({ triggerState, compact }: { triggerState: TaskTriggerState; compact?: boolean }) {
  const variant = triggerState === "READY" ? "secondary" : triggerState === "WAITING" ? "outline" : "destructive"
  return (
    <Badge variant={variant} className={compact ? "h-5 rounded-md px-1.5 text-[10px]" : undefined}>
      {compact ? triggerState : `trigger: ${triggerState}`}
    </Badge>
  )
}
