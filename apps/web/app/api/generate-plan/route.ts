import { type NextRequest } from "next/server"
import { getProvider, type PlanGenerationInput } from "@workspace/ai"
import { getRatelimit } from "@/lib/rate-limit"

export async function POST(req: NextRequest) {
  // Rate limiting — skipped in development
  if (process.env.NODE_ENV === "production") {
    const ip =
      req.headers.get("x-real-ip") ??
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "anonymous"

    try {
      const { success, reset } = await getRatelimit().limit(ip)
      if (!success) {
        return new Response(JSON.stringify({ error: "Too many requests" }), {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)),
          },
        })
      }
    } catch {
      // Upstash unavailable or env vars missing — fail open
    }
  }

  let input: PlanGenerationInput
  try {
    input = (await req.json()) as PlanGenerationInput
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Ensure parsed body is a plain object
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  if (!input.goal || !input.selectedDays?.length || !input.longRunDay) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  if (input.goal !== "race") {
    return new Response(JSON.stringify({ error: "Invalid goal value" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const provider = getProvider()
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const line of provider.streamPlan(input)) {
          controller.enqueue(encoder.encode(line + "\n"))
        }
        controller.close()
      } catch (err) {
        const message = err instanceof Error ? err.message : "Stream error"
        controller.enqueue(encoder.encode(JSON.stringify({ error: message }) + "\n"))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Accel-Buffering": "no",
      "Cache-Control": "no-cache",
    },
  })
}
