import type { WorkoutDay, WorkoutType } from "./types"

export type ExpectedEffort = "hard" | "moderate" | "easy"
export type ActualEffort = "hard" | "good" | "easy"
export type Soreness = "none" | "mild" | "significant"

export interface WorkoutLogInput {
  workoutDate: string        // ISO "YYYY-MM-DD"
  workoutType: WorkoutType
  expectedEffort: ExpectedEffort
  actualEffort: ActualEffort
  completed: boolean
  soreness: Soreness
}

export interface AdaptationTriggerResult {
  triggered: boolean
  reason: string | null
}

/** Derives the expected difficulty of a workout from its type. */
export function deriveExpectedEffort(type: WorkoutType): ExpectedEffort {
  if (["tempo", "intervals", "mp", "race"].includes(type)) return "hard"
  if (["long", "medium-long"].includes(type)) return "moderate"
  return "easy"
}

/**
 * Checks whether recent workout logs indicate the athlete is overreaching.
 *
 * @param logs - All logs to consider (caller is responsible for pre-filtering to a
 *               reasonable window; this function re-filters to 7 calendar days
 *               from `referenceDate`).
 * @param referenceDate - ISO date to use as "today" (defaults to actual today).
 *                        Pass this in tests for deterministic results.
 */
export function checkAdaptationTrigger(
  logs: WorkoutLogInput[],
  referenceDate?: string,
): AdaptationTriggerResult {
  const today = referenceDate ?? new Date().toLocaleDateString("en-CA")
  const sevenDaysAgo = subtractDays(today, 7)

  const recentLogs = logs.filter((l) => l.workoutDate >= sevenDaysAgo)

  // Trigger 1: 2+ unexpectedly hard sessions in 7 days
  const unexpectedlyHard = recentLogs.filter(
    (l) =>
      l.actualEffort === "hard" &&
      l.expectedEffort !== "hard" &&
      l.workoutType !== "rest" &&
      l.workoutType !== "race",
  )
  if (unexpectedlyHard.length >= 2) {
    return {
      triggered: true,
      reason: `You've had ${unexpectedlyHard.length} unexpectedly hard sessions in the last 7 days.`,
    }
  }

  // Trigger 2: significant soreness on two logs within 3 calendar days
  const sorenessDates = recentLogs
    .filter((l) => l.soreness === "significant")
    .map((l) => l.workoutDate)
    .sort()

  for (let i = 0; i < sorenessDates.length - 1; i++) {
    const diff = dateDiffDays(sorenessDates[i]!, sorenessDates[i + 1]!)
    if (diff <= 3) {
      return {
        triggered: true,
        reason: "You've reported significant soreness before multiple sessions this week.",
      }
    }
  }

  return { triggered: false, reason: null }
}

/**
 * Builds a replacement WorkoutDay for the given original.
 * Returns null for types that should never be replaced (easy, race, rest).
 */
export function buildReplacementWorkout(original: WorkoutDay): WorkoutDay | null {
  const { date, type, distanceKm } = original

  if (type === "easy" || type === "race" || type === "rest") return null

  if (type === "tempo" || type === "intervals" || type === "mp") {
    return {
      date,
      type: "easy",
      distanceKm,
      description:
        "Easy recovery run. Keep effort very low — conversational pace throughout.",
      targetHR: "Zone 2 (130–145 bpm)",
    }
  }

  if (type === "long") {
    return {
      date,
      type: "medium-long",
      distanceKm: distanceKm != null
        ? Math.round(distanceKm * 0.7 * 10) / 10
        : undefined,
      description:
        "Medium-long easy run. Reduced from your scheduled long run to aid recovery.",
      targetHR: "Zone 2 (130–145 bpm)",
    }
  }

  if (type === "medium-long") {
    return {
      date,
      type: "easy",
      distanceKm,
      description:
        "Easy recovery run. Keep effort very low — conversational pace throughout.",
      targetHR: "Zone 2 (130–145 bpm)",
    }
  }

  if (type === "strength") {
    return {
      date,
      type: "rest",
      description: "Rest day. Optional: 10–15 minutes of light mobility or stretching.",
    }
  }

  return null
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function subtractDays(isoDate: string, n: number): string {
  const d = new Date(isoDate + "T00:00:00")
  d.setDate(d.getDate() - n)
  return d.toLocaleDateString("en-CA")
}

function dateDiffDays(earlier: string, later: string): number {
  const a = new Date(earlier + "T00:00:00")
  const b = new Date(later + "T00:00:00")
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}
