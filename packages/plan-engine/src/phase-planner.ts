import type { PhaseEntry, WeeklyMileageRange } from "./types"

function getTaperMin(distance: string): number {
  // "ultra" intentionally falls through to the same minimum as half/full (3 weeks)
  return distance === "5k" || distance === "10k" ? 2 : 3
}

function getPeakMin(distance: string): number {
  if (distance === "5k" || distance === "10k") return 2
  if (distance === "half") return 3
  return 4  // full, ultra, unknown
}

const GF_CAP: Record<WeeklyMileageRange, number> = {
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
    const gf    = Math.min(remaining, GF_CAP[weeklyMileageRange])
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
