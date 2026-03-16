import { type NextRequest } from "next/server"
import { eq, and } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db, plans, adaptationSuggestions } from "@workspace/db"
import type { WorkoutDay } from "@workspace/ai"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; suggestionId: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id, suggestionId } = await params

  if (!UUID_RE.test(id) || !UUID_RE.test(suggestionId)) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  try {
    const [suggestion] = await db
      .select()
      .from(adaptationSuggestions)
      .where(eq(adaptationSuggestions.id, suggestionId))
      .limit(1)

    if (!suggestion) {
      return Response.json({ error: "Not found" }, { status: 404 })
    }

    if (suggestion.userId !== session.user.id || suggestion.planId !== id) {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }

    // Idempotent — already resolved
    if (suggestion.status !== "pending") {
      const [plan] = await db.select().from(plans).where(eq(plans.id, id)).limit(1)
      return Response.json({ plan })
    }

    // Mutate the plan's days: replace targetDate+originalType with proposedWorkout
    const [plan] = await db
      .select()
      .from(plans)
      .where(and(eq(plans.id, id), eq(plans.userId, session.user.id)))
      .limit(1)

    if (!plan) {
      return Response.json({ error: "Not found" }, { status: 404 })
    }

    const original = suggestion.originalWorkout as WorkoutDay
    const proposed = suggestion.proposedWorkout as WorkoutDay
    const updatedDays = (plan.days as WorkoutDay[]).map((d) =>
      d.date === suggestion.targetDate && d.type === original.type ? proposed : d,
    )

    await Promise.all([
      db.update(plans).set({ days: updatedDays }).where(and(eq(plans.id, id), eq(plans.userId, session.user.id))),
      db
        .update(adaptationSuggestions)
        .set({ status: "accepted", resolvedAt: new Date() })
        .where(eq(adaptationSuggestions.id, suggestionId)),
    ])

    const [updated] = await db.select().from(plans).where(eq(plans.id, id)).limit(1)
    return Response.json({ plan: updated })
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
