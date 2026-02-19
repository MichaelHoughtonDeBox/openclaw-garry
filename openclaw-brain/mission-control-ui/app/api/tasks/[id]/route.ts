import { deleteTask } from "@/lib/mission/repository"
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

/**
 * DELETE /api/tasks/[id]
 * Permanently deletes a task, its messages, and document linkages.
 */
export async function DELETE(request: Request, context: RouteContext) {
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
    const operator = request.headers.get("x-operator-name")?.trim() ?? resolveOperator(request, "operator-ui")
    const result = await deleteTask({ taskId: id, operator })
    return jsonOk(result)
  } catch (error) {
    return jsonError(error)
  }
}
