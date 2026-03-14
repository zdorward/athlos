import type { WorkoutType, WorkoutDay } from "@workspace/ai"

export const WORKOUT_NAMES: Record<WorkoutType, string> = {
  easy: "Easy Run",
  long: "Long Run",
  tempo: "Tempo Run",
  intervals: "Intervals",
  strength: "Strength",
  rest: "Rest Day",
  race: "Race Day",
}

// Tailwind class for text color. For types that need oklch values not in the
// design system, use getWorkoutColor() below for the inline style instead.
export const WORKOUT_TEXT_CLASS: Record<WorkoutType, string> = {
  easy: "text-muted-foreground",
  long: "text-primary",
  tempo: "",
  intervals: "",
  strength: "",
  rest: "text-subtle-foreground",
  race: "text-primary",
}

// Inline color style for types that can't be expressed as Tailwind classes.
export function getWorkoutColor(type: WorkoutType): string {
  const map: Partial<Record<WorkoutType, string>> = {
    tempo: "oklch(0.78 0.15 80)",
    intervals: "oklch(0.75 0.18 30)",
    strength: "oklch(0.65 0.15 300)",
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
  const startMs = new Date(days[0]!.date).getTime()
  const weeks: WorkoutDay[][] = []
  for (const day of days) {
    const weekIdx = Math.floor(
      (new Date(day.date).getTime() - startMs) / (7 * 24 * 60 * 60 * 1000)
    )
    if (!weeks[weekIdx]) weeks[weekIdx] = []
    weeks[weekIdx]!.push(day)
  }
  return weeks
}

export function getPhaseLabel(
  weekNum: number,
  totalWeeks: number,
  taperWeeks: number
): string {
  if (weekNum <= Math.floor(totalWeeks * 0.4)) return "Base"
  if (weekNum <= Math.floor(totalWeeks * 0.7)) return "Build"
  if (weekNum <= totalWeeks - taperWeeks) return "Peak"
  return "Taper"
}

export function getTaperWeeks(distance?: "5k" | "10k" | "half" | "full" | "ultra"): number {
  if (!distance) return 0
  if (distance === "5k" || distance === "10k") return 2
  return 3
}
