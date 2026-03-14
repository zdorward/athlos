import { type NextRequest } from "next/server"
import { eq, and } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db, plans } from "@workspace/db"
import type { WorkoutDay, WorkoutType } from "@workspace/ai"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  if (!UUID_RE.test(id)) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  try {
    const [plan] = await db
      .select()
      .from(plans)
      .where(and(eq(plans.id, id), eq(plans.userId, session.user.id)))
      .limit(1)

    if (!plan) {
      return Response.json({ error: "Not found" }, { status: 404 })
    }

    return Response.json({ plan })
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  if (!UUID_RE.test(id)) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const body = (await req.json()) as { date?: string; type?: WorkoutType; completed?: boolean }
  if (body.date === undefined || body.type === undefined || body.completed === undefined) {
    return Response.json({ error: "Bad request" }, { status: 400 })
  }
  const { date, type, completed } = body

  try {
    const [plan] = await db
      .select()
      .from(plans)
      .where(and(eq(plans.id, id), eq(plans.userId, session.user.id)))
      .limit(1)

    if (!plan) {
      return Response.json({ error: "Not found" }, { status: 404 })
    }

    const days = plan.days as WorkoutDay[]
    const entry = days.find((d) => d.date === date && d.type === type)
    if (!entry) {
      return Response.json({ error: "Not found" }, { status: 404 })
    }

    entry.completed = completed
    await db
      .update(plans)
      .set({ days })
      .where(and(eq(plans.id, id), eq(plans.userId, session.user.id)))

    const [updated] = await db
      .select()
      .from(plans)
      .where(and(eq(plans.id, id), eq(plans.userId, session.user.id)))
      .limit(1)

    return Response.json({ plan: updated })
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
