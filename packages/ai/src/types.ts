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
  completed?: boolean  // undefined and false are both treated as incomplete
  targetHR?: string    // free text, e.g. "Zone 2 (130–145 bpm)"
  targetPace?: string  // free text, e.g. "5:30–6:00/km"
  effort?: "hard" | "good" | "easy"
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
  goal: "race"
  race: {
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
  startDate?: string  // ISO "YYYY-MM-DD" — first day of training
}
