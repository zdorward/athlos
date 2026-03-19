export type WorkoutType =
  | "easy"
  | "long"
  | "progression"
  | "mp"
  | "tempo"
  | "intervals"
  | "rest"
  | "race"
  | "strength"
  | "shakeout"

export interface WorkoutDay {
  date: string         // ISO "2026-06-16"
  type: WorkoutType
  distanceKm?: number  // always km; omitted for rest days only
  completed?: boolean
  targetHR?: string    // free text, e.g. "Zone 2 (130–145 bpm)"
  targetPace?: string  // free text, e.g. "5:30–6:00/km"
}

export interface PhaseEntry {
  name: string
  startWeek: number
  endWeek: number
}

export interface TrainingPlan {
  totalWeeks: number
  totalKm: number
  peakWeekKm: number
  days: WorkoutDay[]
  phases?: PhaseEntry[]
}

export type WeeklyMileageRange = "under-40" | "40-60" | "60-80" | "80-plus"

export interface PlanGenerationInput {
  goal: "race"
  race: {
    name: string
    date: string
    distance: "half" | "full"
    city: string
  }
  goalTime?: { hours: number; minutes: number; seconds?: number }
  selectedDays: string[]
  longRunDay: string
  units: "km" | "miles"
  startDate?: string
  weeklyMileageRange: WeeklyMileageRange
  today?: string  // ISO date sent by client to avoid server-clock/timezone mismatch
  isFirstAtDistance: boolean
  includeStrength: boolean
}
