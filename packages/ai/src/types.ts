export type WorkoutType =
  | "easy"
  | "long"
  | "tempo"
  | "intervals"
  | "rest"
  | "race"
  | "strength"

export interface WorkoutDay {
  date: string         // ISO "2026-06-16"
  type: WorkoutType
  distanceKm?: number  // always km; omitted for rest days only
  description: string
}

export interface TrainingPlanMeta {
  _meta: true
  totalWeeks: number
  totalKm: number     // always km
  peakWeekKm: number  // always km
}

export interface TrainingPlan {
  totalWeeks: number
  totalKm: number
  peakWeekKm: number
  days: WorkoutDay[]
}

export interface PlanGenerationInput {
  goal: "race" | "aerobic_base"
  race?: {
    name: string
    date: string  // ISO string
    distance: "5k" | "10k" | "half" | "full" | "ultra"
    city: string
  }
  goalTime?: { hours: number; minutes: number }
  selectedDays: string[]
  longRunDay: string
  units: "km" | "miles"
  strengthTraining: boolean
  strengthDays?: string[]
}
