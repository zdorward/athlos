import { eq, and, gte } from "drizzle-orm"
import { db, workoutLogs, adaptationSuggestions } from "@workspace/db"
import {
  checkAdaptationTrigger,
  buildReplacementWorkout,
  type WorkoutLogInput,
} from "@workspace/ai"
import type { WorkoutDay } from "@workspace/ai"

export async function runAdaptationCheck(
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
