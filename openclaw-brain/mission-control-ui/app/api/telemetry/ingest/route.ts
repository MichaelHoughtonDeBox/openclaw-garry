import { ingestActivitiesRequestSchema } from "@/lib/mission/schemas"
import { ingestActivities } from "@/lib/mission/repository"
import { jsonError, jsonOk } from "@/lib/http"
import { authorizeTelemetryIngest } from "@/lib/security"

export const runtime = "nodejs"

export async function POST(request: Request) {
  if (!authorizeTelemetryIngest(request)) {
    return jsonOk(
      {
        error: "Telemetry ingest is unauthorized or MISSION_CONTROL_INGEST_TOKEN is not configured.",
      },
      { status: 401 },
    )
  }

  try {
    const payload = ingestActivitiesRequestSchema.parse(await request.json())
    const result = await ingestActivities(
      payload.events.map((event) => ({
        source: event.source,
        status: event.status,
        eventType: event.eventType,
        message: event.message,
        dedupeKey: event.dedupeKey,
        assignee: event.assignee,
        agentId: event.agentId,
        sessionKey: event.sessionKey,
        jobId: event.jobId,
        taskId: event.taskId,
        metadata: event.metadata,
        created_at: event.created_at ?? new Date().toISOString(),
      })),
    )
    return jsonOk(result)
  } catch (error) {
    return jsonError(error)
  }
}
