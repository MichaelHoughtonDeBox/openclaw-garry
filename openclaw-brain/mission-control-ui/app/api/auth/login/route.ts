import { NextResponse } from "next/server"
import { findUserByUsername } from "@/lib/auth/mongodb"
import { verifyPassword } from "@/lib/auth/password"
import { createSessionCookie } from "@/lib/auth/session"
import { getMissionEnv } from "@/lib/env"
import { z } from "zod"

const bodySchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
})

export async function POST(request: Request) {
  const env = getMissionEnv()
  if (!env.authEnabled) {
    return NextResponse.json(
      { error: "Authentication is not enabled" },
      { status: 400 },
    )
  }

  let body: z.infer<typeof bodySchema>
  try {
    const parsed = await request.json()
    body = bodySchema.parse(parsed)
  } catch {
    return NextResponse.json(
      { error: "Invalid request body. Required: { username, password }" },
      { status: 400 },
    )
  }

  const user = await findUserByUsername(body.username)
  if (!user) {
    return NextResponse.json(
      { error: "Invalid username or password" },
      { status: 401 },
    )
  }

  const valid = await verifyPassword(body.password, user.passwordHash)
  if (!valid) {
    return NextResponse.json(
      { error: "Invalid username or password" },
      { status: 401 },
    )
  }

  const cookie = await createSessionCookie({
    userId: user.id,
    username: user.username,
  })

  const response = NextResponse.json({
    user: { id: user.id, username: user.username },
  })

  const cookieParts = [
    `${cookie.name}=${cookie.value}`,
    `Path=${cookie.options.path}`,
    `Max-Age=${cookie.options.maxAge}`,
    `HttpOnly`,
    `SameSite=${cookie.options.sameSite}`,
  ]
  if (cookie.options.secure) {
    cookieParts.push("Secure")
  }
  response.headers.set("Set-Cookie", cookieParts.join("; "))

  return response
}
