import { linkDocumentToTaskSchema } from "@/lib/mission/schemas"
import { linkDocumentToTask } from "@/lib/mission/repository"
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
    const payload = linkDocumentToTaskSchema.parse(await request.json())
    const operator = payload.operator ?? resolveOperator(request)
    const result = await linkDocumentToTask({
      taskId: id,
      documentId: payload.documentId,
      operator,
    })
    return jsonOk(result)
  } catch (error) {
    return jsonError(error)
  }
}
