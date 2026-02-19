import { NextResponse } from "next/server"
import { clearSessionCookie } from "@/lib/auth/session"
import { getMissionEnv } from "@/lib/env"

export async function POST() {
  const env = getMissionEnv()
  if (!env.authEnabled) {
    return NextResponse.json({ ok: true })
  }

  const cookie = clearSessionCookie()
  const cookieParts = [
    `${cookie.name}=${cookie.value}`,
    `Path=${cookie.options.path}`,
    `Max-Age=0`,
    `HttpOnly`,
    `SameSite=${cookie.options.sameSite}`,
  ]
  if (cookie.options.secure) {
    cookieParts.push("Secure")
  }

  const response = NextResponse.json({ ok: true })
  response.headers.set("Set-Cookie", cookieParts.join("; "))
  return response
}
