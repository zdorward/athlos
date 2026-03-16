import type { PlanGenerationInput } from "./types"
import { calculatePaceZones, computePhases, computeGoalPeakMileage, calculateRawGoalPace } from "./pace-calculator"

function buildSystemPrompt(units: "km" | "miles"): string {
  const unitLabel = units === "km" ? "kilometres" : "miles"
  const u = units === "km" ? "km" : "mi"
  return `You are an expert running coach building a personalised race training plan. Your output is a complete, week-by-week schedule in NDJSON format.

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

## Athlete Training Age

Apply the following constraints based on the training age in the user message.
When constraints conflict, apply the most restrictive rule (e.g. a 3-or-more year athlete
with only 3 available running days is still capped at 1 quality session/week by the
running-days rule — training age does not override it).

- under-1 year: max 8% weekly volume increase; max 1 quality session/week in all phases;
  no VO2max intervals until the Build phase; emphasise easy aerobic development
- 1-3 years: standard 10% rule; standard quality session limits per existing rules
- 3-or-more years: may increase up to 12% in strong weeks; up to 2 quality sessions from
  mid-Build phase onward (subject to running-days cap)

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
- Long runs may include race-pace segments in the final 10–16 ${u} — use type "long" and describe the mp segment in the description (e.g. "22 ${u} long run — last 12 ${u} at race pace")
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
- Always output distances in ${unitLabel}
- Descriptions must be specific (e.g. "2 ${u} warm-up, 5 × 1000 m at vo2max zone with 90 sec jog, 2 ${u} cool-down") not vague (e.g. "do intervals")`
}

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

