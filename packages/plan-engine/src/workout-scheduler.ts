import type { WorkoutDay, PhaseEntry, WeeklyMileageRange } from "./types"
import type { PaceZones } from "./pace-calculator"
import { computeWeeklyVolumes } from "./volume-progression"
import type { PlanConstraints } from "./constraints"
import {
  DAY_ORDER, DAY_INDEX, round05,
  placeQualitySessions, placeEasyRuns, placeStrengthSessions,
} from "./workout-placement"

export interface TrainingStructure {
  runDaysPerWeek: number
  restDaysPerWeek: number
  maxQualitySessions: number
}

export interface LongRunTargets {
  peakLongRunKm: number
  recoveryRunMaxKm: number
}

export interface SchedulerInput {
  startDate: string
  selectedDays: string[]
  longRunDay: string
  weeklyMileageRange: WeeklyMileageRange
  phases: PhaseEntry[]
  totalWeeks: number
  peakWeeklyKm: number
  trainingStructure: TrainingStructure
  longRunTargets: LongRunTargets
  paceZones: PaceZones
  raceDateISO?: string
  constraints: PlanConstraints
}

const RACE_WEEK_TRAINING_RATIO = 0.20

function addDaysToISO(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T00:00:00Z")
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function phaseForWeek(weekNumber: number, phases: PhaseEntry[]): string {
  return phases.find(p => weekNumber >= p.startWeek && weekNumber <= p.endWeek)?.name ?? "Base"
}

type QualityType = "tempo" | "intervals" | "mp"

interface PhaseSlot {
  sessions: number
  types: QualityType[]
}

const PHASE_CONFIG = {
  "General Fitness": {
    normal:   { sessions: 0, types: [] as QualityType[] },
    recovery: { sessions: 0, types: [] as QualityType[] },
  },
  "Base": {
    normal:   { sessions: 1, types: ["tempo"] as QualityType[] },
    recovery: { sessions: 1, types: ["tempo"] as QualityType[] },
  },
  "Build": {
    early: {
      normal:   { sessions: 2, types: ["tempo", "intervals"] as QualityType[] },
      recovery: { sessions: 1, types: ["tempo"] as QualityType[] },
    },
    late: {
      normal:   { sessions: 2, types: ["tempo", "mp"] as QualityType[] },
      recovery: { sessions: 1, types: ["tempo"] as QualityType[] },
    },
  },
  "Peak": {
    normal:   { sessions: 2, types: ["mp", "tempo"] as QualityType[] },
    recovery: { sessions: 1, types: ["tempo"] as QualityType[] },
  },
  "Taper": {
    first: {
      normal:   { sessions: 1, types: ["tempo"] as QualityType[] },
      recovery: { sessions: 0, types: [] as QualityType[] },
    },
    rest: {
      normal:   { sessions: 0, types: [] as QualityType[] },
      recovery: { sessions: 0, types: [] as QualityType[] },
    },
  },
} as const satisfies Record<string, unknown>

function getQualityConfig(
  weekNumber: number,
  phase: string,
  phases: PhaseEntry[],
  isRecovery: boolean,
): PhaseSlot {
  const phaseEntry = phases.find(p => p.name === phase)
  const localIndex = phaseEntry ? weekNumber - phaseEntry.startWeek : 0

  if (phase === "Build") {
    const buildEntry = phases.find(p => p.name === "Build")
    const buildLength = buildEntry ? buildEntry.endWeek - buildEntry.startWeek + 1 : 0
    const slot = localIndex < Math.ceil(buildLength * 0.6)
      ? PHASE_CONFIG["Build"].early
      : PHASE_CONFIG["Build"].late
    return isRecovery ? slot.recovery : slot.normal
  }

  if (phase === "Taper") {
    const slot = phaseEntry && weekNumber === phaseEntry.startWeek
      ? PHASE_CONFIG["Taper"].first
      : PHASE_CONFIG["Taper"].rest
    return isRecovery ? slot.recovery : slot.normal
  }

  const config = (PHASE_CONFIG as unknown as Record<string, { normal: PhaseSlot; recovery: PhaseSlot }>)[phase]
    ?? PHASE_CONFIG["Base"]
  return isRecovery ? config.recovery : config.normal
}

function strengthCount(weekNumber: number, phase: string, phases: PhaseEntry[]): number {
  const phaseEntry = phases.find(p => p.name === phase)
  const peakEntry = phases.find(p => p.name === "Peak")

  switch (phase) {
    case "General Fitness":
    case "Base":
    case "Build":
      return 2
    case "Peak": {
      if (!peakEntry) return 2
      const peakLength = peakEntry.endWeek - peakEntry.startWeek + 1
      const localIndex = weekNumber - peakEntry.startWeek
      return localIndex >= peakLength - 2 ? 1 : 2
    }
    case "Taper":
      return phaseEntry && weekNumber === phaseEntry.startWeek ? 1 : 0
    default:
      return 2
  }
}

function getLongRunType(phase: string, localIndex: number, isRecovery: boolean): "long" | "progression" {
  if (isRecovery) return "long"
  if (phase === "Build" && localIndex % 3 === 2) return "progression"
  if (phase === "Peak"  && localIndex % 2 === 1) return "progression"
  return "long"
}

export function scheduleWorkouts(input: SchedulerInput): WorkoutDay[] {
  const {
    startDate, selectedDays, longRunDay, phases, totalWeeks,
    peakWeeklyKm, trainingStructure, longRunTargets, paceZones, constraints,
  } = input

  const weeklyVolumes = computeWeeklyVolumes({
    totalWeeks,
    weeklyMileageRange: input.weeklyMileageRange,
    peakWeeklyKm,
    phases,
  })

  const result: WorkoutDay[] = []

  const taperPhase = phases.find(p => p.name === "Taper")
  const preTaperWeeks = taperPhase ? taperPhase.startWeek - 1 : totalWeeks

  for (let week = 1; week <= totalWeeks; week++) {
    const weeklyKm = weeklyVolumes[week - 1]!
    const phase = phaseForWeek(week, phases)
    const phaseEntry = phases.find(p => p.name === phase)
    const localIndex = phaseEntry ? week - phaseEntry.startWeek : 0
    const weekOffset = (week - 1) * 7

    // Build date→dayKey map for this week
    const weekDays: { date: string; dayKey: string }[] = DAY_ORDER.map((dayKey, i) => ({
      date: addDaysToISO(startDate, weekOffset + i),
      dayKey,
    }))

    // Assigned slots: date → WorkoutDay[]
    const assigned = new Map<string, WorkoutDay[]>()

    // ── Race week (early exit) ──
    if (input.raceDateISO && week === totalWeeks) {
      const preRaceDate = addDaysToISO(input.raceDateISO, -1)
      const excludedDates = new Set(
        weekDays
          .filter(d => d.date === input.raceDateISO || d.date === preRaceDate)
          .map(d => d.date)
      )

      // Shakeout on pre-race day — always, regardless of selectedDays
      const preRaceEntry = weekDays.find(d => d.date === preRaceDate)
      if (preRaceEntry) {
        assigned.set(preRaceDate, [{
          date: preRaceDate,
          type: "shakeout",
          distanceKm: 3,
          targetPace: paceZones.easy,
        }])
      }

      // Easy runs on selected days (excluding race and pre-race)
      const eligibleDays = weekDays.filter(
        d => selectedDays.includes(d.dayKey) && !excludedDates.has(d.date)
      )
      if (eligibleDays.length > 0 && weeklyKm > 0) {
        const raceWeekTrainingKm = Math.min(weeklyKm, peakWeeklyKm * RACE_WEEK_TRAINING_RATIO)
        const perDay = round05(raceWeekTrainingKm / eligibleDays.length)
        for (const ed of eligibleDays) {
          assigned.set(ed.date, [{
            date: ed.date, type: "easy", distanceKm: perDay, targetPace: paceZones.easy,
          }])
        }
      }
      for (const { date } of weekDays) {
        if (!assigned.has(date)) assigned.set(date, [{ date, type: "rest" }])
      }
      for (const { date } of weekDays) {
        result.push(...(assigned.get(date) ?? [{ date, type: "rest" as const }]))
      }
      continue
    }

    const isRecovery = week % 4 === 0 && week !== preTaperWeeks

    // ── 1. Long run ──
    const longRunEntry = weekDays.find(d => d.dayKey === longRunDay)!
    const progressFactor = Math.min(weeklyKm / peakWeeklyKm, 1.0)
    const rawLongKm = longRunTargets.peakLongRunKm * progressFactor
    const longRunKm = round05(Math.min(rawLongKm, weeklyKm * constraints.longRunMaxFraction))

    assigned.set(longRunEntry.date, [{
      date: longRunEntry.date,
      type: getLongRunType(phase, localIndex, isRecovery),
      distanceKm: longRunKm,
      targetPace: paceZones.longRun,
    }])

    // ── 2. Quality sessions ──
    const { sessions, types } = getQualityConfig(week, phase, phases, isRecovery)
    const placedQuality = placeQualitySessions(
      weekDays, assigned, longRunDay,
      { sessions, types },
      constraints, weeklyKm, paceZones, selectedDays,
    )

    // ── 3. Easy runs ──
    placeEasyRuns(weekDays, assigned, longRunKm, weeklyKm, paceZones, selectedDays, placedQuality)

    // ── 4. Strength ──
    const sCount = strengthCount(week, phase, phases)
    if (sCount > 0 && constraints.includeStrength) {
      placeStrengthSessions(weekDays, assigned, longRunDay, placedQuality, sCount)
    }

    // ── 5. Rest days ──
    for (const { date } of weekDays) {
      if (!assigned.has(date)) {
        assigned.set(date, [{ date, type: "rest" }])
      }
    }

    // Flatten in date order
    for (const { date } of weekDays) {
      const dayWorkouts = assigned.get(date) ?? [{ date, type: "rest" as const }]
      result.push(...dayWorkouts)
    }
  }

  return result
}
