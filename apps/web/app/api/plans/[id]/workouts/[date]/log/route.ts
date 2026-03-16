import { type NextRequest } from "next/server"
import { eq, and, gte } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db, plans, workoutLogs, adaptationSuggestions } from "@workspace/db"
import {
  deriveExpectedEffort,
  checkAdaptationTrigger,
  buildReplacementWorkout,
  type ActualEffort,
  type Soreness,
  type WorkoutLogInput,
} from "@workspace/ai"
import type { WorkoutDay, WorkoutType } from "@workspace/ai"

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

async function runAdaptationCheck(
  planId: string,
  userId: string,
  planDays: WorkoutDay[],
) {
  try {
  // Skip if a pending suggestion already exists
  const [existing] = await db
    .select({ id: adaptationSuggestions.id })
    .from(adaptationSuggestions)
    .where(
      and(
        eq(adaptationSuggestions.planId, planId),
        eq(adaptationSuggestions.status, "pending"),
      ),
    )
    .limit(1)

  if (existing) return null

  // Fetch logs from the last 8 days (one extra for timezone buffer)
  const eightDaysAgo = subtractDays(new Date().toISOString().slice(0, 10), 8)
  const recentLogs = await db
    .select()
    .from(workoutLogs)
    .where(
      and(
        eq(workoutLogs.planId, planId),
        gte(workoutLogs.workoutDate, eightDaysAgo),
      ),
    )

  const logInputs: WorkoutLogInput[] = recentLogs.map((l) => ({
    workoutDate: l.workoutDate,
    workoutType: l.workoutType as WorkoutDay["type"],
    expectedEffort: l.expectedEffort as "hard" | "moderate" | "easy",
    actualEffort: l.actualEffort as "hard" | "good" | "easy",
    completed: l.completed,
    soreness: l.soreness as "none" | "mild" | "significant",
  }))

  const { triggered, reason } = checkAdaptationTrigger(logInputs)
  if (!triggered || !reason) return null

  // Find next upcoming replaceable workout
  const today = new Date().toISOString().slice(0, 10)
  const unreplaceableTypes = new Set(["easy", "race", "rest"])
  const nextTarget = planDays
    .filter(
      (d) =>
        d.date >= today &&
        !d.completed &&
        !unreplaceableTypes.has(d.type),
    )
    .sort((a, b) => a.date.localeCompare(b.date))[0]

  if (!nextTarget) return null

  const proposed = buildReplacementWorkout(nextTarget)
  if (!proposed) return null

  const [suggestion] = await db
    .insert(adaptationSuggestions)
    .values({
      userId,
      planId,
      reason,
      targetDate: nextTarget.date,
      originalWorkout: nextTarget,
      proposedWorkout: proposed,
    })
    .returning()

  return suggestion ?? null
  } catch (err) {
    console.error("[adaptation-check] failed:", err)
    return null
  }
}

function subtractDays(isoDate: string, n: number): string {
  const d = new Date(isoDate + "T00:00:00")
  d.setDate(d.getDate() - n)
  return d.toLocaleDateString("en-CA")
}
