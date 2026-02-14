import { listNotificationsQuerySchema } from "@/lib/mission/schemas"
import { listNotifications } from "@/lib/mission/repository"
import { jsonError, jsonOk } from "@/lib/http"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const query = listNotificationsQuerySchema.parse({
      assignee: url.searchParams.get("assignee")?.trim() || undefined,
      status: url.searchParams.get("status")?.trim() || undefined,
      before: url.searchParams.get("before")?.trim() || undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    })
    const data = await listNotifications(query)
    return jsonOk(data)
  } catch (error) {
    return jsonError(error)
  }
}
