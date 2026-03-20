import { computeGoalPeakMileage, computeTrainingStructure, computeLongRunTargets } from "./training-parameters"
import { WEEK1_VOLUME_KM } from "./volume-progression"
import type { WeeklyMileageRange } from "./types"

const MILEAGE_RANGE_HIGH: Record<WeeklyMileageRange, number> = {
  "0-10":   25,
  "10-25":  35,
  "25-40":  40,
  "40-60":  60,
  "60-80":  80,
  "80-plus": 120,
}

export interface ConstraintsInput {
  distance: "half" | "full"
  weeklyMileageRange: WeeklyMileageRange
  totalWeeks: number
  goalMinutes: number | null
  selectedDaysCount: number         // needed for computeTrainingStructure — do NOT hardcode 7
  isFirstAtDistance: boolean
  includeStrength: boolean
}

export interface PlanConstraints {
  // Volume
  startingVolumeKm: number
  peakWeeklyKm: number
  rampRatePerWeek: number
  // Long run
  peakLongRunKm: number
  longRunMaxFraction: number
  // Quality
  maxQualitySessions: number
  allowIntervals: boolean
  // Strength
  includeStrength: boolean
  // Guardrails
  minimumPlanWeeks: number
  feasibilityWarning: string | null
}

export function computeConstraints(input: ConstraintsInput): PlanConstraints {
  const { distance, weeklyMileageRange, totalWeeks, goalMinutes, selectedDaysCount, isFirstAtDistance, includeStrength } = input

  const startingVolumeKm = WEEK1_VOLUME_KM[weeklyMileageRange]
  const rampRatePerWeek = isFirstAtDistance ? 0.08 : 0.10

  // Aspirational peak from goal time, or mileage bracket high as fallback
  const goalPeakMileage = goalMinutes ? computeGoalPeakMileage(distance, goalMinutes) : null
  const aspirationalPeakKm = goalPeakMileage?.high ?? MILEAGE_RANGE_HIGH[weeklyMileageRange]

  // Achievable peak: compound growth from starting volume over pre-taper weeks
  const preTaperWeeks = Math.max(1, totalWeeks - 3)
  const achievablePeakKm = startingVolumeKm * Math.pow(1 + rampRatePerWeek, preTaperWeeks)
  const peakWeeklyKm = Math.min(aspirationalPeakKm, achievablePeakKm)

  // Long run targets from achievable peak
  const longRunTargets = computeLongRunTargets(distance, { low: peakWeeklyKm * 0.85, high: peakWeeklyKm })
  const peakLongRunKm = longRunTargets.peakLongRunKm
  const longRunMaxFraction = distance === "half" ? 0.38 : 0.40   // "full" is the only other valid value

  // Quality session limits — use selectedDaysCount so the cap reflects available days
  const trainingStructure = computeTrainingStructure(goalMinutes, distance, selectedDaysCount, weeklyMileageRange)
  const maxQualitySessions = isFirstAtDistance ? 1 : trainingStructure.maxQualitySessions
  const allowIntervals = !isFirstAtDistance

  // Minimum plan length guardrail
  const minimumPlanWeeks = isFirstAtDistance
    ? (distance === "full" ? 16 : 12)
    : 8

  // Feasibility warnings
  const achievableLongRunKm = peakWeeklyKm * longRunMaxFraction
  const warnings: string[] = []

  if (totalWeeks < minimumPlanWeeks) {
    const label = distance === "full" ? "marathon" : "half marathon"
    warnings.push(
      `Not enough weeks — ${label} preparation requires at least ${minimumPlanWeeks} weeks`
    )
  }

  if (distance === "full" && achievableLongRunKm < 26) {
    warnings.push(
      `Long run will only reach ~${Math.round(achievableLongRunKm)} km — consider a later race or higher starting mileage`
    )
  } else if (distance === "half" && achievableLongRunKm < 16) {
    warnings.push(
      `Long run will only reach ~${Math.round(achievableLongRunKm)} km — consider a later race or higher starting mileage`
    )
  }

  return {
    startingVolumeKm,
    peakWeeklyKm,
    rampRatePerWeek,
    peakLongRunKm,
    longRunMaxFraction,
    maxQualitySessions,
    allowIntervals,
    includeStrength,
    minimumPlanWeeks,
    feasibilityWarning: warnings.length > 0 ? warnings.join(". ") : null,
  }
}
