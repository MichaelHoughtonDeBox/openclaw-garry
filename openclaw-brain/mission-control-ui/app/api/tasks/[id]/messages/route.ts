import { createTaskMessageSchema, listTaskMessagesQuerySchema } from "@/lib/mission/schemas"
import { createTaskMessage, listTaskMessages } from "@/lib/mission/repository"
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

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const url = new URL(request.url)
    const query = listTaskMessagesQuerySchema.parse({
      before: url.searchParams.get("before")?.trim() || undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    })
    const data = await listTaskMessages({
      taskId: id,
      before: query.before,
      limit: query.limit,
    })
    return jsonOk(data)
  } catch (error) {
    return jsonError(error)
  }
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
    const payload = createTaskMessageSchema.parse(await request.json())
    const operator = payload.operator ?? resolveOperator(request)
    const result = await createTaskMessage({
      taskId: id,
      content: payload.content,
      operator,
      linked_document_ids: payload.linked_document_ids,
    })
    return jsonOk(result, { status: 201 })
  } catch (error) {
    return jsonError(error)
  }
}
