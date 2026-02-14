import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback
  }
  return value === "1" || value.toLowerCase() === "true"
}

function decodeBasicAuth(value: string): { user: string; pass: string } | null {
  const [, encoded] = value.split(" ")
  if (!encoded) {
    return null
  }

  try {
    const decoded =
      typeof atob === "function" ? atob(encoded) : Buffer.from(encoded, "base64").toString("utf8")
    const [user, ...rest] = decoded.split(":")
    return {
      user: user ?? "",
      pass: rest.join(":"),
    }
  } catch {
    return null
  }
}

function unauthorizedResponse() {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Mission Control"',
    },
  })
}

export function proxy(request: NextRequest) {
  const authEnabled = parseBoolean(process.env.MISSION_CONTROL_AUTH_ENABLED, false)
  if (!authEnabled) {
    return NextResponse.next()
  }

  const { pathname } = request.nextUrl
  if (pathname === "/api/telemetry/ingest") {
    const ingestToken = process.env.MISSION_CONTROL_INGEST_TOKEN
    const providedToken = request.headers.get("x-ingest-token")
    if (ingestToken && providedToken === ingestToken) {
      return NextResponse.next()
    }
  }

  const authHeader = request.headers.get("authorization")
  if (!authHeader?.startsWith("Basic ")) {
    return unauthorizedResponse()
  }

  const credentials = decodeBasicAuth(authHeader)
  const expectedUser = process.env.MISSION_CONTROL_AUTH_USER ?? "admin"
  const expectedPass = process.env.MISSION_CONTROL_AUTH_PASSWORD ?? ""

  if (!credentials || credentials.user !== expectedUser || credentials.pass !== expectedPass) {
    return unauthorizedResponse()
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
