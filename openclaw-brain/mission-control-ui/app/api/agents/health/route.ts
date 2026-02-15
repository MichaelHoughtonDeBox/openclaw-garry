import { getAgentHealth } from "@/lib/mission/repository"
import { jsonError, jsonOk } from "@/lib/http"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const scopeRaw = url.searchParams.get("scope")?.trim()
    const scope = scopeRaw === "active_defaults" ? "active_defaults" : "all"
    const health = await getAgentHealth({ scope })
    return jsonOk({ health })
  } catch (error) {
    return jsonError(error)
  }
}
