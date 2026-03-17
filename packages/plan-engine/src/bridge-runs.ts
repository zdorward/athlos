import { STARTING_VOLUME_KM } from "./constants"
import type { PlanGenerationInput, WorkoutDay } from "./types"

function toISO(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function firstMondayOnOrAfter(date: Date): Date {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  const day = d.getUTCDay()
  if (day !== 1) {
    d.setUTCDate(d.getUTCDate() + (day === 0 ? 1 : 8 - day))
  }
  return d
}

const DAY_KEY_TO_UTC: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
}

export function buildBridgeRuns(
  input: PlanGenerationInput,
  planDays: WorkoutDay[],
  today: Date,
): WorkoutDay[] {
  // UTC-normalize today — do not mutate the original
  const todayUTC = new Date(today)
  todayUTC.setUTCHours(0, 0, 0, 0)

  // Find plan start (first Monday on or after today)
  const planStart = firstMondayOnOrAfter(todayUTC)

  // No gap if today is already at or past plan start
  if (planStart.getTime() - todayUTC.getTime() <= 0) return []

  // Build set of selected UTC day-of-week values
  const selectedUTCDays = new Set(
    input.selectedDays.map(d => DAY_KEY_TO_UTC[d]).filter((n): n is number => n !== undefined)
  )

  // Compute week-1 date range strings for ISO comparison
  // planDays always starts on planStart, so d.date >= planStartISO is always true —
  // kept for clarity; d.date <= planEndWeek1ISO does the meaningful filtering.
  const planStartISO = toISO(planStart)
  const planEndWeek1 = new Date(planStart)
  planEndWeek1.setUTCDate(planStart.getUTCDate() + 6)
  const planEndWeek1ISO = toISO(planEndWeek1)

  // Find week-1 easy runs
  const week1EasyRuns = planDays.filter(
    d =>
      d.type === "easy" &&
      d.date >= planStartISO &&
      d.date <= planEndWeek1ISO &&
      d.distanceKm !== undefined,
  )

  // Compute distance per bridge run
  // Fallback denominator = input.selectedDays.length = running days per week (not gap days)
  const distanceKm =
    week1EasyRuns.length > 0
      ? Math.round(
          (week1EasyRuns.reduce((sum, d) => sum + d.distanceKm!, 0) / week1EasyRuns.length) * 10,
        ) / 10
      : Math.round(
          ((STARTING_VOLUME_KM[input.weeklyMileageRange] ?? 50) / input.selectedDays.length) * 10,
        ) / 10

  // Target pace: copy from first week-1 easy run that has one; omit key if none
  const targetPace = week1EasyRuns.find(d => d.targetPace != null)?.targetPace

  // Iterate gap — todayUTC is fixed; cursor is a separate mutable copy
  const results: WorkoutDay[] = []
  const cursor = new Date(todayUTC)
  while (cursor.getTime() < planStart.getTime()) {
    if (selectedUTCDays.has(cursor.getUTCDay())) {
      results.push({
        date: toISO(cursor),
        type: "easy",
        distanceKm,
        ...(targetPace !== undefined && { targetPace }),
        description: "Easy run — pre-plan bridge day.",
      })
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return results
}