const WEEKS_AGO_CONTEXT: Record<string, "active" | "short-break" | "long-break"> = {
  "under-8": "active",
  "8-16": "short-break",
  "16-24": "long-break",
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

  const u = input.units === "km" ? "km" : "mi"

  // ── Goal time string ─────────────────────────────────────────────────────
  const goalTimeStr = input.goalTime
    ? `${input.goalTime.hours}h${input.goalTime.minutes.toString().padStart(2, "0")}m${(input.goalTime.seconds ?? 0) > 0 ? (input.goalTime.seconds!).toString().padStart(2, "0") + "s" : ""}`
    : null

  // ── Pace zones (dual source) ─────────────────────────────────────────────
  let trainingZones = null
  let rawGoalPace: string | null = null

  if (input.recentRace) {
    const { hours, minutes, seconds, distance: rDist, weeksAgo } = input.recentRace
    const context = WEEKS_AGO_CONTEXT[weeksAgo] ?? "active"
    trainingZones = calculatePaceZones(
      { hours, minutes, seconds, distance: rDist, context },
      "recent-race"
    )
  } else if (input.goalTime) {
    const { hours, minutes } = input.goalTime
    trainingZones = calculatePaceZones(
      { hours, minutes, seconds: input.goalTime.seconds ?? 0, distance: distance === "ultra" ? "full" : distance as "5k" | "10k" | "half" | "full" },
      "goal-time"
    )
  }

  if (input.goalTime) {
    rawGoalPace = calculateRawGoalPace({
      hours: input.goalTime.hours,
      minutes: input.goalTime.minutes,
      seconds: input.goalTime.seconds ?? 0,
      distance: distance === "ultra" ? "full" : distance as "5k" | "10k" | "half" | "full",
    })
  }

  // ── Goal-implied peak mileage ────────────────────────────────────────────
  const goalMinutes = input.goalTime
    ? input.goalTime.hours * 60 + input.goalTime.minutes + (input.goalTime.seconds ?? 0) / 60
    : null
  const peakMileage = goalMinutes ? computeGoalPeakMileage(distance, goalMinutes) : null

  // ── User message ─────────────────────────────────────────────────────────
  const lines: string[] = []

  // 1. Primary objective
  if (goalTimeStr) {
    lines.push(`Primary objective: Run ${name} in ${goalTimeStr}. Every decision in this plan — volume, workout selection, pace targets, phase structure — exists to serve this single goal.`)
  } else {
    lines.push(`Goal: Race — ${name} in ${city} on ${toISO(endDate)} (${raceKm} ${u} / ${distance})`)
    lines.push("Objective: finish — build fitness and endurance to complete the race comfortably.")
  }

  // 2. Athlete profile
  lines.push("")
  lines.push("Athlete profile:")
  const trainingAgeLabel: Record<string, string> = {
    "under-1": "under 1 year of consistent running",
    "1-3": "1–3 years of consistent running",
    "3-or-more": "3 or more years of consistent running",
  }
  lines.push(`  Training age: ${trainingAgeLabel[input.trainingAge ?? "1-3"] ?? "1–3 years of consistent running"}`)
  lines.push(`  First time at this distance: ${input.firstTimeDistance ? "Yes — emphasise completion and confidence over performance targets" : "No"}`)

  // 3. Current fitness
  lines.push("")
  lines.push("Current fitness:")
  if (input.recentRace) {
    const { hours: rh, minutes: rm, seconds: rs, distance: rd, weeksAgo } = input.recentRace
    const raceTimeStr = `${rh}h${rm.toString().padStart(2, "0")}m${rs > 0 ? rs.toString().padStart(2, "0") + "s" : ""}`
    const weeksAgoLabel: Record<string, string> = {
      "under-8": "< 8 weeks ago",
      "8-16": "8–16 weeks ago",
      "16-24": "16–23 weeks ago",
    }
    lines.push(`  Recent race: ${rd.toUpperCase()} in ${raceTimeStr} (${weeksAgoLabel[weeksAgo] ?? weeksAgo}) — used to calibrate training paces`)
  }
  lines.push(`  Current weekly mileage (starting point only — does not cap peak volume): ${rangeLabel} ${u}/week`)

  // 4. Volume targets
  // Note: startingVolume and peakMileage are always in km regardless of units preference.
  // The prompt communicates volumes in km only — this is consistent with how distanceKm
  // is always stored and computed in km throughout the codebase.
  lines.push("")
  lines.push("Volume targets (all distances in km):")
  lines.push(`  Week 1 volume: ~${startingVolume} km`)
  if (peakMileage) {
    if (startingVolume >= peakMileage.low) {
      lines.push(`  Current weekly volume already meets the target peak range (~${peakMileage.low}–${peakMileage.high} km/week). Prioritise maintaining volume and increasing workout quality rather than further mileage buildup.`)
    } else {
      lines.push(`  Target peak volume (soft — scale back if timeline is short, athlete is a first-timer, or training age is under-1): ~${peakMileage.low}–${peakMileage.high} km/week`)
    }
  }

  // 5. Pace zones (dual block)
  lines.push("")
  if (trainingZones) {
    lines.push("Training pace zones (current fitness — use for targetPace on all workouts):")
    lines.push(`  Easy:         ${trainingZones.easy}`)
    lines.push(`  Long run:     ${trainingZones.longRun}`)
    lines.push(`  Medium-long:  ${trainingZones.mediumLong}`)
    lines.push(`  Threshold:    ${trainingZones.threshold}`)
    lines.push(`  VO2max:       ${trainingZones.vo2max}`)
  } else {
    lines.push("Training pace zones: not available — calibrate paces to the athlete's fitness level.")
  }
  lines.push("")
  if (rawGoalPace) {
    const mpLoSec = (zone: string): number => {
      const [m, s] = zone.split("–")[0]!.split(":").map(Number)
      return m! * 60 + s!
    }
    lines.push("Goal race pace (target — use for mp workouts and race-pace segments only):")
    lines.push(`  Race pace:    ${rawGoalPace}`)
    // Only emit the note when training zones are genuinely faster than goal pace
    if (trainingZones && mpLoSec(trainingZones.mp) < mpLoSec(rawGoalPace)) {
      lines.push("  Note: training zones reflect current fitness — they may be faster than goal race pace for athletes whose fitness already exceeds their race target.")
    }
  } else {
    lines.push("Goal race pace: not specified — use mp zone from training zones above for race-pace work.")
  }

  // 6. Schedule
  const runDayNames = input.selectedDays.map(d => DAY_NAMES[d] ?? d).join(", ")
  const longRunDayName = DAY_NAMES[input.longRunDay] ?? input.longRunDay

  lines.push("")
  lines.push(`Available running days: ${runDayNames}`)
  lines.push(`Long run day: ${longRunDayName} — every week's long run MUST be on ${longRunDayName}, no exceptions.`)

  if (input.strengthTraining && input.strengthDays?.length) {
    const strengthDayNames = input.strengthDays.map(d => DAY_NAMES[d] ?? d).join(", ")
    const runDaySet = new Set(input.selectedDays)
    const bothDays = input.strengthDays.filter(d => runDaySet.has(d)).map(d => DAY_NAMES[d] ?? d)
    const strengthOnlyDays = input.strengthDays.filter(d => !runDaySet.has(d)).map(d => DAY_NAMES[d] ?? d)
    lines.push(`Strength training days: ${strengthDayNames}`)
    if (bothDays.length > 0) {
      lines.push(`  → Days with BOTH a run AND strength: ${bothDays.join(", ")} — emit TWO JSON lines for each of these dates every week (run first, strength second)`)
    }
    if (strengthOnlyDays.length > 0) {
      lines.push(`  → Strength-only days (no run): ${strengthOnlyDays.join(", ")} — emit ONE strength JSON line for each of these dates`)
    }
  } else {
    lines.push("Strength training: none")
  }

  // 7. Phase schedule
  lines.push("")
  lines.push("Phase schedule (follow exactly):")
  lines.push(phaseScheduleLines)

  lines.push("")
  lines.push(`Meta line phases (copy verbatim into your first JSON line's "phases" field):`)
  lines.push(phasesJson)

  // 8. Week schedule
  lines.push("")
  lines.push(`Week schedule (use ONLY these exact dates — do not invent or shift any dates):\n${buildWeekSchedule(startDate, endDate)}`)

  return { system: buildSystemPrompt(input.units), user: lines.join("\n") }
}
