import { NextResponse } from "next/server"
import { getSessionCookieName, verifySessionCookie } from "@/lib/auth/session"
import { cookies } from "next/headers"
import { getMissionEnv } from "@/lib/env"

export async function GET() {
  const env = getMissionEnv()
  if (!env.authEnabled) {
    return NextResponse.json({ user: null })
  }

  const cookieStore = await cookies()
  const cookieValue = cookieStore.get(getSessionCookieName())?.value
  if (!cookieValue) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const session = await verifySessionCookie(cookieValue)
  if (!session) {
    return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 })
  }

  return NextResponse.json({
    user: { id: session.userId, username: session.username },
  })
}
