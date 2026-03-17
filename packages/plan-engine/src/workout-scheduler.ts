import type { WorkoutDay, PhaseEntry } from "./types"
import type { PaceZones } from "./pace-calculator"
import { computeWeeklyVolumes } from "./volume-progression"

type WeeklyMileageRange = "under-40" | "40-60" | "60-80" | "80-plus"

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
}

const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const
const DAY_INDEX: Record<string, number> = {
  mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6,
}

function round05(km: number): number {
  return Math.round(km * 2) / 2
}

const RACE_WEEK_TRAINING_RATIO = 0.20

function addDaysToISO(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T00:00:00Z")
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function isAdjacentTo(day: string, targetDay: string): boolean {
  const a = DAY_INDEX[day] ?? -1
  const b = DAY_INDEX[targetDay] ?? -1
  if (a === -1 || b === -1) return false
  return circularDist(a, b) === 1
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

function qualityDistance(type: "tempo" | "intervals" | "mp", weeklyKm: number): number {
  const pct = type === "intervals" ? 0.10 : type === "tempo" ? 0.12 : 0.15
  return round05(weeklyKm * pct)
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

function circularDist(a: number, b: number): number {
  const diff = Math.abs(a - b)
  return Math.min(diff, 7 - diff)
}

export function scheduleWorkouts(input: SchedulerInput): WorkoutDay[] {
  const {
    startDate, selectedDays, longRunDay, phases, totalWeeks,
    peakWeeklyKm, trainingStructure, longRunTargets, paceZones,
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
          distanceKm: 5,
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
    const longRunKm = round05(Math.min(rawLongKm, weeklyKm * 0.35))

    assigned.set(longRunEntry.date, [{
      date: longRunEntry.date,
      type: getLongRunType(phase, localIndex, isRecovery),
      distanceKm: longRunKm,
      targetPace: paceZones.longRun,
    }])

    // ── 2. Quality sessions ──
    const longIdx = DAY_INDEX[longRunDay] ?? 0
    const { sessions, types } = getQualityConfig(week, phase, phases, isRecovery)
    const count = Math.min(sessions, trainingStructure.maxQualitySessions)
    const placedQuality: WorkoutDay[] = []

    for (let i = 0; i < count; i++) {
      const type = types[i]!
      const candidates = weekDays.filter(({ dayKey, date }) =>
        selectedDays.includes(dayKey) &&
        dayKey !== longRunDay &&
        !assigned.has(date) &&
        !isAdjacentTo(dayKey, longRunDay) &&
        placedQuality.every(p => {
          const pDayKey = weekDays.find(w => w.date === p.date)?.dayKey ?? ""
          return !isAdjacentTo(dayKey, pDayKey)
        })
      )

      const candidate = [...candidates].sort(
        (a, b) =>
          circularDist(DAY_INDEX[b.dayKey] ?? 0, longIdx) -
          circularDist(DAY_INDEX[a.dayKey] ?? 0, longIdx)
      )[0]

      if (!candidate) continue

      const paceMap = {
        tempo: paceZones.threshold,
        intervals: paceZones.vo2max,
        mp: paceZones.mp,
      }

      const qd: WorkoutDay = {
        date: candidate.date,
        type,
        distanceKm: qualityDistance(type, weeklyKm),
        targetPace: paceMap[type],
      }
      placedQuality.push(qd)
      assigned.set(candidate.date, [qd])
    }

    // ── 3. Easy runs ──
    const placedQualityKm = placedQuality.reduce((s, d) => s + (d.distanceKm ?? 0), 0)
    const easyTotal = weeklyKm - longRunKm - placedQualityKm

    const easyRunDays = weekDays
      .filter(d => selectedDays.includes(d.dayKey) && !assigned.has(d.date))
      .sort((a, b) => (DAY_INDEX[a.dayKey] ?? 0) - (DAY_INDEX[b.dayKey] ?? 0))

    if (easyRunDays.length > 0 && easyTotal > 0) {
      const cap = longRunKm - 1
      const rawPerDay = easyTotal / easyRunDays.length
      const cappedPerDay = Math.min(rawPerDay, cap)
      const base = round05(cappedPerDay)
      const rawRemainder = Math.max(0, easyTotal - base * easyRunDays.length)

      easyRunDays.forEach((ed, i) => {
        const uncapped = base + (i === 0 ? rawRemainder : 0)
        const km = round05(Math.min(uncapped, cap))
        assigned.set(ed.date, [{
          date: ed.date,
          type: "easy",
          distanceKm: Math.max(0, km),
          targetPace: paceZones.easy,
        }])
      })
    }

    // ── 4. Strength sessions ──
    const sCount = strengthCount(week, phase, phases)

    if (sCount > 0) {
      // Collect quality day keys for adjacency exclusion
      const qualityDayKeys = placedQuality.map(q =>
        weekDays.find(w => w.date === q.date)?.dayKey ?? ""
      ).filter(Boolean)

      const sCandidates = weekDays.filter(({ dayKey, date }) => {
        const workouts = assigned.get(date)
        return (
          workouts?.some(w => w.type === "easy") &&
          (DAY_INDEX[dayKey] ?? 0) !== (longIdx - 1 + 7) % 7 && // block only the day before the long run (pre-only)
          qualityDayKeys.every(qDay => !isAdjacentTo(dayKey, qDay))
        )
      })

      const sorted = [...sCandidates].sort((a, b) => {
        const da = circularDist(DAY_INDEX[a.dayKey] ?? 0, longIdx)
        const db = circularDist(DAY_INDEX[b.dayKey] ?? 0, longIdx)
        return db - da
      })

      const selected: typeof sorted = []
      for (const candidate of sorted) {
        if (
          selected.every(s => !isAdjacentTo(s.dayKey, candidate.dayKey)) &&
          selected.length < sCount
        ) {
          selected.push(candidate)
        }
      }

      for (const { date } of selected) {
        const existing = assigned.get(date) ?? []
        assigned.set(date, [...existing, { date, type: "strength" }])
      }
    }

    // ── 5. Rest days ──
    for (const { date, dayKey } of weekDays) {
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
