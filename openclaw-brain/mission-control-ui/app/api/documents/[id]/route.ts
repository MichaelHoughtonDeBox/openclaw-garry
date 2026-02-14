import { getDocument, updateDocument } from "@/lib/mission/repository"
import { updateDocumentSchema } from "@/lib/mission/schemas"
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

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const document = await getDocument(id)
    return jsonOk({ document })
  } catch (error) {
    return jsonError(error)
  }
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
    const payload = updateDocumentSchema.parse(await request.json())
    const operator = payload.operator ?? resolveOperator(request)
    const document = await updateDocument({
      documentId: id,
      title: payload.title,
      contentMd: payload.contentMd,
      source: payload.source,
      url: payload.url,
      metadata: payload.metadata,
      linked_task_ids: payload.linked_task_ids,
      operator,
    })
    return jsonOk({ document })
  } catch (error) {
    return jsonError(error)
  }
}
