import type { WorkoutDay } from "./types"
import type { PaceZones } from "./pace-calculator"
import type { PlanConstraints } from "./constraints"

export const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const
export const DAY_INDEX: Record<string, number> = {
  mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6,
}

export function roundKm(km: number): number {
  return Math.round(km)
}

function circularDist(a: number, b: number): number {
  const diff = Math.abs(a - b)
  return Math.min(diff, 7 - diff)
}

function isAdjacentTo(day: string, targetDay: string): boolean {
  const a = DAY_INDEX[day] ?? -1
  const b = DAY_INDEX[targetDay] ?? -1
  if (a === -1 || b === -1) return false
  return circularDist(a, b) === 1
}

function qualityDistance(type: "tempo" | "intervals" | "mp", weeklyKm: number): number {
  const pct = type === "intervals" ? 0.10 : type === "tempo" ? 0.12 : 0.15
  return roundKm(weeklyKm * pct)
}

export function placeQualitySessions(
  weekDays: { date: string; dayKey: string }[],
  assigned: Map<string, WorkoutDay[]>,
  longRunDay: string,
  qualityConfig: { sessions: number; types: ("tempo" | "intervals" | "mp")[] },
  constraints: PlanConstraints,
  weeklyKm: number,
  paceZones: PaceZones,
  selectedDays: string[],
): WorkoutDay[] {
  const longIdx = DAY_INDEX[longRunDay] ?? 0
  const { sessions, types } = qualityConfig
  const allowedTypes = types.filter(t => t !== "intervals" || constraints.allowIntervals)
  const count = Math.min(allowedTypes.length, sessions, constraints.maxQualitySessions)
  const placedQuality: WorkoutDay[] = []

  for (let i = 0; i < count; i++) {
    const type = allowedTypes[i]!
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

  return placedQuality
}

export function placeEasyRuns(
  weekDays: { date: string; dayKey: string }[],
  assigned: Map<string, WorkoutDay[]>,
  longRunKm: number,
  weeklyKm: number,
  paceZones: PaceZones,
  selectedDays: string[],
  placedQuality: WorkoutDay[],
): void {
  const placedQualityKm = placedQuality.reduce((s, d) => s + (d.distanceKm ?? 0), 0)
  const easyTotal = weeklyKm - longRunKm - placedQualityKm

  const easyRunDays = weekDays
    .filter(d => selectedDays.includes(d.dayKey) && !assigned.has(d.date))
    .sort((a, b) => (DAY_INDEX[a.dayKey] ?? 0) - (DAY_INDEX[b.dayKey] ?? 0))

  if (easyRunDays.length > 0 && easyTotal > 0) {
    const cap = longRunKm - 1
    const rawPerDay = easyTotal / easyRunDays.length
    const cappedPerDay = Math.min(rawPerDay, cap)
    const base = roundKm(cappedPerDay)
    const rawRemainder = Math.max(0, easyTotal - base * easyRunDays.length)

    easyRunDays.forEach((ed, i) => {
      const uncapped = base + (i === 0 ? rawRemainder : 0)
      const km = roundKm(Math.min(uncapped, cap))
      assigned.set(ed.date, [{
        date: ed.date,
        type: "easy",
        distanceKm: Math.max(0, km),
        targetPace: paceZones.easy,
      }])
    })
  }
}

export function placeStrengthSessions(
  weekDays: { date: string; dayKey: string }[],
  assigned: Map<string, WorkoutDay[]>,
  longRunDay: string,
  placedQuality: WorkoutDay[],
  sCount: number,
): void {
  const longIdx = DAY_INDEX[longRunDay] ?? 0
  const qualityDayKeys = placedQuality.map(q =>
    weekDays.find(w => w.date === q.date)?.dayKey ?? ""
  ).filter(Boolean)

  const sCandidates = weekDays.filter(({ dayKey, date }) => {
    const workouts = assigned.get(date)
    return (
      workouts?.some(w => w.type === "easy") &&
      (DAY_INDEX[dayKey] ?? 0) !== (longIdx - 1 + 7) % 7 &&
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
