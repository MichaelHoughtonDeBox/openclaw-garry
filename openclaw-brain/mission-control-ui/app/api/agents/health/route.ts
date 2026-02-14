import { getAgentHealth } from "@/lib/mission/repository"
import { jsonError, jsonOk } from "@/lib/http"

export const runtime = "nodejs"

export async function GET() {
  try {
    const health = await getAgentHealth()
    return jsonOk({ health })
  } catch (error) {
    return jsonError(error)
  }
}
