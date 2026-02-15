import { getMissionEnv } from "@/lib/env"
import { getRealtimeSignals } from "@/lib/mission/repository"

export const runtime = "nodejs"

function serializeEvent(event: string, payload: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`
}

export async function GET() {
  const encoder = new TextEncoder()
  const pollIntervalMs = Math.max(getMissionEnv().pollIntervalMs, 2_500)
  let timer: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: string, payload: unknown) => {
        controller.enqueue(encoder.encode(serializeEvent(event, payload)))
      }

      const tick = async () => {
        try {
          const signals = await getRealtimeSignals()
          emit("tick", signals)
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown stream error"
          emit("error", { message, serverTime: new Date().toISOString() })
        }
      }

      // Send handshake metadata immediately so the UI can show stream state without waiting for the first interval.
      emit("connected", { pollIntervalMs, serverTime: new Date().toISOString() })
      await tick()
      timer = setInterval(() => {
        void tick()
      }, pollIntervalMs)
    },
    cancel() {
      if (timer) {
        clearInterval(timer)
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
