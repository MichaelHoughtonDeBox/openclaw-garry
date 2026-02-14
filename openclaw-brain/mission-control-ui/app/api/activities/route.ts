import { ACTIVITY_SOURCES, ACTIVITY_STATUSES, ASSIGNEES } from "@/lib/mission/constants"
import { listActivities } from "@/lib/mission/repository"
import { jsonError, jsonOk } from "@/lib/http"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const sourceRaw = url.searchParams.get("source")
    const statusRaw = url.searchParams.get("status")
    const assigneeRaw = url.searchParams.get("assignee")
    const eventType = url.searchParams.get("eventType")?.trim() || undefined
    const before = url.searchParams.get("before")?.trim() || undefined
    const limitRaw = Number.parseInt(url.searchParams.get("limit") ?? "50", 10)
    const limit = Number.isFinite(limitRaw) ? limitRaw : 50

    const source =
      sourceRaw && ACTIVITY_SOURCES.includes(sourceRaw as (typeof ACTIVITY_SOURCES)[number])
        ? (sourceRaw as (typeof ACTIVITY_SOURCES)[number])
        : undefined
    const status =
      statusRaw && ACTIVITY_STATUSES.includes(statusRaw as (typeof ACTIVITY_STATUSES)[number])
        ? (statusRaw as (typeof ACTIVITY_STATUSES)[number])
        : undefined
    const assignee =
      assigneeRaw && ASSIGNEES.includes(assigneeRaw as (typeof ASSIGNEES)[number])
        ? (assigneeRaw as (typeof ASSIGNEES)[number])
        : undefined

    const data = await listActivities({
      source,
      status,
      assignee,
      eventType,
      before,
      limit,
    })
    return jsonOk(data)
  } catch (error) {
    return jsonError(error)
  }
}
