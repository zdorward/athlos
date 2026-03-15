import type { PlanGenerationInput } from "./types"
import { calculatePaceZones, computePhases } from "./pace-calculator"

const SYSTEM_PROMPT = `You are an expert running coach building a personalised race training plan. Your output is a complete, week-by-week schedule in NDJSON format.

## Output Format

First line — plan metadata. Copy phases array verbatim from user message. Estimate totalKm and peakWeekKm from your planned weekly distances:
{"_meta":true,"totalWeeks":<n>,"totalKm":<your estimate of total km>,"peakWeekKm":<your estimate of peak week km>,"phases":<phases array from user message>}

Then one line per calendar day in the exact date range provided. Use ONLY the dates in the "Week schedule" section — never invent or shift dates:
{"date":"YYYY-MM-DD","type":"<type>","distanceKm":<n>,"targetPace":"<pace zone from user message>","description":"<specific one sentence>"}

Rest days:
{"date":"YYYY-MM-DD","type":"rest","description":"Full rest day."}

Race day:
{"date":"YYYY-MM-DD","type":"race","distanceKm":<race_distance_km>,"description":"Race day — <race name>. Trust your training."}

No markdown, no explanation, no code fences. Output valid JSON only. No trailing commas.

## Valid Workout Types

- easy        — fully aerobic, conversational pace; use easy zone for targetPace
- long        — weekly long run; use longRun zone; ALWAYS on the designated long run day
- medium-long — 60–75% of long run distance, moderate-easy effort; use mediumLong zone; mid-week only
- mp          — standalone race-pace run; use mp zone
- tempo       — sustained threshold effort 20–40 min; use threshold zone
- intervals   — short repetitions 600m–1600m with recovery; use vo2max zone
- strength    — no distanceKm
- rest        — full rest, no distanceKm
- race        — race day

Every workout except rest and strength MUST have a targetPace matching the zone label exactly as given in the user message.

## Intensity Distribution (80/20 Rule)

- At least 80% of weekly running distance must be at easy, medium-long, or long run pace
- Maximum 2 quality sessions per week (tempo, intervals, mp)
- If athlete has only 3 running days: max 1 quality session per week

## Weekly Structure Rules

- Never schedule two quality sessions on consecutive days
- The day after the long run must be rest or easy only
- At least one easy or rest day before any quality session
- Long run MUST fall on the designated long run day every single week — no exceptions

## Phase-Specific Guidance

Follow the phase schedule provided in the user message. Apply the rules below per phase.

**General Fitness (21+ week plans only):**
- Easy runs and long runs only — no tempo, no intervals, no mp
- Build mileage progressively from the stated starting volume
- From week 3 onward: optional strides (4–6 × 20 sec) may be noted in description of easy runs

**Base:**
- Easy runs, long runs, medium-long runs
- Strides on easy days (note in description)
- Final week of this phase only: introduce one tempo run (20–25 min)

**Build:**
- One tempo session per week (25–40 min or cruise intervals)
- VO2max intervals in the second half of this phase only
- Medium-long run mid-week on a non-quality day
- Long run builds toward peak distance

**Peak:**
- Highest mileage weeks
- Long runs may include race-pace segments in the final 10–16 km — use type "long" and describe the mp segment in the description (e.g. "22 km long run — last 12 km at race pace")
- One VO2max session per week
- One tempo or standalone mp run per week

**Taper:**
- First taper week: reduce total volume by 20% from peak week
- Final taper week(s): reduce total volume by 40% from peak week
- Keep workout intensity — shorten sessions but do not drop quality entirely
- Use only workout types the athlete has already seen in the plan
- Long run is 60–70% of peak long run distance

## Hard Constraints

- Only schedule runs on the athlete's available running days — days that are neither running days nor strength days must be type "rest"
- Long run MUST be on the designated long run day every single week, no exceptions
- Strength training NEVER replaces a run. If a day appears in both the running days list AND the strength days list, emit TWO lines for that date: the run workout first, then a strength line. The run is determined by the training plan as normal; strength is always additive.
- If a strength day is NOT a running day, emit a single "strength" type line for that date (no run, no distanceKm)
- Follow the 10% weekly mileage increase rule; include a recovery week (30% mileage reduction) every 4th week
- Always output distances in kilometres
- Descriptions must be specific (e.g. "2 km warm-up, 5 × 1000 m at vo2max zone with 90 sec jog, 2 km cool-down") not vague (e.g. "do intervals")`

const DAY_NAMES: Record<string, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday",
  fri: "Friday", sat: "Saturday", sun: "Sunday",
}

const DAY_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

const DISTANCE_KM_MAP: Record<string, number> = {
  "5k": 5, "10k": 10, half: 21.1, full: 42.2, ultra: 80,
}

const RANGE_LABEL: Record<string, string> = {
  "under-40": "under 40",
  "40-60": "40–60",
  "60-80": "60–80",
  "80-plus": "80+",
}

const STARTING_VOLUME_KM: Record<string, number> = {
  "under-40": 30,
  "40-60": 50,
  "60-80": 70,
  "80-plus": 90,
}

function toISO(date: Date): string {
  return date.toISOString().split("T")[0]!
}

