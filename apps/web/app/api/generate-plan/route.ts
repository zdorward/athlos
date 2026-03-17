import { type NextRequest } from "next/server"
import {
  type PlanGenerationInput,
  calculatePaceZones,
  computePhases,
  computeGoalPeakMileage,
  computeTrainingStructure,
  computeLongRunTargets,
  computeWeeklyVolumes,
  scheduleWorkouts,
  firstMondayOnOrAfter,
} from "@workspace/plan-engine"

const MILEAGE_RANGE_HIGH: Record<string, number> = {
  "under-40": 40,
  "40-60": 60,
  "60-80": 80,
  "80-plus": 120,
}

const MILEAGE_RANGE_LOW: Record<string, number> = {
  "under-40": 30,
  "40-60": 40,
  "60-80": 60,
  "80-plus": 80,
}

function weeksBetween(start: Date, end: Date): number {
  return Math.floor((end.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000))
}

export async function POST(req: NextRequest) {
  let input: PlanGenerationInput
  try {
    input = (await req.json()) as PlanGenerationInput
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  // Precondition validation
  if (!input.goal || !input.selectedDays?.length || !input.longRunDay) {
    return Response.json({ error: "Missing required fields" }, { status: 400 })
  }
  if (input.goal !== "race") {
    return Response.json({ error: "Invalid goal value" }, { status: 400 })
  }
  if (input.selectedDays.length < 2) {
    return Response.json({ error: "At least 2 running days required" }, { status: 400 })
  }
  if (!input.selectedDays.includes(input.longRunDay)) {
    return Response.json({ error: "longRunDay must be in selectedDays" }, { status: 400 })
  }

  // Derive plan parameters
  const raceDate = new Date(input.race.date + "T00:00:00Z")
  const startDate = input.startDate
    ? new Date(input.startDate + "T00:00:00Z")
    : firstMondayOnOrAfter(new Date())
  const totalWeeks = Math.max(5, weeksBetween(startDate, raceDate) + 1)

  const goalMinutes = input.goalTime
    ? input.goalTime.hours * 60 + input.goalTime.minutes + (input.goalTime.seconds ?? 0) / 60
    : null

  const peakMileage = goalMinutes
    ? computeGoalPeakMileage(input.race.distance, goalMinutes)
    : null
  const peakWeeklyKm = peakMileage?.high ?? MILEAGE_RANGE_HIGH[input.weeklyMileageRange] ?? 60

  const lowerBound = MILEAGE_RANGE_LOW[input.weeklyMileageRange] ?? 40
  if (lowerBound > peakWeeklyKm) {
    return Response.json({ error: "Starting volume exceeds peak weekly km" }, { status: 400 })
  }

  const phases = computePhases(totalWeeks, input.race.distance, input.weeklyMileageRange)

  // Compute pace zones from goal time; fall back to estimate if no goal time
  let paceZones = input.goalTime
    ? calculatePaceZones(
        {
          hours: input.goalTime.hours,
          minutes: input.goalTime.minutes,
          seconds: input.goalTime.seconds ?? 0,
          distance: input.race.distance,
          context: "active",
        },
        "goal-time",
      )
    : null

  if (!paceZones) {
    // Estimate from peakWeeklyKm: 60 km/week ≈ 4:00 marathon (240 min)
    const estimatedMinutes = Math.round(240 * (60 / peakWeeklyKm))
    const hours = Math.floor(estimatedMinutes / 60)
    const minutes = estimatedMinutes % 60
    paceZones = calculatePaceZones(
      { hours, minutes, seconds: 0, distance: "full", context: "active" },
      "goal-time",
    )
  }

  if (!paceZones) {
    return Response.json({ error: "Could not compute pace zones" }, { status: 400 })
  }

  const trainingStructure = computeTrainingStructure(
    goalMinutes,
    input.race.distance,
    input.selectedDays.length,
    input.weeklyMileageRange,
  )

  const longRunTargets = computeLongRunTargets(input.race.distance, peakMileage)

  const days = scheduleWorkouts({
    startDate: startDate.toISOString().slice(0, 10),
    selectedDays: input.selectedDays,
    longRunDay: input.longRunDay,
    weeklyMileageRange: input.weeklyMileageRange,
    phases,
    totalWeeks,
    peakWeeklyKm,
    trainingStructure,
    longRunTargets,
    paceZones,
    raceDateISO: input.race.date,
  })

  // Replace any workout on race date with a race entry, or append if not scheduled
  const raceDateISO = input.race.date
  const raceDistanceKm = input.race.distance === "full" ? 42.2 : 21.1
  const raceEntry = {
    date: raceDateISO,
    type: "race" as const,
    distanceKm: raceDistanceKm,
    targetPace: paceZones.mp,
    targetHR: "Zone 3",
  }
  const raceDayIndex = days.findIndex(d => d.date === raceDateISO)
  if (raceDayIndex >= 0) {
    days[raceDayIndex] = raceEntry
  } else {
    days.push(raceEntry)
    days.sort((a, b) => a.date.localeCompare(b.date))
  }

  const totalKm = Math.round(days.reduce((s, d) => s + (d.distanceKm ?? 0), 0))

  // peakWeekKm = max of the weeklyVolumes array (not derived from days[] since
  // strength entries add extra rows per date, making slice-by-7 unreliable)
  const weeklyVolumes = computeWeeklyVolumes({
    totalWeeks,
    weeklyMileageRange: input.weeklyMileageRange,
    peakWeeklyKm,
    phases,
  })
  const peakWeekKm = Math.round(Math.max(...weeklyVolumes))

  return Response.json({ days, totalWeeks, totalKm, peakWeekKm, phases })
}
