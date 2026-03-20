export type Goal = "race"
export type Day = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"
export type Distance = "half" | "full"

export const DISTANCE_LABELS: Record<Distance, string> = {
  "half": "Half Marathon",
  "full": "Full Marathon",
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
  selectedDays?: Day[]
  longRunDay?: Day
  weeklyMileageRange?: "25-40" | "40-60" | "60-80" | "80-plus"
  units?: "km" | "miles"
  isFirstAtDistance?: boolean
  includeStrength?: boolean
}

export interface StepProps {
  formData: OnboardingData
  onNext: (data: Partial<OnboardingData>) => void
}

export function getSteps(): readonly string[] {
  return [
    "findRace",
    "firstAtDistance",
    "weeklyMileage",
    "goalTime",
    "whichDays",
    "includeStrength",
  ]
}
