import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getSessionCookieName, verifySessionCookie } from "@/lib/auth/session"
import { getMissionEnv } from "@/lib/env"

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback
  }
  return value === "1" || value.toLowerCase() === "true"
}

/**
 * Auth proxy: when MISSION_CONTROL_AUTH_ENABLED=true, protects all routes
 * except /login and /api/auth/login. Uses signed session cookie for verification.
 * Telemetry ingest bypasses auth when x-ingest-token matches.
 */
export async function proxy(request: NextRequest) {
  const authEnabled = parseBoolean(process.env.MISSION_CONTROL_AUTH_ENABLED, false)
  if (!authEnabled) {
    return NextResponse.next()
  }

  const { pathname } = request.nextUrl

  // Allow login page and login API without auth
  if (pathname === "/login" || pathname === "/api/auth/login") {
    return NextResponse.next()
  }

  // Allow telemetry ingest when token matches
  const env = getMissionEnv()
  if (pathname === "/api/telemetry/ingest") {
    const ingestToken = env.ingestToken
    const providedToken = request.headers.get("x-ingest-token")
    if (ingestToken && providedToken === ingestToken) {
      return NextResponse.next()
    }
  }

  // Verify session for all other routes
  const cookieValue = request.cookies.get(getSessionCookieName())?.value
  if (!cookieValue) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(loginUrl)
  }

  const session = await verifySessionCookie(cookieValue)
  if (!session) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("redirect", pathname)
    const response = NextResponse.redirect(loginUrl)
    response.cookies.set(getSessionCookieName(), "", { maxAge: 0, path: "/" })
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
