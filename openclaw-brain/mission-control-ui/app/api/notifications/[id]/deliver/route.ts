import { ackNotificationSchema } from "@/lib/mission/schemas"
import { ackNotificationDelivery } from "@/lib/mission/repository"
import { jsonError, jsonOk } from "@/lib/http"
import {
  enforceMutationRateLimit,
  resolveOperator,
  validateMutationSecret,
} from "@/lib/security"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const secretError = validateMutationSecret(request)
  if (secretError) {
    return secretError
  }
  const rateLimitError = enforceMutationRateLimit(request)
  if (rateLimitError) {
    return rateLimitError
  }

  try {
    const { id } = await context.params
    const payload = ackNotificationSchema.parse(await request.json())
    const operator = payload.operator ?? resolveOperator(request, "notification-worker")
    const notification = await ackNotificationDelivery({
      notificationId: id,
      status: payload.status,
      operator,
      error: payload.error,
    })
    return jsonOk({ notification })
  } catch (error) {
    return jsonError(error)
  }
}
