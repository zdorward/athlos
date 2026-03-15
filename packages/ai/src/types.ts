export type WorkoutType =
  | "easy"
  | "long"
  | "medium-long"
  | "mp"
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
  completed?: boolean
  targetHR?: string    // free text, e.g. "Zone 2 (130–145 bpm)"
  targetPace?: string  // free text, e.g. "5:30–6:00/km"
  effort?: "hard" | "good" | "easy"
}

export interface PhaseEntry {
  name: string
  startWeek: number
  endWeek: number
}

export interface TrainingPlanMeta {
  _meta: true
  totalWeeks: number
  totalKm: number
  peakWeekKm: number
  phases?: PhaseEntry[]  // optional for backward compatibility with older prompts
}

export interface TrainingPlan {
  totalWeeks: number
  totalKm: number
  peakWeekKm: number
  days: WorkoutDay[]
  phases?: PhaseEntry[]
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
  weeklyMileageRange: "under-40" | "40-60" | "60-80" | "80-plus"
  recentRace?: {
    distance: "5k" | "10k" | "half" | "full"
    hours: number
    minutes: number
    seconds: number
    context: "active" | "short-break" | "long-break"
  }
}
