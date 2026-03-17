import { type NextRequest } from "next/server"
import { eq, and } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db, plans } from "@workspace/db"
import type { WorkoutDay, WorkoutType } from "@workspace/plan-engine"

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

export async function DELETE(
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
    const [existing] = await db
      .select({ id: plans.id })
      .from(plans)
      .where(and(eq(plans.id, id), eq(plans.userId, session.user.id)))
      .limit(1)

    if (!existing) {
      return Response.json({ error: "Not found" }, { status: 404 })
    }

    await db
      .delete(plans)
      .where(and(eq(plans.id, id), eq(plans.userId, session.user.id)))

    return new Response(null, { status: 204 })
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

  type FieldUpdate = {
    type?: WorkoutType
    distanceKm?: number | null
    description?: string
    targetHR?: string
    targetPace?: string
  }
  const body = (await req.json()) as {
    date?: string
    type?: WorkoutType
    completed?: boolean
    effort?: "hard" | "good" | "easy"
    update?: FieldUpdate
  }

  const isFieldUpdate = body.update !== undefined
  const isCompletionOrEffort = !isFieldUpdate && (body.completed !== undefined || body.effort !== undefined)

  if (!isFieldUpdate && !isCompletionOrEffort) {
    return Response.json({ error: "Bad request" }, { status: 400 })
  }

  if ((isCompletionOrEffort || isFieldUpdate) && (body.date === undefined || body.type === undefined)) {
    return Response.json({ error: "Bad request" }, { status: 400 })
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

    const days = plan.days as WorkoutDay[]
    const entry = days.find((d) => d.date === body.date && d.type === body.type)
    if (!entry) {
      return Response.json({ error: "Not found" }, { status: 404 })
    }

    if (isFieldUpdate) {
      const update = body.update!
      if (update.type !== undefined) entry.type = update.type
      if (update.description !== undefined) entry.description = update.description
      if (update.targetHR !== undefined) entry.targetHR = update.targetHR
      if (update.targetPace !== undefined) entry.targetPace = update.targetPace
      if ("distanceKm" in update) {
        if (update.distanceKm === null) {
          delete entry.distanceKm
        } else if (update.distanceKm !== undefined) {
          entry.distanceKm = update.distanceKm
        }
      }
    } else {
      if (body.completed !== undefined) entry.completed = body.completed
      if (body.effort !== undefined) {
        if (!["hard", "good", "easy"].includes(body.effort)) {
          return Response.json({ error: "Bad request" }, { status: 400 })
        }
        entry.effort = body.effort
      }
    }

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
