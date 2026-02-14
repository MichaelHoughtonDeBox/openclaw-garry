import { NextResponse } from "next/server"
import { getMissionEnv } from "@/lib/env"

type RateWindow = {
  startedAtMs: number
  count: number
}

const rateLimitWindows = new Map<string, RateWindow>()

function getClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown"
  }
  return request.headers.get("x-real-ip") ?? "local"
}

export function resolveOperator(request: Request, fallback = "operator-ui"): string {
  return request.headers.get("x-operator-name")?.trim() || fallback
}

export function validateMutationSecret(request: Request): NextResponse | null {
  const env = getMissionEnv()
  if (!env.mutationSecret) {
    return null
  }
  const providedSecret = request.headers.get("x-mission-secret") ?? ""
  if (providedSecret === env.mutationSecret) {
    return null
  }
  return NextResponse.json({ error: "Missing or invalid mutation secret" }, { status: 401 })
}

export function enforceMutationRateLimit(request: Request): NextResponse | null {
  const now = Date.now()
  const key = getClientKey(request)
  const windowMs = 60_000
  const maxRequests = 120
  const current = rateLimitWindows.get(key)

  if (!current || now - current.startedAtMs > windowMs) {
    rateLimitWindows.set(key, { startedAtMs: now, count: 1 })
    return null
  }

  if (current.count >= maxRequests) {
    return NextResponse.json(
      { error: "Mutation rate limit exceeded. Please retry in a few seconds." },
      { status: 429 },
    )
  }

  current.count += 1
  rateLimitWindows.set(key, current)
  return null
}

export function authorizeTelemetryIngest(request: Request): boolean {
  const env = getMissionEnv()
  if (!env.ingestToken) {
    return false
  }
  const providedToken = request.headers.get("x-ingest-token")
  return providedToken === env.ingestToken
}
