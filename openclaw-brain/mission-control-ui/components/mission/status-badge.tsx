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

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge variant={variantForStatus(status)}>{status.replace("_", " ")}</Badge>
}

export function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
  return <Badge variant={priorityVariant(priority)}>priority: {priority}</Badge>
}

export function TriggerStateBadge({ triggerState }: { triggerState: TaskTriggerState }) {
  const variant = triggerState === "READY" ? "secondary" : triggerState === "WAITING" ? "outline" : "destructive"
  return <Badge variant={variant}>trigger: {triggerState}</Badge>
}
