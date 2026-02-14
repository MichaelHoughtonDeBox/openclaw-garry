export const TASK_STATUSES = ["todo", "in_progress", "blocked", "review", "done"] as const
export const TASK_PRIORITIES = ["urgent", "normal", "low"] as const
export const TASK_TRIGGER_STATES = ["READY", "WAITING", "RETRY"] as const
export const NOTIFICATION_STATUSES = ["pending", "delivered", "failed"] as const
export const MENTION_ALL_TOKEN = "all" as const

export const ASSIGNEES = [
  "garry",
  "corey",
  "tony",
  "michael",
  "shuri",
  "fury",
  "vision",
  "loki",
  "quill",
  "wanda",
  "pepper",
  "friday",
  "wong",
] as const

export const ACTIVE_DEFAULT_ASSIGNEES = ["garry", "corey", "tony"] as const
export const ACTIVITY_SOURCES = ["cron", "heartbeat", "task", "system", "operator", "document"] as const
export const ACTIVITY_STATUSES = ["ok", "error", "skipped", "info"] as const
export const DOCUMENT_SOURCES = ["agent", "operator", "import", "external", "reference"] as const

export const TRANSITIONS: Record<(typeof TASK_STATUSES)[number], (typeof TASK_STATUSES)[number][]> = {
  todo: ["in_progress", "blocked"],
  in_progress: ["review", "blocked", "todo"],
  review: ["done", "in_progress", "blocked"],
  blocked: ["todo", "in_progress"],
  done: [],
}
