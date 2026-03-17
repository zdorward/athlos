// Day is defined locally to avoid importing from apps/web (which would invert
// the package dependency). This mirrors the pattern in race-prompt.ts.
type Day = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat"

// DAY_INDEX mirrors the convention in race-prompt.ts: Sun=0, Mon=1 … Sat=6
const DAY_INDEX: Record<Day, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
}

const ALL_DAYS: Day[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]

/**
 * Recommend how many strength sessions per week to schedule during Base and Build.
 *
 * When peakMileageHigh is available (derived from computeGoalPeakMileage), it
 * takes precedence. When null (no goal time provided), falls back to the
 * current weekly mileage range.
 *
 * During Peak the plan auto-reduces to 1 day; during Taper it drops to 0.
 * This function only determines the Base/Build recommendation.
 */
export function recommendStrengthCount(
  peakMileageHigh: number | null,
  weeklyMileageRange: "under-40" | "40-60" | "60-80" | "80-plus",
): 1 | 2 {
  if (peakMileageHigh !== null) {
    return peakMileageHigh >= 95 ? 1 : 2
  }
  return weeklyMileageRange === "80-plus" ? 1 : 2
}

/**
 * Recommend which days to lift, ranked by circular distance from the long run day,
 * with no two recommended days on consecutive days of the week.
 *
 * Algorithm:
 * 1. Compute circular distance for each day: min(|idx - longIdx|, 7 - |idx - longIdx|)
 * 2. Sort descending by distance; break ties by ascending DAY_INDEX (Sun=0 wins over Mon=1, etc.)
 * 3. Walk the sorted list greedily; skip any candidate circularly adjacent (distance = 1)
 *    to an already-selected day. Return up to `count` days.
 */
export function recommendStrengthDays(longRunDay: Day, count: number): Day[] {
  if (count <= 0) return []
  const longIdx = DAY_INDEX[longRunDay]

  const sorted = [...ALL_DAYS].sort((a, b) => {
    const da = circularDist(DAY_INDEX[a], longIdx)
    const db = circularDist(DAY_INDEX[b], longIdx)
    if (db !== da) return db - da          // descending distance
    return DAY_INDEX[a] - DAY_INDEX[b]    // ascending index tiebreak
  })

  const selected: Day[] = []
  for (const candidate of sorted) {
    if (selected.every(s => !areAdjacent(s, candidate))) {
      selected.push(candidate)
      if (selected.length === count) break
    }
  }
  return selected
}

function circularDist(a: number, b: number): number {
  const diff = Math.abs(a - b)
  return Math.min(diff, 7 - diff)
}

function areAdjacent(a: Day, b: Day): boolean {
  return circularDist(DAY_INDEX[a], DAY_INDEX[b]) === 1
}