function firstMondayOnOrAfter(date: Date): Date {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  const day = d.getUTCDay()
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
  const startDate = input.startDate
    ? new Date(input.startDate + "T00:00:00Z")
    : firstMondayOnOrAfter(new Date())

  const endDate = new Date(input.race.date)
  endDate.setUTCHours(0, 0, 0, 0)

  const msPerWeek = 7 * 24 * 60 * 60 * 1000
  const totalWeeks = Math.floor((endDate.getTime() - startDate.getTime()) / msPerWeek) + 1

  if (totalWeeks < 4) {
    throw new Error(`Race date too soon: only ${totalWeeks} week(s) of training available. Minimum 4 weeks required.`)
  }

  const { name, distance, city } = input.race
  const raceKm = DISTANCE_KM_MAP[distance] ?? 42.2

  // ── Pace zones ──────────────────────────────────────────────────────────
  let paceZones = null

  if (input.recentRace) {
    const { hours, minutes, seconds, distance: rd, context } = input.recentRace
    paceZones = calculatePaceZones({ hours, minutes, seconds, distance: rd, context }, "recent-race")
  }

  if (!paceZones && input.goalTime) {
    const { hours, minutes } = input.goalTime
    paceZones = calculatePaceZones(
      // ultra is out of scope per spec; use "full" as a proxy for pace zone calculation
      { hours, minutes, seconds: 0, distance: distance === "ultra" ? "full" : distance as "5k" | "10k" | "half" | "full" },
      "goal-time"
    )
  }

  // ── Phase schedule ───────────────────────────────────────────────────────
  const phases = computePhases(totalWeeks, distance)
  const phasesJson = JSON.stringify(phases)

  const phaseScheduleLines = phases
    .map(p => `  ${p.name.padEnd(18)}: weeks ${p.startWeek}–${p.endWeek}`)
    .join("\n")

  // ── Weekly mileage / starting volume ────────────────────────────────────
  const mileageRange = input.weeklyMileageRange  // required field; default applied upstream in mapToInput
  const startingVolume = STARTING_VOLUME_KM[mileageRange] ?? 50
  const rangeLabel = RANGE_LABEL[mileageRange] ?? "40–60"

  // ── Fitness source description ───────────────────────────────────────────
  let fitnessSource = "not provided"
  if (input.recentRace) {
    const { hours, minutes, seconds, distance: rd, context } = input.recentRace
    const timeStr = hours > 0
      ? `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      : `${minutes}:${seconds.toString().padStart(2, "0")}`
    const ctxNote = context === "short-break" ? " (short break applied)" :
                    context === "long-break"   ? " (long break applied)" : ""
    fitnessSource = `recent ${rd.toUpperCase()} in ${timeStr}${ctxNote}`
  } else if (input.goalTime) {
    fitnessSource = "goal time"
  }

  // ── User message ─────────────────────────────────────────────────────────
  const lines: string[] = []

  lines.push(`Goal: Race — ${name} in ${city} on ${toISO(endDate)} (${raceKm} km / ${distance})`)

  if (input.goalTime) {
    const { hours, minutes } = input.goalTime
    lines.push(`Time goal: ${hours}h${minutes.toString().padStart(2, "0")}m`)
  } else {
    lines.push("Time goal: finish (no specific time target)")
  }

  lines.push("")
  lines.push("Fitness baseline:")
  lines.push(`  Current weekly mileage: ${rangeLabel} km/week`)
  lines.push(`  Starting volume (week 1 total): ${startingVolume} km`)
  lines.push(`  Fitness source: ${fitnessSource}`)

  if (paceZones) {
    lines.push("")
    lines.push("Pace zones (use these exactly for targetPace on every non-rest, non-strength workout):")
    lines.push(`  Easy:         ${paceZones.easy}`)
    lines.push(`  Long run:     ${paceZones.longRun}`)
    lines.push(`  Medium-long:  ${paceZones.mediumLong}`)
    lines.push(`  Race pace:    ${paceZones.mp}`)
    lines.push(`  Threshold:    ${paceZones.threshold}`)
    lines.push(`  VO2max:       ${paceZones.vo2max}`)
  } else {
    lines.push("")
    lines.push("Pace zones: not available — calibrate paces to the athlete's goal time and fitness level.")
  }

  const runDayNames = input.selectedDays.map(d => DAY_NAMES[d] ?? d).join(", ")
  const longRunDayName = DAY_NAMES[input.longRunDay] ?? input.longRunDay

  lines.push("")
  lines.push(`Available running days: ${runDayNames}`)
  lines.push(`Long run day: ${longRunDayName} — every week's long run MUST be on ${longRunDayName}, no exceptions.`)

  if (input.strengthTraining && input.strengthDays?.length) {
    const strengthDayNames = input.strengthDays.map(d => DAY_NAMES[d] ?? d).join(", ")
    lines.push(`Strength training days: ${strengthDayNames}`)
  } else {
    lines.push("Strength training: none")
  }

  lines.push("")
  lines.push("Phase schedule (follow exactly):")
  lines.push(phaseScheduleLines)

  lines.push("")
  lines.push(`Meta line phases (copy verbatim into your first JSON line's "phases" field):`)
  lines.push(phasesJson)

  lines.push("")
  lines.push(`Week schedule (use ONLY these exact dates — do not invent or shift any dates):\n${buildWeekSchedule(startDate, endDate)}`)

  return { system: SYSTEM_PROMPT, user: lines.join("\n") }
}
