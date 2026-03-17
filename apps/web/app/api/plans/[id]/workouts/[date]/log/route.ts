import { type NextRequest } from "next/server"
import { eq, and } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db, plans, workoutLogs } from "@workspace/db"
import {
  deriveExpectedEffort,
  type ActualEffort,
  type Soreness,
} from "@workspace/plan-engine"
import type { WorkoutDay, WorkoutType } from "@workspace/plan-engine"
import { runAdaptationCheck } from "@/lib/run-adaptation-check"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const VALID_WORKOUT_TYPES = new Set(["easy", "long", "medium-long", "mp", "tempo", "intervals", "rest", "race", "strength"])
const VALID_ACTUAL_EFFORTS: ActualEffort[] = ["hard", "good", "easy"]
const VALID_SORENESS: Soreness[] = ["none", "mild", "significant"]

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; date: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id, date } = await params

  if (!UUID_RE.test(id) || !ISO_DATE_RE.test(date)) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  let body: {
    workoutType?: WorkoutType
    actualEffort?: ActualEffort
    completed?: boolean
    soreness?: Soreness
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { workoutType, actualEffort, completed, soreness } = body

  if (
    !workoutType || !VALID_WORKOUT_TYPES.has(workoutType) ||
    !actualEffort || !VALID_ACTUAL_EFFORTS.includes(actualEffort) ||
    completed === undefined || typeof completed !== "boolean" ||
    !soreness || !VALID_SORENESS.includes(soreness)
  ) {
    return Response.json({ error: "Bad request" }, { status: 400 })
  }

  try {
    // Verify plan belongs to this user
    const [plan] = await db
      .select()
      .from(plans)
      .where(and(eq(plans.id, id), eq(plans.userId, session.user.id)))
      .limit(1)

    if (!plan) {
      return Response.json({ error: "Not found" }, { status: 404 })
    }

    // Verify the workout exists in the plan
    const planDays = plan.days as WorkoutDay[]
    const workout = planDays.find((d) => d.date === date && d.type === workoutType)
    if (!workout) {
      return Response.json({ error: "Not found" }, { status: 404 })
    }

    const expectedEffort = deriveExpectedEffort(workoutType)

    // Upsert log — most recent submission wins
    const [log] = await db
      .insert(workoutLogs)
      .values({
        userId: session.user.id,
        planId: id,
        workoutDate: date,
        workoutType,
        expectedEffort,
        actualEffort,
        completed,
        soreness,
      })
      .onConflictDoUpdate({
        target: [workoutLogs.planId, workoutLogs.workoutDate, workoutLogs.workoutType],
        set: { actualEffort, completed, soreness, expectedEffort, loggedAt: new Date() },
      })
      .returning()

    // Also update completed + effort on the plan's WorkoutDay so the dashboard
    // can display the logged effort on the completed card immediately.
    const updatedDays = planDays.map((d) =>
      d.date === date && d.type === workoutType ? { ...d, completed, effort: actualEffort } : d,
    )
    await db
      .update(plans)
      .set({ days: updatedDays })
      .where(and(eq(plans.id, id), eq(plans.userId, session.user.id)))

    // Run adaptation check if no pending suggestion exists
    const suggestion = await runAdaptationCheck(id, session.user.id, updatedDays)

    return Response.json({ log, suggestion })
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}

