import type { PhaseEntry, WeeklyMileageRange } from "./types"

export interface PaceInput {
  hours: number
  minutes: number
  seconds: number
  distance: "5k" | "10k" | "half" | "full"
  context?: "active" | "short-break" | "long-break"
}

export interface PaceZones {
  easy: string       // e.g. "6:06–6:36/km"
  longRun: string
  mediumLong: string
  mp: string
  threshold: string
  vo2max: string
  source: "recent-race" | "goal-time"
}

const DISTANCE_KM: Record<"5k" | "10k" | "half" | "full", number> = {
  "5k": 5,
  "10k": 10,
  half: 21.0975,
  full: 42.195,
}

const CONTEXT_MULTIPLIER: Record<string, number> = {
  active: 1.0,
  "short-break": 1.05,
  "long-break": 1.12,
}

// Zone [lowerMultiplier, upperMultiplier] of 5K pace.
// Lower multiplier = faster pace (fewer seconds/km) = listed first in the range.
const ZONES = {
  vo2max:     [0.98, 1.02],
  threshold:  [1.06, 1.10],
  mp:         [1.13, 1.20],
  mediumLong: [1.20, 1.25],
  longRun:    [1.25, 1.33],
  easy:       [1.34, 1.45],
} as const

/** Format total seconds as "M:SS" */
function formatPace(secPerKm: number): string {
  const total = Math.round(secPerKm)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

/** Format a zone as "fastPace–slowPace/km" */
function formatZone(lo: number, hi: number, refSecPerKm: number): string {
  return `${formatPace(refSecPerKm * lo)}–${formatPace(refSecPerKm * hi)}/km`
}

/**
 * Calculate pace zones from a race result or goal time.
 *
 * Returns null if input is invalid (zero time or impossibly fast pace).
 * Caller should fall back to goal time with 5% buffer when null is returned.
 */
export function calculatePaceZones(
  input: PaceInput,
  source: "recent-race" | "goal-time"
): PaceZones | null {
  const distKm = DISTANCE_KM[input.distance]
  if (!distKm) return null

  const totalSec = input.hours * 3600 + input.minutes * 60 + input.seconds
  if (totalSec <= 0) return null

  // Apply 5% conservative buffer for goal times (aspirational → realistic)
  const adjustedSec = source === "goal-time" ? totalSec * 1.05 : totalSec

  // Riegel formula: T_5k = T_input × (5 / D_km)^1.06
  const t5kSec = adjustedSec * Math.pow(5 / distKm, 1.06)
  let ref = t5kSec / 5  // seconds per km at 5K equivalent pace

  // Guard: reject impossibly fast paces (< 2:00/km = 120 s/km)
  if (ref < 120) return null

  // Apply fitness context multiplier (recent-race only; goal-time already has the buffer)
  if (source === "recent-race") {
    const ctx = input.context ?? "active"
    ref *= CONTEXT_MULTIPLIER[ctx] ?? 1.0
  }

  return {
    vo2max:     formatZone(...ZONES.vo2max, ref),
    threshold:  formatZone(...ZONES.threshold, ref),
    mp:         formatZone(...ZONES.mp, ref),
    mediumLong: formatZone(...ZONES.mediumLong, ref),
    longRun:    formatZone(...ZONES.longRun, ref),
    easy:       formatZone(...ZONES.easy, ref),
    source,
  }
}

// ─── Phase schedule ─────────────────────────────────────────────────────────

function getTaperMin(distance: string): number {
  // "ultra" intentionally falls through to the same minimum as half/full (3 weeks)
  return distance === "5k" || distance === "10k" ? 2 : 3
}

function getPeakMin(distance: string): number {
  if (distance === "5k" || distance === "10k") return 2
  if (distance === "half") return 3
  return 4  // full, ultra, unknown
}

const GF_CAP: Record<string, number> = {
  "under-40": 12,
  "40-60":    10,
  "60-80":     8,
  "80-plus":   6,
}

/**
 * Compute the phase schedule for a training plan.
 *
 * ≤ 20 weeks → 4 phases (Base, Build, Peak, Taper)
 * 21+ weeks  → 5 phases (General Fitness, Base, Build, Peak, Taper)
 *
 * Taper minimum is always respected. Phases with 0 weeks are omitted.
 */
export function computePhases(
  totalWeeks: number,
  distance: string,
  weeklyMileageRange: WeeklyMileageRange = "40-60",
): PhaseEntry[] {
  const taperMin = getTaperMin(distance)
  const taper = taperMin
  const peakMin = getPeakMin(distance)
  let remaining = totalWeeks - taper - peakMin

  const result: PhaseEntry[] = []
  let w = 1

  function pushPhase(name: string, weeks: number) {
    if (weeks <= 0) return
    result.push({ name, startWeek: w, endWeek: w + weeks - 1 })
    w += weeks
    remaining -= weeks
  }

  if (totalWeeks <= 20) {
    // 4-phase
    const base  = Math.min(remaining, Math.max(1, Math.round(totalWeeks * 0.40)))
    remaining -= base
    const build = Math.min(remaining, Math.max(0, Math.round(totalWeeks * 0.30)))
    remaining -= build
    const peak  = peakMin + Math.max(0, remaining)

    pushPhase("Base",  base)
    pushPhase("Build", build)
    pushPhase("Peak",  peak)
  } else {
    // 5-phase: Base and Build are sized first, GF fills the remainder up to the
    // mileage-bracket cap, Peak gets any overflow above the cap.
    const base  = Math.min(remaining, Math.max(1, Math.round(totalWeeks * 0.30)))
    remaining -= base
    const build = Math.min(remaining, Math.max(1, Math.round(totalWeeks * 0.30)))
    remaining -= build
    const gf    = Math.min(remaining, GF_CAP[weeklyMileageRange] ?? 10)
    remaining -= gf
    const peak  = peakMin + Math.max(0, remaining)

    pushPhase("General Fitness", gf)
    pushPhase("Base",  base)
    pushPhase("Build", build)
    pushPhase("Peak",  peak)
  }

  // Always push taper last (resets `remaining` tracking; use totalWeeks as anchor)
  result.push({ name: "Taper", startWeek: w, endWeek: totalWeeks })
  return result
}

// ─── Goal-implied peak mileage ───────────────────────────────────────────────

/**
 * Return a soft target peak mileage range (km/week) for the given race distance
 * and goal time. The LLM uses this as a guideline, not a hard cap.
 *
 * Returns null for ultra (too variable) and invalid input (goalTotalMinutes <= 0).
 * Bucket boundaries are lower-bound inclusive, upper-bound exclusive.
 */
export function computeGoalPeakMileage(
  distance: "5k" | "10k" | "half" | "full" | "ultra",
  goalTotalMinutes: number,
): { low: number; high: number } | null {
  if (goalTotalMinutes <= 0) return null

  switch (distance) {
    case "full":
      if (goalTotalMinutes < 165) return { low: 110, high: 130 }
      if (goalTotalMinutes < 180) return { low: 95,  high: 115 }
      if (goalTotalMinutes < 210) return { low: 80,  high: 100 }
      if (goalTotalMinutes < 240) return { low: 65,  high: 80  }
      if (goalTotalMinutes < 270) return { low: 55,  high: 70  }
      return { low: 45, high: 60 }

    case "half":
      if (goalTotalMinutes < 80)  return { low: 80, high: 95 }
      if (goalTotalMinutes < 95)  return { low: 65, high: 80 }
      if (goalTotalMinutes < 110) return { low: 55, high: 70 }
      if (goalTotalMinutes < 130) return { low: 45, high: 60 }
      return { low: 35, high: 50 }

    case "10k":
      if (goalTotalMinutes < 35) return { low: 60, high: 75 }
      if (goalTotalMinutes < 40) return { low: 50, high: 65 }
      if (goalTotalMinutes < 50) return { low: 40, high: 55 }
      return { low: 30, high: 45 }

    case "5k":
      if (goalTotalMinutes < 18) return { low: 55, high: 65 }
      if (goalTotalMinutes < 22) return { low: 45, high: 55 }
      if (goalTotalMinutes < 28) return { low: 35, high: 45 }
      return { low: 25, high: 35 }

    default:
      return null  // ultra and unknown distances
  }
}

/**
 * Calculate the raw goal race pace (mp zone only) from a goal time.
 * Unlike calculatePaceZones, this does NOT apply the 5% training buffer —
 * it returns the actual target race pace the athlete is training toward.
 *
 * Returns null if input is invalid (zero time or impossibly fast pace).
 */
export function calculateRawGoalPace(input: PaceInput): string | null {
  const distKm = DISTANCE_KM[input.distance]
  if (!distKm) return null

  const totalSec = input.hours * 3600 + input.minutes * 60 + input.seconds
  if (totalSec <= 0) return null

  // Riegel formula — no buffer
  const t5kSec = totalSec * Math.pow(5 / distKm, 1.06)
  const ref = t5kSec / 5

  if (ref < 120) return null

  return formatZone(...ZONES.mp, ref)
}

// ─── Training structure ──────────────────────────────────────────────────────

/**
 * Derive the optimal weekly training structure from goal time, distance,
 * training age, and availability. Used to inject Pfitzinger-based hard
 * constraints into the LLM prompt.
 *
 * The weeklyMileageRange fallback is used when goalMinutes is null (no goal
 * time provided) or when distance is "ultra".
 * Unknown distance values (not full/half/5k/10k/ultra) fall through to the mileage range fallback.
 */
export function computeTrainingStructure(
  goalMinutes: number | null,
  distance: string,
  selectedDaysCount: number,
  weeklyMileageRange: string,
): { runDaysPerWeek: number; restDaysPerWeek: number; maxQualitySessions: number } {
  let run: number
  let rest: number
  let quality: number

  const useMileageFallback =
    goalMinutes === null ||
    distance === "ultra" ||
    (distance !== "full" && distance !== "half" && distance !== "5k" && distance !== "10k")

  if (!useMileageFallback && distance === "full") {
    if (goalMinutes < 150)      { run = 7; rest = 0; quality = 3 }
    else if (goalMinutes < 165) { run = 7; rest = 0; quality = 2 }
    // buckets match spec rows — values may diverge in future tuning
    else if (goalMinutes < 190) { run = 6; rest = 1; quality = 2 }
    else if (goalMinutes < 225) { run = 6; rest = 1; quality = 2 }
    else if (goalMinutes < 270) { run = 5; rest = 2; quality = 1 }
    else                        { run = 4; rest = 3; quality = 1 }
  } else if (!useMileageFallback && distance === "half") {
    if (goalMinutes < 75)       { run = 7; rest = 0; quality = 3 }
    else if (goalMinutes < 82)  { run = 7; rest = 0; quality = 2 }
    // buckets match spec rows — values may diverge in future tuning
    else if (goalMinutes < 95)  { run = 6; rest = 1; quality = 2 }
    else if (goalMinutes < 112) { run = 6; rest = 1; quality = 2 }
    else if (goalMinutes < 135) { run = 5; rest = 2; quality = 1 }
    else                        { run = 5; rest = 2; quality = 1 }
  } else if (!useMileageFallback && (distance === "5k" || distance === "10k")) {
    const gm = goalMinutes as number
    // Use full marathon table as base
    if (gm < 150)      { run = 7; rest = 0; quality = 3 }
    else if (gm < 165) { run = 7; rest = 0; quality = 2 }
    else if (gm < 190) { run = 6; rest = 1; quality = 2 }
    else if (gm < 225) { run = 6; rest = 1; quality = 2 }
    else if (gm < 270) { run = 5; rest = 2; quality = 1 }
    else               { run = 5; rest = 2; quality = 1 }
    // 5k/10k modifier: +1 quality, cap run days at 6
    quality += 1
    if (run > 6) { run = 6; rest += 1 }
  } else {
    // Mileage fallback (ultra, no goal time, unknown distance)
    if (weeklyMileageRange === "under-40")     { run = 5; rest = 2; quality = 1 }
    else if (weeklyMileageRange === "40-60")   { run = 6; rest = 1; quality = 1 }
    else if (weeklyMileageRange === "60-80")   { run = 6; rest = 1; quality = 2 }
    else if (weeklyMileageRange === "80-plus") { run = 7; rest = 0; quality = 2 }
    else                                        { run = 5; rest = 2; quality = 1 }
  }


  // selectedDaysCount clamp — restDaysPerWeek is NOT adjusted
  run = Math.min(run, selectedDaysCount)
  // restDaysPerWeek is intentionally not adjusted: rest placement is the LLM's responsibility given the available day count

  return { runDaysPerWeek: run, restDaysPerWeek: rest, maxQualitySessions: quality }
}

// ─── Long run targets ────────────────────────────────────────────────────────

/**
 * Derive Pfitzinger-based long run targets from race distance and peak weekly
 * volume. Used to inject hard constraints into the LLM prompt.
 *
 * peakWeeklyKm is the output of computeGoalPeakMileage (already called in
 * buildPrompt). When null (no goal time), falls back to the mid-range row for
 * each distance. recoveryRunMaxKm is NOT modified by training age.
 */
export function computeLongRunTargets(
  distance: string,
  peakWeeklyKm: { low: number; high: number } | null,
): { peakLongRunKm: number; recoveryRunMaxKm: number } {
  let peakLongRunKm: number
  let recoveryRunMaxKm: number

  const high = peakWeeklyKm?.high ?? null

  if (distance === "full") {
    if (high === null)    { peakLongRunKm = 35; recoveryRunMaxKm = 13 }
    else if (high < 65)  { peakLongRunKm = 29; recoveryRunMaxKm = 11 }
    else if (high < 90)  { peakLongRunKm = 35; recoveryRunMaxKm = 13 }
    // spec has two rows here (< 116 and >= 116) but both share the same targets —
    // the Pfitz 18/70 ceiling (38 km / 16 km) applies at all volumes above 90 km/week
    else                 { peakLongRunKm = 38; recoveryRunMaxKm = 16 }
  } else if (distance === "half") {
    if (high === null)    { peakLongRunKm = 22; recoveryRunMaxKm = 11 }
    else if (high < 50)  { peakLongRunKm = 19; recoveryRunMaxKm = 9  }
    else if (high < 75)  { peakLongRunKm = 22; recoveryRunMaxKm = 11 }
    else                 { peakLongRunKm = 26; recoveryRunMaxKm = 13 }
  } else if (distance === "5k" || distance === "10k") {
    if (high === null)    { peakLongRunKm = 13; recoveryRunMaxKm = 8  }
    else if (high < 45)  { peakLongRunKm = 11; recoveryRunMaxKm = 7  }
    else if (high < 65)  { peakLongRunKm = 13; recoveryRunMaxKm = 8  }
    else                 { peakLongRunKm = 16; recoveryRunMaxKm = 10 }
  } else if (distance === "ultra") {
    peakLongRunKm = 32; recoveryRunMaxKm = 14
  } else {
    // Unknown distance: mid-range full marathon defaults
    peakLongRunKm = 29; recoveryRunMaxKm = 11
  }


  return { peakLongRunKm, recoveryRunMaxKm }
}
