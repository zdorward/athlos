export type Goal = "race"
export type Day = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"
export type Distance = "5k" | "10k" | "half" | "full" | "ultra"

export const DISTANCE_LABELS: Record<Distance, string> = {
  "5k":    "5K",
  "10k":   "10K",
  "half":  "Half Marathon",
  "full":  "Full Marathon",
  "ultra": "Ultra",
}

export const DAY_LABELS: Record<Day, { short: string; full: string }> = {
  mon: { short: "Mon", full: "Monday" },
  tue: { short: "Tue", full: "Tuesday" },
  wed: { short: "Wed", full: "Wednesday" },
  thu: { short: "Thu", full: "Thursday" },
  fri: { short: "Fri", full: "Friday" },
  sat: { short: "Sat", full: "Saturday" },
  sun: { short: "Sun", full: "Sunday" },
}

export const ORDERED_DAYS: Day[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

export interface RaceData {
  name: string
  city: string
  date: Date
  distance: Distance
}

export interface OnboardingData {
  goal?: Goal
  race?: RaceData
  timeGoal?: boolean
  goalTime?: { hours: number; minutes: number }
  trainingAge?: "under-1" | "1-3" | "3-or-more"
  selectedDays?: Day[]
  longRunDay?: Day
  strengthTraining?: boolean
  strengthDays?: Day[]
  weeklyMileageRange?: "under-40" | "40-60" | "60-80" | "80-plus"
}

export interface StepProps {
  formData: OnboardingData
  onNext: (data: Partial<OnboardingData>) => void
}

export function getSteps(): readonly string[] {
  return [
    "findRace",
    "goalTime",
    "trainingAge",
    "whichDays",
    "strengthTraining",
    "strengthDays",
    "weeklyMileage",
  ]
}
