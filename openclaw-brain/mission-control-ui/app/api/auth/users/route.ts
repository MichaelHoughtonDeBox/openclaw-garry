import { NextResponse } from "next/server"
import { createUser } from "@/lib/auth/mongodb"
import { hashPassword } from "@/lib/auth/password"
import { getSessionCookieName, verifySessionCookie } from "@/lib/auth/session"
import { cookies } from "next/headers"
import { getMissionEnv } from "@/lib/env"
import { z } from "zod"

const bodySchema = z.object({
  username: z.string().min(2, "Username must be at least 2 characters"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

export async function POST(request: Request) {
  const env = getMissionEnv()
  if (!env.authEnabled) {
    return NextResponse.json(
      { error: "Authentication is not enabled" },
      { status: 400 },
    )
  }

  const cookieStore = await cookies()
  const cookieValue = cookieStore.get(getSessionCookieName())?.value
  if (!cookieValue) {
    return NextResponse.json(
      { error: "Authentication required to create users" },
      { status: 401 },
    )
  }

  const session = await verifySessionCookie(cookieValue)
  if (!session) {
    return NextResponse.json(
      { error: "Invalid or expired session" },
      { status: 401 },
    )
  }

  let body: z.infer<typeof bodySchema>
  try {
    const parsed = await request.json()
    body = bodySchema.parse(parsed)
  } catch (err) {
    const zodErr = err as { errors?: Array<{ message: string }> }
    const message =
      zodErr.errors?.[0]?.message ?? "Invalid request. Required: { username, password }"
    return NextResponse.json({ error: message }, { status: 400 })
  }

  try {
    const passwordHash = await hashPassword(body.password)
    const user = await createUser(body.username, passwordHash)
    return NextResponse.json(
      { user: { id: user.id, username: user.username } },
      { status: 201 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create user"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
