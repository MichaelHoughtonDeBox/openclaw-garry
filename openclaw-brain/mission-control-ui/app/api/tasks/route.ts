import { TASK_STATUSES, ASSIGNEES } from "@/lib/mission/constants"
import { createTaskSchema } from "@/lib/mission/schemas"
import { createTask, listTasks } from "@/lib/mission/repository"
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
    const statusRaw = url.searchParams.get("status")
    const assigneeRaw = url.searchParams.get("assignee")
    const q = url.searchParams.get("q")?.trim()

    const status =
      statusRaw && TASK_STATUSES.includes(statusRaw as (typeof TASK_STATUSES)[number])
        ? (statusRaw as (typeof TASK_STATUSES)[number])
        : undefined

    const assignee =
      assigneeRaw && ASSIGNEES.includes(assigneeRaw as (typeof ASSIGNEES)[number])
        ? (assigneeRaw as (typeof ASSIGNEES)[number])
        : undefined

    const data = await listTasks({ status, assignee, q })
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
    const payload = createTaskSchema.parse(await request.json())
    const operator = payload.operator ?? resolveOperator(request, "garry")
    const task = await createTask({
      task_name: payload.task_name,
      description: payload.description,
      assignee: payload.assignee,
      labels: payload.labels,
      priority: payload.priority,
      dependencies: payload.dependencies,
      linked_document_ids: payload.linked_document_ids,
      trigger_state: payload.trigger_state,
      operator,
    })

    return jsonOk({ task }, { status: 201 })
  } catch (error) {
    return jsonError(error)
  }
}
