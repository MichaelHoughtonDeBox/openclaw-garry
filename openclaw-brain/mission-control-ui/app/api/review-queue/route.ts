import { listReviewQueue } from "@/lib/mission/repository"
import { jsonError, jsonOk } from "@/lib/http"

export const runtime = "nodejs"

export async function GET() {
  try {
    const tasks = await listReviewQueue()
    return jsonOk({ tasks })
  } catch (error) {
    return jsonError(error)
  }
}
