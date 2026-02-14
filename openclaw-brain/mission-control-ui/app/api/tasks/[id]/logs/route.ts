import { appendTaskLogSchema } from "@/lib/mission/schemas"
import { appendTaskLog } from "@/lib/mission/repository"
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
    const payload = appendTaskLogSchema.parse(await request.json())
    const operator = payload.operator ?? resolveOperator(request)
    const task = await appendTaskLog({
      taskId: id,
      operator,
      message: payload.message,
    })

    return jsonOk({ task })
  } catch (error) {
    return jsonError(error)
  }
}
