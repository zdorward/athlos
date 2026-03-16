import type { PhaseEntry } from "./types"

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

/**
 * Compute the phase schedule for a training plan.
 *
 * ≤ 20 weeks → 4 phases (Base, Build, Peak, Taper)
 * 21+ weeks  → 5 phases (General Fitness, Base, Build, Peak, Taper)
 *
 * Taper minimum is always respected. Phases with 0 weeks are omitted.
 */
export function computePhases(totalWeeks: number, distance: string): PhaseEntry[] {
  const taperMin = getTaperMin(distance)
  const taper = Math.max(taperMin, Math.round(totalWeeks * 0.15))
  let remaining = totalWeeks - taper

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
    const peak  = Math.max(0, remaining)

    pushPhase("Base",  base)
    pushPhase("Build", build)
    pushPhase("Peak",  peak)
  } else {
    // 5-phase
    const gf    = Math.min(remaining, Math.max(1, Math.round(totalWeeks * 0.20)))
    remaining -= gf
    const base  = Math.min(remaining, Math.max(1, Math.round(totalWeeks * 0.30)))
    remaining -= base
    const build = Math.min(remaining, Math.max(1, Math.round(totalWeeks * 0.25)))
    remaining -= build
    const peak  = Math.max(0, remaining)

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
  distance: string,
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
