import { updateTaskStatusSchema } from "@/lib/mission/schemas"
import { transitionTaskStatus } from "@/lib/mission/repository"
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

export async function PATCH(request: Request, context: RouteContext) {
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
    const payload = updateTaskStatusSchema.parse(await request.json())
    const operator = payload.operator ?? resolveOperator(request, "garry")
    const task = await transitionTaskStatus({
      taskId: id,
      toStatus: payload.toStatus,
      operator,
      note: payload.note,
    })

    return jsonOk({ task })
  } catch (error) {
    return jsonError(error)
  }
}
