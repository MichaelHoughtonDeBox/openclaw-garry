import { NextResponse } from "next/server"
import { ZodError } from "zod"

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init)
}

export function jsonError(error: unknown, fallbackMessage = "Request failed") {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    )
  }

  if (error instanceof Error) {
    return NextResponse.json({ error: error.message || fallbackMessage }, { status: 400 })
  }

  return NextResponse.json({ error: fallbackMessage }, { status: 500 })
}
