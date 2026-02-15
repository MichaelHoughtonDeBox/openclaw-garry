import { ASSIGNEE_PROFILES, FEED_SCOPES } from "@/lib/mission/constants"
import type { Activity, Assignee } from "@/lib/mission/types"

export type FeedScope = (typeof FEED_SCOPES)[number]

const COMMENT_EVENT_MATCHERS = [/message/i, /comment/i, /mention/i]
const DECISION_EVENT_MATCHERS = [/decision/i, /approved/i, /request_changes/i, /task_status_changed/i]

export function getAssigneeProfile(assignee: Assignee) {
  return ASSIGNEE_PROFILES[assignee]
}

export function formatRelativeTime(isoTimestamp: string, nowMs = Date.now()) {
  const deltaMs = nowMs - new Date(isoTimestamp).getTime()
  if (!Number.isFinite(deltaMs)) {
    return "just now"
  }
  const absSeconds = Math.max(0, Math.floor(deltaMs / 1000))
  if (absSeconds < 60) {
    return `${absSeconds}s ago`
  }
  const minutes = Math.floor(absSeconds / 60)
  if (minutes < 60) {
    return `${minutes}m ago`
  }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours}h ago`
  }
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function activityMatchesScope(activity: Activity, scope: FeedScope) {
  if (scope === "all") {
    return true
  }

  const eventSignature = `${activity.eventType} ${activity.message}`.toLowerCase()
  if (scope === "comments") {
    return COMMENT_EVENT_MATCHERS.some((matcher) => matcher.test(eventSignature))
  }
  if (scope === "decisions") {
    return DECISION_EVENT_MATCHERS.some((matcher) => matcher.test(eventSignature))
  }
  // For "tasks", include everything that isn't comments/decisions to preserve high-signal operational events.
  return (
    !COMMENT_EVENT_MATCHERS.some((matcher) => matcher.test(eventSignature)) &&
    !DECISION_EVENT_MATCHERS.some((matcher) => matcher.test(eventSignature))
  )
}

export function assigneeInitials(assignee: Assignee) {
  const profile = getAssigneeProfile(assignee)
  const parts = profile.displayName.split(/\s+/).filter(Boolean)
  if (parts.length === 0) {
    return assignee.slice(0, 1).toUpperCase()
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 1).toUpperCase()
  }
  return `${parts[0]?.slice(0, 1) ?? ""}${parts[1]?.slice(0, 1) ?? ""}`.toUpperCase()
}
