import type { PlanGenerationInput } from "./types.js"

const SYSTEM_PROMPT = `You are an expert running coach who creates personalized training plans. You generate plans for athletes ranging from complete beginners to competitive runners targeting specific time goals.

Output format: NDJSON — one JSON object per line, no markdown, no explanation, no code fences.

First line must be plan metadata:
{"_meta":true,"totalWeeks":<n>,"totalKm":<total>,"peakWeekKm":<peak>}

Then one line per calendar day from the first Monday on or after today through race day (or 16 weeks for aerobic base plans):
{"date":"YYYY-MM-DD","type":"<type>","distanceKm":<n>,"description":"<one sentence>"}

For rest days, omit distanceKm:
{"date":"YYYY-MM-DD","type":"rest","description":"Full rest day."}

For race day, emit distanceKm equal to the actual race distance:
{"date":"YYYY-MM-DD","type":"race","distanceKm":<race_distance_km>,"description":"Race day — <race name>. Trust your training."}

Valid types: easy, long, tempo, intervals, rest, race, strength

Rules:
- Only schedule runs on the athlete's available running days. All other days must be type "rest".
- The long run must always fall on the athlete's specified long run day.
- If strength training is requested, schedule it on the specified strength days using type "strength" (no distanceKm).
- If a strength day overlaps with a running day, prioritize the run and move strength to the nearest available non-running day.
- Follow the 10% weekly mileage increase rule. Include a recovery week (30% mileage reduction) every 4th week.
- For race plans: include a 2-week taper for 5K/10K, 3-week taper for half/full/ultra. The final day of the plan is race day.
- For aerobic base plans: 16 weeks total, no taper.
- Always output distances in kilometres regardless of the athlete's display preference.
- Descriptions must be specific (e.g. "2km warm-up, 6×1km at 5K pace with 90sec jog recovery, 2km cool-down") not vague (e.g. "do intervals").
- Output valid JSON only. No trailing commas, no comments, no extra whitespace.
- Do not emit any line that is not valid JSON.`

const DAY_NAMES: Record<string, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday",
  fri: "Friday", sat: "Saturday", sun: "Sunday",
}

const DISTANCE_KM_MAP: Record<string, number> = {
  "5k": 5, "10k": 10, half: 21.1, full: 42.2, ultra: 80,
}

export function buildPrompt(input: PlanGenerationInput): { system: string; user: string } {
  const lines: string[] = []

  if (input.goal === "race" && input.race) {
    const { name, date, distance, city } = input.race
    const raceKm = DISTANCE_KM_MAP[distance] ?? 42.2
    lines.push(`Goal: Race — ${name} in ${city} on ${date} (${raceKm}km / ${distance})`)
    if (input.goalTime) {
      const { hours, minutes } = input.goalTime
      lines.push(`Time goal: ${hours}h${minutes.toString().padStart(2, "0")}m (finish in under this time)`)
    } else {
      lines.push("Time goal: finish (no specific time target)")
    }
  } else {
    lines.push("Goal: Build aerobic base (no race — 16-week plan)")
  }

  const runDayNames = input.selectedDays.map(d => DAY_NAMES[d] ?? d).join(", ")
  lines.push(`Available running days: ${runDayNames}`)
  lines.push(`Long run day: ${DAY_NAMES[input.longRunDay] ?? input.longRunDay}`)

  if (input.strengthTraining && input.strengthDays?.length) {
    const strengthDayNames = input.strengthDays.map(d => DAY_NAMES[d] ?? d).join(", ")
    lines.push(`Strength training days: ${strengthDayNames}`)
  } else {
    lines.push("Strength training: none")
  }

  lines.push(`Today's date: ${new Date().toISOString().split("T")[0]}`)
  lines.push("Output distances in kilometres.")

  return { system: SYSTEM_PROMPT, user: lines.join("\n") }
}
