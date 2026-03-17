import { type NextRequest } from "next/server"
import { eq, desc } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db, plans } from "@workspace/db"
import type { PlanGenerationInput, WorkoutDay } from "@workspace/plan-engine"

interface SavePlanBody {
  input: PlanGenerationInput
  days: WorkoutDay[]
  totalWeeks: number
  totalKm: number
  peakWeekKm: number
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: SavePlanBody
  try {
    body = (await req.json()) as SavePlanBody
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body.input || !body.days?.length || !body.totalWeeks) {
    return Response.json({ error: "Missing required fields" }, { status: 400 })
  }

  const name =
    body.input.goal === "race" && body.input.race?.name
      ? body.input.race.name
      : "Aerobic Base Plan"

  try {
    const [saved] = await db
      .insert(plans)
      .values({
        userId: session.user.id,
        goal: body.input.goal,
        name,
        input: body.input,
        days: body.days,
        totalWeeks: body.totalWeeks,
        totalKm: String(body.totalKm),
        peakWeekKm: String(body.peakWeekKm),
      })
      .returning({ id: plans.id })

    return Response.json({ id: saved?.id })
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userPlans = await db
    .select()
    .from(plans)
    .where(eq(plans.userId, session.user.id))
    .orderBy(desc(plans.createdAt))

  return Response.json({ plans: userPlans })
}
