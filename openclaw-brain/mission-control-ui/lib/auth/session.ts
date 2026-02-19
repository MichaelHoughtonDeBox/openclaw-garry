import { SignJWT, jwtVerify } from "jose"
import { getMissionEnv } from "@/lib/env"

const COOKIE_NAME = "mission-control-session"
const SESSION_MAX_AGE_SEC = 7 * 24 * 60 * 60 // 7 days

export type SessionPayload = {
  userId: string
  username: string
}

/**
 * Returns the session cookie name used across the app.
 */
export function getSessionCookieName(): string {
  return COOKIE_NAME
}

function getSecretKey(): Uint8Array {
  const env = getMissionEnv()
  if (!env.sessionSecret || env.sessionSecret.length < 32) {
    throw new Error(
      "MISSION_CONTROL_SESSION_SECRET must be set and at least 32 characters when auth is enabled.",
    )
  }
  return new TextEncoder().encode(env.sessionSecret)
}

/**
 * Creates a signed JWT and returns the cookie config for setting it.
 *
 * @param payload - User id and username to encode
 * @returns Cookie name, value, and options for Set-Cookie header
 */
export async function createSessionCookie(
  payload: SessionPayload,
): Promise<{ name: string; value: string; options: Record<string, unknown> }> {
  const secret = getSecretKey()
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SEC}s`)
    .sign(secret)

  const isProduction = process.env.NODE_ENV === "production"

  return {
    name: COOKIE_NAME,
    value: token,
    options: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax" as const,
      maxAge: SESSION_MAX_AGE_SEC,
      path: "/",
    },
  }
}

/**
 * Verifies and decodes the session cookie value.
 *
 * @param cookieValue - Raw cookie string (JWT)
 * @returns Decoded payload or null if invalid/expired
 */
export async function verifySessionCookie(
  cookieValue: string,
): Promise<SessionPayload | null> {
  try {
    const secret = getSecretKey()
    const { payload } = await jwtVerify(cookieValue, secret)
    const userId = payload.userId as string
    const username = payload.username as string
    if (!userId || !username) {
      return null
    }
    return { userId, username }
  } catch {
    return null
  }
}

/**
 * Returns the Set-Cookie header value to clear the session (logout).
 */
export function clearSessionCookie(): { name: string; value: string; options: Record<string, unknown> } {
  return {
    name: COOKIE_NAME,
    value: "",
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    },
  }
}
