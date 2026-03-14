export type Goal = "race" | "aerobic_base"
export type Day = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"
export type Distance = "5k" | "10k" | "half" | "full" | "ultra"
export type Units = "km" | "miles"

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
  daysPerWeek?: 1 | 2 | 3 | 4 | 5 | 6 | 7
  selectedDays?: Day[]
  longRunDay?: Day
  units?: Units
  strengthTraining?: boolean
}

export const STEPS_RACE = [
  "goal", "findRace", "daysPerWeek", "whichDays", "longRunDay", "units", "strength",
] as const

export const STEPS_AEROBIC = [
  "goal", "daysPerWeek", "whichDays", "longRunDay", "units", "strength",
] as const

export function getSteps(goal?: Goal): readonly string[] {
  return goal === "race" ? STEPS_RACE : STEPS_AEROBIC
}
