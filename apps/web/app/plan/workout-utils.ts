import type { WorkoutType, WorkoutDay, PhaseEntry, PlanGenerationInput } from "@workspace/plan-engine"

export const WORKOUT_NAMES: Record<WorkoutType, string> = {
  easy:          "Easy Run",
  long:          "Long Run",
  progression:   "MP Finish",
  mp:            "Race Pace",
  tempo:         "Tempo Run",
  intervals:     "Intervals",
  strength:      "Strength Training",
  rest:          "Rest Day",
  race:          "Race Day",
  shakeout:      "Shakeout",
}

// Tailwind class for text color. Use getWorkoutColor() for oklch values.
// Types with an empty string here rely on getWorkoutColor() for their inline oklch style instead.
export const WORKOUT_TEXT_CLASS: Record<WorkoutType, string> = {
  easy:          "",
  long:          "",
  progression:   "",
  mp:            "",
  tempo:         "",
  intervals:     "",
  strength:      "",
  rest:          "text-subtle-foreground",
  race:          "text-primary",
  shakeout:      "",
}

// Inline color style for types that can't be expressed as Tailwind classes.
export function getWorkoutColor(type: WorkoutType): string {
  const map: Partial<Record<WorkoutType, string>> = {
    // Zone 1 — Aerobic (green)
    // easy is intentionally neutral (muted) — too common to warrant a color
    long:        "oklch(0.72 0.17 150)",
    progression: "oklch(0.72 0.17 150)",
    // shakeout intentionally omitted — neutral like easy run
    // Zone 3 — Threshold (amber)
    mp:          "oklch(0.76 0.17 75)",
    tempo:       "oklch(0.76 0.17 75)",
    // Zone 4–5 — VO2max / Hard (red)
    intervals:   "oklch(0.68 0.20 25)",
    // Accessory (purple)
    strength:    "oklch(0.70 0.14 285)",
    // rest and race intentionally omitted — rest is muted/uncolored, race uses the primary accent via WORKOUT_TEXT_CLASS
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

function secsToMMSS(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = Math.round(secs % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

function parsePaceComponent(mmss: string): number {
  const [m, s] = mmss.split(":").map(Number)
  return (m ?? 0) * 60 + (s ?? 0)
}

/** Convert a stored pace string (always in /km) to the user's display units. */
export function convertPaceString(pace: string, units: "km" | "miles"): string {
  if (units === "km") return pace
  // Matches "M:SS/km" or "M:SS–M:SS/km"
  const match = pace.match(/^(\d+:\d{2})(?:–(\d+:\d{2}))?\/km$/)
  if (!match) return pace
  const fast = secsToMMSS(parsePaceComponent(match[1]!) * 1.60934)
  const slow = match[2] ? secsToMMSS(parsePaceComponent(match[2]) * 1.60934) : null
  return slow ? `${fast}–${slow}/mi` : `${fast}/mi`
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

export const RUN_TYPES = new Set<WorkoutType>([
  "easy", "long", "progression", "mp", "tempo", "intervals", "race", "shakeout",
])

export function groupDaysByDate(days: WorkoutDay[]): Map<string, WorkoutDay[]> {
  const map = new Map<string, WorkoutDay[]>()
  for (const day of days) {
    const existing = map.get(day.date) ?? []
    existing.push(day)
    map.set(day.date, existing)
  }
  return map
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

export function getWorkoutNote(day: WorkoutDay, units: "km" | "miles"): string {
  switch (day.type) {
    case "easy":
      return "Keep it genuinely easy — conversational pace throughout."
    case "long":
      return "Easy effort throughout. Protect your quality sessions."
    case "progression": {
      if (day.distanceKm == null) return "Last 25–30% at marathon pace."
      const mpKm = day.distanceKm * 0.25
      return `Last ${formatDistance(mpKm, units)} ${distanceUnit(units)} at marathon pace.`
    }
    case "mp":
      return "Marathon pace throughout — race-specific effort."
    case "tempo":
      return "Comfortably hard — lactate threshold pace."
    case "intervals": {
      if (day.distanceKm == null) {
        return "800m–1km repeats at VO2max pace with 2–3 min jog recovery."
      }
      const reps = Math.min(8, Math.max(3, Math.round(day.distanceKm - 2)))
      const paceStr = day.targetPace != null
        ? ` at ${convertPaceString(day.targetPace, units)}`
        : " at VO2max pace"
      return `${reps}×1km${paceStr} with 2–3 min jog recovery. Stop the session if your pace slips — quality over quantity.`
    }
    case "strength":
      return "Heavy resistance training after your run — compound lifts at ≥80% 1RM. Focus: squats, deadlifts, single-leg work. Plyometrics optional as a complement."
    case "rest":
      return "Full recovery day."
    case "race":
      return "Race day. Start conservative — first half at goal pace, finish strong if you have it."
    case "shakeout":
      return "Short shakeout to activate your legs. Keep it easy — you're not training today."
  }
}

export function getHRZone(type: WorkoutType): string {
  switch (type) {
    case "easy":        return "Zone 1"
    case "long":        return "Zone 1"
    case "progression": return "Zone 1 / Zone 3 finish"
    case "mp":          return "Zone 3"
    case "tempo":       return "Zone 3–4"
    case "intervals":   return "Zone 4–5"
    case "strength":
    case "rest":        return "—"
    case "race":        return "Zone 3"
    case "shakeout":    return "Zone 1"
  }
}

export function formatGoalTime(input: Pick<PlanGenerationInput, "goalTime">): string | undefined {
  if (!input.goalTime) return undefined
  const { hours, minutes, seconds } = input.goalTime
  const base = `${hours}:${minutes.toString().padStart(2, "0")}`
  const s = seconds ?? 0
  return s > 0 ? `${base}:${s.toString().padStart(2, "0")}` : base
}
