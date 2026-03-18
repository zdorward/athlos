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
