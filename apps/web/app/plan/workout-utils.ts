import type { WorkoutType, WorkoutDay, PhaseEntry } from "@workspace/ai"

export const WORKOUT_NAMES: Record<WorkoutType, string> = {
  easy:          "Easy Run",
  long:          "Long Run",
  "medium-long": "Medium-Long",
  mp:            "Race Pace",
  tempo:         "Tempo Run",
  intervals:     "Intervals",
  strength:      "Strength",
  rest:          "Rest Day",
  race:          "Race Day",
}

// Tailwind class for text color. Use getWorkoutColor() for oklch values.
// Types with an empty string here rely on getWorkoutColor() for their inline oklch style instead.
export const WORKOUT_TEXT_CLASS: Record<WorkoutType, string> = {
  easy:          "text-muted-foreground",
  long:          "text-primary",
  "medium-long": "text-primary/70",
  mp:            "",  // color applied via getWorkoutColor() (warm amber oklch)
  tempo:         "",
  intervals:     "",
  strength:      "",
  rest:          "text-subtle-foreground",
  race:          "text-primary",
}

// Inline color style for types that can't be expressed as Tailwind classes.
export function getWorkoutColor(type: WorkoutType): string {
  const map: Partial<Record<WorkoutType, string>> = {
    mp:            "oklch(0.78 0.15 55)",   // warm amber — between easy and tempo
    tempo:         "oklch(0.78 0.15 80)",
    intervals:     "oklch(0.75 0.18 30)",
    strength:      "oklch(0.65 0.15 300)",
  }
  return map[type] ?? ""
}

export function formatDistance(km: number, units: "km" | "miles"): string {
  if (units === "miles") {
    return (km * 0.621371).toFixed(1)
  }
  return km % 1 === 0 ? km.toString() : km.toFixed(1)
}

export function distanceUnit(units: "km" | "miles"): string {
  return units === "miles" ? "mi" : "km"
}

export function groupDaysByWeek(days: WorkoutDay[]): WorkoutDay[][] {
  if (days.length === 0) return []
  const sorted = [...days].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
  const startMs = new Date(sorted[0]!.date).getTime()
  const weeks: WorkoutDay[][] = []
  for (const day of sorted) {
    const weekIdx = Math.floor(
      (new Date(day.date).getTime() - startMs) / (7 * 24 * 60 * 60 * 1000)
    )
    if (!weeks[weekIdx]) weeks[weekIdx] = []
    weeks[weekIdx]!.push(day)
  }
  return weeks
}

/**
 * Returns the phase label for a given week.
 *
 * If `phases` is provided (from the server-computed schedule), uses it directly.
 * Falls back to the legacy percentage-based heuristic for plans without phase data.
 *
 * Note: the spec defines a 2-param signature `getPhaseLabel(weekNum, phases)`,
 * but the legacy fallback requires `totalWeeks` and `taperWeeks`. This 4-param
 * signature is used instead to preserve backward compatibility.
 */
export function getPhaseLabel(
  weekNum: number,
  totalWeeks: number,
  taperWeeks: number,
  phases?: PhaseEntry[]
): string {
  if (phases && phases.length > 0) {
    const phase = phases.find((p) => weekNum >= p.startWeek && weekNum <= p.endWeek)
    return phase?.name ?? ""
  }
  // Legacy fallback
  if (weekNum <= Math.floor(totalWeeks * 0.4)) return "Base"
  if (weekNum <= Math.floor(totalWeeks * 0.7)) return "Build"
  if (weekNum <= totalWeeks - taperWeeks) return "Peak"
  return "Taper"
}

export function getTaperWeeks(distance?: "half" | "full"): number {
  if (!distance) return 0
  return 3
}
