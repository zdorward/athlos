import type { PlanGenerationInput } from "./types"

const SYSTEM_PROMPT = `You are an expert running coach who creates personalized race training plans. You generate plans for athletes ranging from complete beginners to competitive runners targeting specific race time goals.

Output format: NDJSON — one JSON object per line, no markdown, no explanation, no code fences.

First line must be plan metadata:
{"_meta":true,"totalWeeks":<n>,"totalKm":<total>,"peakWeekKm":<peak>}

Then one line per calendar day covering the exact date range provided in the user message — use only the dates listed in the "Week schedule" section:
{"date":"YYYY-MM-DD","type":"<type>","distanceKm":<n>,"description":"<one sentence>"}

For rest days, omit distanceKm:
{"date":"YYYY-MM-DD","type":"rest","description":"Full rest day."}

For race day, emit distanceKm equal to the actual race distance:
{"date":"YYYY-MM-DD","type":"race","distanceKm":<race_distance_km>,"description":"Race day — <race name>. Trust your training."}

Valid types: easy, long, tempo, intervals, rest, race, strength

Rules:
- Only schedule runs on the athlete's available running days. All other days must be type "rest".
- HARD CONSTRAINT: The long run MUST fall on the athlete's specified long run day every single week, no exceptions. Never place a long run on any other day under any circumstances.
- If strength training is requested, schedule it on the specified strength days using type "strength" (no distanceKm).
- If a strength day overlaps with a running day, emit both as separate lines for the same date — one run entry and one strength entry. Never move or drop a session because of overlap.
- Follow the 10% weekly mileage increase rule. Include a recovery week (30% mileage reduction) every 4th week.
- Include a taper before race day: 2-week taper for 5K/10K, 3-week taper for half/full/ultra. The final day of the plan is race day.
- Always output distances in kilometres regardless of the athlete's display preference.
- Descriptions must be specific (e.g. "2km warm-up, 6×1km at 5K pace with 90sec jog recovery, 2km cool-down") not vague (e.g. "do intervals").
- Output valid JSON only. No trailing commas, no comments, no extra whitespace.
- Do not emit any line that is not valid JSON.`

const DAY_NAMES: Record<string, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday",
  fri: "Friday", sat: "Saturday", sun: "Sunday",
}

const DAY_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

const DISTANCE_KM_MAP: Record<string, number> = {
  "5k": 5, "10k": 10, half: 21.1, full: 42.2, ultra: 80,
}

function toISO(date: Date): string {
  return date.toISOString().split("T")[0]!
}

function firstMondayOnOrAfter(date: Date): Date {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  const day = d.getUTCDay() // 0=Sun, 1=Mon
  if (day !== 1) {
    d.setUTCDate(d.getUTCDate() + (day === 0 ? 1 : 8 - day))
  }
  return d
}

function buildWeekSchedule(startDate: Date, endDate: Date): string {
  const weeks: string[] = []
  const cur = new Date(startDate)
  let weekNum = 1
  while (cur <= endDate) {
    const weekStart = toISO(cur)
    const weekEnd = new Date(cur)
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6)
    const clampedEnd = weekEnd <= endDate ? weekEnd : endDate
    const dayLabels: string[] = []
    const day = new Date(cur)
    while (day <= clampedEnd) {
      dayLabels.push(`${toISO(day)} (${DAY_OF_WEEK[day.getUTCDay()]})`)
      day.setUTCDate(day.getUTCDate() + 1)
    }
    weeks.push(`Week ${weekNum} [${weekStart} – ${toISO(clampedEnd)}]: ${dayLabels.join(", ")}`)
    cur.setUTCDate(cur.getUTCDate() + 7)
    weekNum++
  }
  return weeks.join("\n")
}

export function buildPrompt(input: PlanGenerationInput): { system: string; user: string } {
  const lines: string[] = []

  const today = new Date()
  const startDate = firstMondayOnOrAfter(today)

  const { name, date, distance, city } = input.race
  const raceKm = DISTANCE_KM_MAP[distance] ?? 42.2
  lines.push(`Goal: Race — ${name} in ${city} on ${date} (${raceKm}km / ${distance})`)

  if (input.goalTime) {
    const { hours, minutes } = input.goalTime
    lines.push(`Time goal: ${hours}h${minutes.toString().padStart(2, "0")}m (finish in under this time)`)
  } else {
    lines.push("Time goal: finish (no specific time target)")
  }

  const endDate = new Date(date)
  endDate.setUTCHours(0, 0, 0, 0)

  const runDayNames = input.selectedDays.map(d => DAY_NAMES[d] ?? d).join(", ")
  lines.push(`Available running days: ${runDayNames}`)
  const longRunDayName = DAY_NAMES[input.longRunDay] ?? input.longRunDay
  lines.push(`Long run day: ${longRunDayName} — every week's long run MUST be on ${longRunDayName}, no exceptions.`)

  if (input.strengthTraining && input.strengthDays?.length) {
    const strengthDayNames = input.strengthDays.map(d => DAY_NAMES[d] ?? d).join(", ")
    lines.push(`Strength training days: ${strengthDayNames}`)
  } else {
    lines.push("Strength training: none")
  }

  lines.push("Output distances in kilometres.")
  lines.push(`\nWeek schedule (use ONLY these exact dates — do not invent or shift any dates):\n${buildWeekSchedule(startDate, endDate)}`)

  return { system: SYSTEM_PROMPT, user: lines.join("\n") }
}
