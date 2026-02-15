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
  "ralph",
  "vision",
  "loki",
  "quill",
  "wanda",
  "pepper",
  "friday",
  "wong",
] as const

export const ACTIVE_DEFAULT_ASSIGNEES = ["garry", "corey", "tony", "shuri", "friday", "wong"] as const
export const ACTIVITY_SOURCES = ["cron", "heartbeat", "task", "system", "operator", "document"] as const
export const ACTIVITY_STATUSES = ["ok", "error", "skipped", "info"] as const
export const DOCUMENT_SOURCES = ["agent", "operator", "import", "external", "reference"] as const
export const FEED_SCOPES = ["all", "tasks", "comments", "decisions"] as const

export const ASSIGNEE_PROFILES = {
  garry: { displayName: "Garry", role: "Squad Lead", activeByDefault: true },
  corey: { displayName: "Corey", role: "Product Marketing", activeByDefault: true },
  tony: { displayName: "Tony", role: "Lead Engineer", activeByDefault: true },
  michael: { displayName: "Michael", role: "Human Approver", activeByDefault: true },
  shuri: { displayName: "Shuri", role: "Product Analyst", activeByDefault: false },
  ralph: { displayName: "Ralph", role: "Research Specialist", activeByDefault: false },
  vision: { displayName: "Vision", role: "SEO Analyst", activeByDefault: false },
  loki: { displayName: "Loki", role: "Content Writer", activeByDefault: false },
  quill: { displayName: "Quill", role: "Social Media", activeByDefault: false },
  wanda: { displayName: "Wanda", role: "Designer", activeByDefault: false },
  pepper: { displayName: "Pepper", role: "Email Marketing", activeByDefault: false },
  friday: { displayName: "Friday", role: "Developer", activeByDefault: false },
  wong: { displayName: "Wong", role: "Documentation", activeByDefault: false },
} as const satisfies Record<
  (typeof ASSIGNEES)[number],
  {
    displayName: string
    role: string
    activeByDefault: boolean
  }
>

export const TRANSITIONS: Record<(typeof TASK_STATUSES)[number], (typeof TASK_STATUSES)[number][]> = {
  todo: ["in_progress", "blocked"],
  in_progress: ["review", "blocked", "todo"],
  review: ["done", "in_progress", "blocked"],
  blocked: ["todo", "in_progress"],
  done: [],
}
