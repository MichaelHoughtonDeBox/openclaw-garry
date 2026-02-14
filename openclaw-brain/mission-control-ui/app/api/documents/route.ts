import { createDocumentSchema, listDocumentsQuerySchema } from "@/lib/mission/schemas"
import { createDocument, listDocuments } from "@/lib/mission/repository"
import { jsonError, jsonOk } from "@/lib/http"
import {
  enforceMutationRateLimit,
  resolveOperator,
  validateMutationSecret,
} from "@/lib/security"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const query = listDocumentsQuerySchema.parse({
      assignee: url.searchParams.get("assignee")?.trim() || undefined,
      taskId: url.searchParams.get("taskId")?.trim() || undefined,
      source: url.searchParams.get("source")?.trim() || undefined,
      q: url.searchParams.get("q")?.trim() || undefined,
      before: url.searchParams.get("before")?.trim() || undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    })

    const data = await listDocuments(query)
    return jsonOk(data)
  } catch (error) {
    return jsonError(error)
  }
}

export async function POST(request: Request) {
  const secretError = validateMutationSecret(request)
  if (secretError) {
    return secretError
  }
  const rateLimitError = enforceMutationRateLimit(request)
  if (rateLimitError) {
    return rateLimitError
  }

  try {
    const payload = createDocumentSchema.parse(await request.json())
    const operator = payload.operator ?? resolveOperator(request, payload.agentId)
    const document = await createDocument({
      title: payload.title,
      contentMd: payload.contentMd,
      assignee: payload.assignee,
      agentId: payload.agentId,
      taskId: payload.taskId,
      linked_task_ids: payload.linked_task_ids,
      source: payload.source,
      url: payload.url,
      metadata: payload.metadata,
      operator,
    })
    return jsonOk({ document }, { status: 201 })
  } catch (error) {
    return jsonError(error)
  }
}
