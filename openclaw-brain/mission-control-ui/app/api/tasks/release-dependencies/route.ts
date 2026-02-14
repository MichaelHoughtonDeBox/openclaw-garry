import { releaseDependenciesSchema } from "@/lib/mission/schemas"
import { releaseDependencies } from "@/lib/mission/repository"
import { jsonError, jsonOk } from "@/lib/http"
import {
  enforceMutationRateLimit,
  resolveOperator,
  validateMutationSecret,
} from "@/lib/security"

export const runtime = "nodejs"

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
    const payload = releaseDependenciesSchema.parse(await request.json())
    const operator = payload.operator ?? resolveOperator(request, "garry")
    const result = await releaseDependencies({
      operator,
      status: payload.status,
    })
    return jsonOk(result)
  } catch (error) {
    return jsonError(error)
  }
}
