import { describe, it, expect } from "vitest"
import { scheduleWorkouts } from "./workout-scheduler"
import type { PhaseEntry, WorkoutType } from "./types"
import type { PaceZones } from "./pace-calculator"

// Type-level test: "progression" must be a valid WorkoutType
const _progressionTypeCheck: WorkoutType = "progression"
void _progressionTypeCheck

const paceZones: PaceZones = {
  easy: "6:00–6:30/km",
  longRun: "5:45–6:15/km",
  mediumLong: "5:30–6:00/km",
  mp: "5:00–5:10/km",
  threshold: "4:45–4:55/km",
  vo2max: "4:30–4:40/km",
  source: "goal-time",
}

const basePhases: PhaseEntry[] = [
  { name: "Base", startWeek: 1, endWeek: 4 },
]

const baseInput = {
  startDate: "2026-06-01", // a Monday
  selectedDays: ["mon", "wed", "fri", "sat"],
  longRunDay: "sat",
  weeklyMileageRange: "40-60" as const,
  phases: basePhases,
  totalWeeks: 4,
  peakWeeklyKm: 60,
  trainingStructure: { runDaysPerWeek: 4, restDaysPerWeek: 3, maxQualitySessions: 1 },
  longRunTargets: { peakLongRunKm: 30, recoveryRunMaxKm: 13 },
  paceZones,
}

// Helper to find dayKey from a date string
const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const
function dayKeyOf(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z")
  const utcDay = d.getUTCDay() // 0=Sun, 1=Mon ... 6=Sat
  return DAY_ORDER[utcDay === 0 ? 6 : utcDay - 1]!
}
function isAdjacentTo(a: string, b: string): boolean {
  const idx: Record<string, number> = { mon:0,tue:1,wed:2,thu:3,fri:4,sat:5,sun:6 }
  return Math.abs((idx[a]??-1) - (idx[b]??-1)) === 1
}

describe("scheduleWorkouts — long run", () => {
  it("assigns a long run on longRunDay every week", () => {
    const days = scheduleWorkouts(baseInput)
    const longRuns = days.filter(d => d.type === "long")
    expect(longRuns).toHaveLength(4)
    longRuns.forEach(d => expect(dayKeyOf(d.date)).toBe("sat"))
  })

  it("long run pace is paceZones.longRun", () => {
    const days = scheduleWorkouts(baseInput)
    days.filter(d => d.type === "long").forEach(d => {
      expect(d.targetPace).toBe(paceZones.longRun)
    })
  })

  it("long run distance is capped at 35% of weekly km", () => {
    const days = scheduleWorkouts({ ...baseInput, peakWeeklyKm: 200 })
    const week1Saturday = days.find(d => d.type === "long" && d.date === "2026-06-06")
    expect(week1Saturday).toBeDefined()
    // weeklyKm for week 1 = 40 (lower bound of "40-60"), cap = 40 × 0.35 = 14
    expect(week1Saturday!.distanceKm).toBeLessThanOrEqual(14)
  })

  it("long run distance rounded to nearest 0.5", () => {
    const days = scheduleWorkouts(baseInput)
    days.filter(d => d.type === "long").forEach(d => {
      const km = d.distanceKm ?? 0
      expect((km * 2) % 1).toBe(0)
    })
  })
})

describe("scheduleWorkouts — rest days", () => {
  it("non-selected days are rest days", () => {
    const days = scheduleWorkouts(baseInput)
    const tuesdays = days.filter(d => dayKeyOf(d.date) === "tue" && d.type !== "strength")
    tuesdays.forEach(d => expect(d.type).toBe("rest"))
    const thursdays = days.filter(d => dayKeyOf(d.date) === "thu" && d.type !== "strength")
    thursdays.forEach(d => expect(d.type).toBe("rest"))
  })

  it("rest days have no distanceKm", () => {
    const days = scheduleWorkouts(baseInput)
    days.filter(d => d.type === "rest").forEach(d => {
      expect(d.distanceKm).toBeUndefined()
    })
  })
})

describe("scheduleWorkouts — easy runs", () => {
  it("easy run distance rounded to nearest 0.5", () => {
    const days = scheduleWorkouts(baseInput)
    days.filter(d => d.type === "easy").forEach(d => {
      const km = d.distanceKm ?? 0
      expect((km * 2) % 1).toBe(0)
    })
  })

  it("easy run distance capped at longRunKm - 1", () => {
    const days = scheduleWorkouts(baseInput)
    const week1Long = days.find(d => d.type === "long" && d.date >= "2026-06-01" && d.date <= "2026-06-07")
    const week1Easy = days.filter(d => d.type === "easy" && d.date >= "2026-06-01" && d.date <= "2026-06-07")
    week1Easy.forEach(d => {
      expect(d.distanceKm ?? 0).toBeLessThanOrEqual((week1Long?.distanceKm ?? 0) - 1 + 0.001)
    })
  })

  it("easy run first day is also capped at longRunKm - 1 after remainder", () => {
    // Use high peakWeeklyKm + few easy days to force remainder situation
    const days = scheduleWorkouts({
      ...baseInput,
      totalWeeks: 1,
      peakWeeklyKm: 200,
      selectedDays: ["mon", "sat"], // only 1 easy day (mon) + long run (sat)
      phases: [{ name: "General Fitness", startWeek: 1, endWeek: 1 }], // 0 quality
      trainingStructure: { runDaysPerWeek: 2, restDaysPerWeek: 5, maxQualitySessions: 0 },
    })
    const longRun = days.find(d => d.type === "long")!
    const easyRuns = days.filter(d => d.type === "easy")
    easyRuns.forEach(d => {
      expect(d.distanceKm ?? 0).toBeLessThanOrEqual((longRun.distanceKm ?? 0) - 1 + 0.001)
    })
  })
})

describe("scheduleWorkouts — total days", () => {
  it("returns exactly 7 × totalWeeks running/rest entries (strength extras allowed)", () => {
    const days = scheduleWorkouts(baseInput)
    const nonStrength = days.filter(d => d.type !== "strength")
    expect(nonStrength).toHaveLength(4 * 7)
  })

  it("no duplicate dates for non-strength days", () => {
    const days = scheduleWorkouts(baseInput)
    const nonStrength = days.filter(d => d.type !== "strength")
    const dates = nonStrength.map(d => d.date)
    expect(new Set(dates).size).toBe(dates.length)
  })
})

describe("scheduleWorkouts — quality session phase rules", () => {
  it("General Fitness phase: no quality sessions", () => {
    const days = scheduleWorkouts({
      ...baseInput,
      phases: [{ name: "General Fitness", startWeek: 1, endWeek: 4 }],
    })
    const quality = days.filter(d => ["tempo","intervals","mp"].includes(d.type))
    expect(quality).toHaveLength(0)
  })

  it("Base weeks always get 1 tempo session", () => {
    const days = scheduleWorkouts({
      ...baseInput,
      phases: [{ name: "Base", startWeek: 1, endWeek: 4 }],
    })
    const week1Quality = days.filter(d => d.date >= "2026-06-01" && d.date <= "2026-06-07" && ["intervals","tempo"].includes(d.type))
    const week2Quality = days.filter(d => d.date >= "2026-06-08" && d.date <= "2026-06-14" && ["intervals","tempo"].includes(d.type))
    expect(week1Quality).toHaveLength(1)
    expect(week1Quality[0]!.type).toBe("tempo")
    expect(week2Quality[0]!.type).toBe("tempo")
  })

  it("Build early half: 2 sessions — tempo + intervals", () => {
    const days = scheduleWorkouts({
      ...baseInput,
      totalWeeks: 6,
      trainingStructure: { runDaysPerWeek: 4, restDaysPerWeek: 3, maxQualitySessions: 2 },
      phases: [
        { name: "Base",  startWeek: 1, endWeek: 2 },
        { name: "Build", startWeek: 3, endWeek: 6 },
      ],
      peakWeeklyKm: 80,
    })
    // Build week 1 (startWeek=3, local index 0 < ceil(4*0.6)=3) = early half = tempo + intervals
    const buildW1 = days.filter(d => d.date >= "2026-06-15" && d.date <= "2026-06-21" && ["tempo","mp","intervals"].includes(d.type))
    expect(buildW1).toHaveLength(2)
    const types = buildW1.map(d => d.type)
    expect(types).toContain("tempo")
    expect(types).toContain("intervals")
  })

  it("Build second half: 2 sessions — tempo first, then mp", () => {
    const days = scheduleWorkouts({
      ...baseInput,
      totalWeeks: 6,
      trainingStructure: { runDaysPerWeek: 4, restDaysPerWeek: 3, maxQualitySessions: 2 },
      phases: [
        { name: "Base",  startWeek: 1, endWeek: 2 },
        { name: "Build", startWeek: 3, endWeek: 6 },
      ],
      peakWeeklyKm: 80,
    })
    // Build W4 (local index 3 >= ceil(4*0.6)=3) = late half = tempo + mp
    const buildW4 = days.filter(d => d.date >= "2026-07-06" && d.date <= "2026-07-12" && ["tempo","mp","intervals"].includes(d.type))
    expect(buildW4).toHaveLength(2)
    const types = buildW4.map(d => d.type)
    expect(types).toContain("tempo")
    expect(types).toContain("mp")
  })

  it("Peak phase: 2 sessions — mp first, then tempo", () => {
    const days = scheduleWorkouts({
      ...baseInput,
      totalWeeks: 4,
      trainingStructure: { runDaysPerWeek: 4, restDaysPerWeek: 3, maxQualitySessions: 2 },
      phases: [{ name: "Peak", startWeek: 1, endWeek: 4 }],
      peakWeeklyKm: 80,
    })
    const week1Quality = days.filter(d => d.date >= "2026-06-01" && d.date <= "2026-06-07" && ["tempo","mp","intervals"].includes(d.type))
    expect(week1Quality).toHaveLength(2)
    const types = week1Quality.map(d => d.type)
    expect(types).toContain("mp")
    expect(types).toContain("tempo")
    expect(types).not.toContain("intervals")
  })

  it("Taper: 1 tempo in first taper week, 0 thereafter", () => {
    const days = scheduleWorkouts({
      ...baseInput,
      totalWeeks: 3,
      phases: [{ name: "Taper", startWeek: 1, endWeek: 3 }],
      peakWeeklyKm: 80,
    })
    const week1Q = days.filter(d => d.date >= "2026-06-01" && d.date <= "2026-06-07" && ["tempo","mp","intervals"].includes(d.type))
    const week2Q = days.filter(d => d.date >= "2026-06-08" && d.date <= "2026-06-14" && ["tempo","mp","intervals"].includes(d.type))
    const week3Q = days.filter(d => d.date >= "2026-06-15" && d.date <= "2026-06-21" && ["tempo","mp","intervals"].includes(d.type))
    expect(week1Q).toHaveLength(1)
    expect(week1Q[0]!.type).toBe("tempo")
    expect(week2Q).toHaveLength(0)
    expect(week3Q).toHaveLength(0)
  })

  it("quality sessions never adjacent to long run day", () => {
    const days = scheduleWorkouts({
      ...baseInput,
      phases: [{ name: "Peak", startWeek: 1, endWeek: 4 }],
      trainingStructure: { runDaysPerWeek: 4, restDaysPerWeek: 3, maxQualitySessions: 2 },
      peakWeeklyKm: 80,
    })
    const quality = days.filter(d => ["tempo","mp","intervals"].includes(d.type))
    quality.forEach(q => {
      expect(isAdjacentTo(dayKeyOf(q.date), "sat")).toBe(false)
    })
  })

  it("no two quality sessions on consecutive days (same week)", () => {
    const days = scheduleWorkouts({
      ...baseInput,
      selectedDays: ["mon", "tue", "wed", "thu", "sat"],
      phases: [{ name: "Peak", startWeek: 1, endWeek: 4 }],
      trainingStructure: { runDaysPerWeek: 5, restDaysPerWeek: 2, maxQualitySessions: 2 },
      peakWeeklyKm: 80,
    })
    for (let w = 0; w < 4; w++) {
      const ws = new Date(new Date("2026-06-01T00:00:00Z").getTime() + w * 7 * 86400000).toISOString().slice(0,10)
      const we = new Date(new Date("2026-06-07T00:00:00Z").getTime() + w * 7 * 86400000).toISOString().slice(0,10)
      const weekQ = days.filter(d => ["tempo","mp","intervals"].includes(d.type) && d.date >= ws && d.date <= we)
      if (weekQ.length >= 2) {
        const sortedDates = weekQ.map(d => d.date).sort()
        for (let i = 0; i < sortedDates.length - 1; i++) {
          const diff = (new Date(sortedDates[i+1]!).getTime() - new Date(sortedDates[i]!).getTime()) / 86400000
          expect(diff).toBeGreaterThanOrEqual(2)
        }
      }
    }
  })

  it("Peak quality: mp placed on furthest day from long run, tempo on next", () => {
    // Long run on sat (idx 5). Eligible days: mon (dist 2), wed (dist 3) [fri adj to sat].
    // mp is scheduled first → lands on wed (dist 3, furthest).
    // tempo is scheduled second → lands on mon (dist 2, next best).
    const days = scheduleWorkouts({
      ...baseInput,
      totalWeeks: 1,
      selectedDays: ["mon", "wed", "fri", "sat"],
      phases: [{ name: "Peak", startWeek: 1, endWeek: 1 }],
      trainingStructure: { runDaysPerWeek: 4, restDaysPerWeek: 3, maxQualitySessions: 2 },
      peakWeeklyKm: 80,
    })
    const mpDay = days.find(d => d.type === "mp")
    const tempoDay = days.find(d => d.type === "tempo")
    if (mpDay && tempoDay) {
      expect(dayKeyOf(mpDay.date)).toBe("wed")
      expect(dayKeyOf(tempoDay.date)).toBe("mon")
    }
  })

  it("quality session lands on furthest day from long run (Wed for Mon–Fri + Sun)", () => {
    // Wed (dist 3 from Sun) beats Tue and Thu (dist 2) and is farthest eligible day.
    // Mon is adjacent to Sun (circular dist 1) so it is excluded from quality candidates.
    const days = scheduleWorkouts({
      ...baseInput,
      selectedDays: ["mon", "tue", "wed", "thu", "fri", "sun"],
      longRunDay: "sun",
      phases: [{ name: "Base", startWeek: 1, endWeek: 1 }],
      totalWeeks: 1,
      trainingStructure: { runDaysPerWeek: 6, restDaysPerWeek: 1, maxQualitySessions: 1 },
      peakWeeklyKm: 80,
    })
    const tempo = days.find(d => d.type === "tempo")
    expect(tempo).toBeDefined()
    expect(dayKeyOf(tempo!.date)).toBe("wed")
  })

  it("quality session dropped when no valid candidates on 2-day schedule", () => {
    const days = scheduleWorkouts({
      ...baseInput,
      selectedDays: ["fri", "sat"],
      longRunDay: "sat",
      phases: [{ name: "Base", startWeek: 1, endWeek: 4 }],
    })
    const quality = days.filter(d => ["tempo","mp","intervals"].includes(d.type))
    expect(quality).toHaveLength(0)
  })

  it("quality pace: tempo=threshold, intervals=vo2max, mp=mp", () => {
    const days = scheduleWorkouts({
      ...baseInput,
      totalWeeks: 6,
      trainingStructure: { runDaysPerWeek: 4, restDaysPerWeek: 3, maxQualitySessions: 2 },
      phases: [
        { name: "Base",  startWeek: 1, endWeek: 2 },
        { name: "Build", startWeek: 3, endWeek: 4 },
        { name: "Peak",  startWeek: 5, endWeek: 6 },
      ],
      peakWeeklyKm: 80,
    })
    days.filter(d => d.type === "tempo").forEach(d => expect(d.targetPace).toBe(paceZones.threshold))
    days.filter(d => d.type === "intervals").forEach(d => expect(d.targetPace).toBe(paceZones.vo2max))
    days.filter(d => d.type === "mp").forEach(d => expect(d.targetPace).toBe(paceZones.mp))
  })
})

describe("scheduleWorkouts — strength sessions", () => {
  it("strength sessions appear on easy run days only", () => {
    const days = scheduleWorkouts({
      ...baseInput,
      phases: [{ name: "Base", startWeek: 1, endWeek: 4 }],
    })
    const strength = days.filter(d => d.type === "strength")
    strength.forEach(s => {
      const sameDay = days.filter(d => d.date === s.date)
      expect(sameDay.some(d => d.type === "easy")).toBe(true)
    })
  })

  it("strength sessions have no distanceKm or targetPace", () => {
    const days = scheduleWorkouts(baseInput)
    days.filter(d => d.type === "strength").forEach(s => {
      expect(s.distanceKm).toBeUndefined()
      expect(s.targetPace).toBeUndefined()
    })
  })

  it("no strength session adjacent to long run day", () => {
    const days = scheduleWorkouts(baseInput)
    days.filter(d => d.type === "strength").forEach(s => {
      expect(isAdjacentTo(dayKeyOf(s.date), "sat")).toBe(false)
    })
  })

  it("no strength session is adjacent to any quality session in the same week", () => {
    // Base phase: 1 tempo per week placed on furthest non-adjacent day from Sat (Tue, dist 3).
    // After placement, strength must not land on Mon or Wed (adjacent to Tue).
    const days = scheduleWorkouts({
      ...baseInput,
      selectedDays: ["mon", "tue", "wed", "thu", "fri", "sat"],
      longRunDay: "sat",
      phases: [{ name: "Base", startWeek: 1, endWeek: 4 }],
      trainingStructure: { runDaysPerWeek: 6, restDaysPerWeek: 1, maxQualitySessions: 1 },
      peakWeeklyKm: 80,
    })
    const strengthDays = days.filter(d => d.type === "strength")
    const qualityDays  = days.filter(d => ["tempo", "intervals", "mp"].includes(d.type))

    strengthDays.forEach(s => {
      const sameWeekQuality = qualityDays.filter(q => {
        const diff = Math.abs(new Date(s.date).getTime() - new Date(q.date).getTime())
        return diff < 7 * 86400000
      })
      sameWeekQuality.forEach(q => {
        expect(isAdjacentTo(dayKeyOf(s.date), dayKeyOf(q.date))).toBe(false)
      })
    })
  })

  it("no two strength sessions on consecutive days in a week", () => {
    const days = scheduleWorkouts({
      ...baseInput,
      selectedDays: ["mon", "tue", "wed", "thu", "fri", "sat"],
      trainingStructure: { runDaysPerWeek: 6, restDaysPerWeek: 1, maxQualitySessions: 1 },
      phases: [{ name: "Base", startWeek: 1, endWeek: 4 }],
      peakWeeklyKm: 80,
    })
    for (let w = 0; w < 4; w++) {
      const ws = new Date(new Date("2026-06-01T00:00:00Z").getTime() + w * 7 * 86400000).toISOString().slice(0,10)
      const we = new Date(new Date("2026-06-07T00:00:00Z").getTime() + w * 7 * 86400000).toISOString().slice(0,10)
      const weekS = days.filter(d => d.type === "strength" && d.date >= ws && d.date <= we)
      if (weekS.length >= 2) {
        const sortedDates = weekS.map(d => d.date).sort()
        for (let i = 0; i < sortedDates.length - 1; i++) {
          const diff = (new Date(sortedDates[i+1]!).getTime() - new Date(sortedDates[i]!).getTime()) / 86400000
          expect(diff).toBeGreaterThanOrEqual(2)
        }
      }
    }
  })

  it("Base/Build: places 2 strength sessions when schedule allows", () => {
    // Use General Fitness (0 quality sessions) so Mon and Wed are both easy days.
    // Both are non-adjacent to Sat (long run) and non-consecutive → 2 strength sessions.
    const days = scheduleWorkouts({
      ...baseInput,
      selectedDays: ["mon", "wed", "fri", "sat"],
      phases: [{ name: "General Fitness", startWeek: 1, endWeek: 4 }],
      peakWeeklyKm: 60,
    })
    const week1Strength = days.filter(d => d.type === "strength" && d.date >= "2026-06-01" && d.date <= "2026-06-07")
    expect(week1Strength).toHaveLength(2)
  })

  it("Peak: 2 strength in early weeks, 1 in final 2 weeks", () => {
    // Use 5 run days with 1 quality session so easy days remain for strength.
    // Long run on sat → fri is adjacent. Quality lands on Tue (dist 3 from Sat, tied with Wed — Tue wins by DAY_ORDER stability).
    // Wed and Thu are non-adjacent to Mon quality and non-adjacent to Sat → 2 strength candidates.
    const days = scheduleWorkouts({
      ...baseInput,
      totalWeeks: 4,
      selectedDays: ["mon", "tue", "wed", "thu", "sat"],
      phases: [{ name: "Peak", startWeek: 1, endWeek: 4 }],
      trainingStructure: { runDaysPerWeek: 5, restDaysPerWeek: 2, maxQualitySessions: 1 },
      peakWeeklyKm: 80,
    })
    // Week 1 and 2: early Peak (localIndex 0,1 < 4-2=2) → 2 strength sessions
    const w1s = days.filter(d => d.type === "strength" && d.date >= "2026-06-01" && d.date <= "2026-06-07")
    const w2s = days.filter(d => d.type === "strength" && d.date >= "2026-06-08" && d.date <= "2026-06-14")
    // Week 3 and 4: final 2 weeks of Peak (localIndex 2,3 >= 4-2=2) → 1 strength session
    const w3s = days.filter(d => d.type === "strength" && d.date >= "2026-06-15" && d.date <= "2026-06-21")
    const w4s = days.filter(d => d.type === "strength" && d.date >= "2026-06-22" && d.date <= "2026-06-28")
    // Can't always guarantee exactly 2 (depends on easy day availability), but final 2 weeks must have ≤ 1
    expect(w3s.length).toBeLessThanOrEqual(1)
    expect(w4s.length).toBeLessThanOrEqual(1)
    // And early weeks should try for 2
    expect(w1s.length + w2s.length).toBeGreaterThanOrEqual(2)
  })

  it("Taper: 1 strength in first week, 0 afterward", () => {
    const days = scheduleWorkouts({
      ...baseInput,
      selectedDays: ["mon", "wed", "fri", "sat"],
      phases: [{ name: "Taper", startWeek: 1, endWeek: 3 }],
    })
    const w1s = days.filter(d => d.type === "strength" && d.date >= "2026-06-01" && d.date <= "2026-06-07")
    const w2s = days.filter(d => d.type === "strength" && d.date >= "2026-06-08" && d.date <= "2026-06-14")
    const w3s = days.filter(d => d.type === "strength" && d.date >= "2026-06-15" && d.date <= "2026-06-21")
    expect(w1s).toHaveLength(1)
    expect(w2s).toHaveLength(0)
    expect(w3s).toHaveLength(0)
  })

  it("Base phase places 2 strength sessions (Mon + Fri) for Mon–Fri + Sun runner", () => {
    // After Task 1: tempo is on Wed (dist 3 from Sun).
    // Easy days: Mon, Tue, Thu, Fri. Pre-only blocks Sat (day before Sun) — not in selectedDays.
    // Adjacent to Wed: Tue and Thu blocked. Remaining: Mon and Fri — non-adjacent → 2 sessions.
    const days = scheduleWorkouts({
      ...baseInput,
      selectedDays: ["mon", "tue", "wed", "thu", "fri", "sun"],
      longRunDay: "sun",
      phases: [{ name: "Base", startWeek: 1, endWeek: 1 }],
      totalWeeks: 1,
      trainingStructure: { runDaysPerWeek: 6, restDaysPerWeek: 1, maxQualitySessions: 1 },
      peakWeeklyKm: 80,
    })
    const strengthDays = days
      .filter(d => d.type === "strength" && d.date >= "2026-06-01" && d.date <= "2026-06-07")
      .map(d => dayKeyOf(d.date))
      .sort()
    expect(strengthDays).toHaveLength(2)
    expect(strengthDays).toContain("mon")
    expect(strengthDays).toContain("fri")
  })
})

describe("scheduleWorkouts — determinism", () => {
  it("identical inputs produce identical outputs", () => {
    const a = scheduleWorkouts(baseInput)
    const b = scheduleWorkouts(baseInput)
    expect(a).toEqual(b)
  })
})

// Helpers for phase config tests
function makeInput(phases: PhaseEntry[], totalWeeks: number, selectedDays = ["mon", "wed", "fri", "sat"]) {
  return {
    startDate: "2026-06-01",
    selectedDays,
    longRunDay: "sat",
    weeklyMileageRange: "40-60" as const,
    phases,
    totalWeeks,
    peakWeeklyKm: 80,
    trainingStructure: { runDaysPerWeek: selectedDays.length, restDaysPerWeek: 7 - selectedDays.length, maxQualitySessions: 2 },
    longRunTargets: { peakLongRunKm: 30, recoveryRunMaxKm: 13 },
    paceZones,
  }
}

describe("phase config — quality session types", () => {
  it("Base weeks get 1 tempo session, not intervals", () => {
    const phases: PhaseEntry[] = [{ name: "Base", startWeek: 1, endWeek: 8 }]
    const days = scheduleWorkouts(makeInput(phases, 8))
    const qualitySessions = days.filter(d => d.type === "tempo" || d.type === "intervals" || d.type === "mp")
    // No intervals in Base
    expect(days.filter(d => d.type === "intervals")).toHaveLength(0)
    // Tempo sessions present
    expect(qualitySessions.filter(d => d.type === "tempo").length).toBeGreaterThan(0)
  })

  it("early Build gets tempo + intervals", () => {
    // 8-week Build; weeks 1-5 are early (localIndex 0-4 < ceil(8*0.6)=5)
    const phases: PhaseEntry[] = [
      { name: "Build", startWeek: 1, endWeek: 8 },
    ]
    const days = scheduleWorkouts(makeInput(phases, 8))
    // Week 1 (localIndex 0 < 5 → early) should have both tempo and intervals
    const week1 = days.filter(d => {
      const d0 = new Date("2026-06-01T00:00:00Z")
      const dDate = new Date(d.date + "T00:00:00Z")
      const dayDiff = Math.floor((dDate.getTime() - d0.getTime()) / 86400000)
      return dayDiff < 7
    })
    const types = week1.map(d => d.type)
    expect(types).toContain("tempo")
    expect(types).toContain("intervals")
  })

  it("late Build gets tempo + mp", () => {
    // 8-week Build; weeks 6-8 are late (localIndex 5-7 >= ceil(8*0.6)=5)
    const phases: PhaseEntry[] = [
      { name: "Build", startWeek: 1, endWeek: 8 },
    ]
    const days = scheduleWorkouts(makeInput(phases, 8))
    // Week 6 (localIndex 5 >= 5 → late) should have both tempo and mp, no intervals
    const week6 = days.filter(d => {
      const d0 = new Date("2026-06-01T00:00:00Z")
      const dDate = new Date(d.date + "T00:00:00Z")
      const dayDiff = Math.floor((dDate.getTime() - d0.getTime()) / 86400000)
      return dayDiff >= 35 && dayDiff < 42
    })
    const types = week6.map(d => d.type)
    expect(types).toContain("tempo")
    expect(types).toContain("mp")
    expect(types).not.toContain("intervals")
  })

  it("Peak recovery week (every 4th) gets 1 tempo, not 2 sessions", () => {
    // 8-week Peak with no taper; week 4 is a recovery week (4 % 4 === 0)
    const phases: PhaseEntry[] = [
      { name: "Peak", startWeek: 1, endWeek: 8 },
    ]
    const days = scheduleWorkouts(makeInput(phases, 8))
    // Week 4 = recovery week; should have 1 quality session (tempo), not mp
    const week4Quality = days.filter(d => {
      const d0 = new Date("2026-06-01T00:00:00Z")
      const dDate = new Date(d.date + "T00:00:00Z")
      const dayDiff = Math.floor((dDate.getTime() - d0.getTime()) / 86400000)
      return dayDiff >= 21 && dayDiff < 28 && (d.type === "tempo" || d.type === "mp" || d.type === "intervals")
    })
    expect(week4Quality).toHaveLength(1)
    expect(week4Quality[0]!.type).toBe("tempo")
  })

  it("Taper week 1 gets 1 tempo session", () => {
    const phases: PhaseEntry[] = [
      { name: "Peak", startWeek: 1, endWeek: 4 },
      { name: "Taper", startWeek: 5, endWeek: 7 },
    ]
    const days = scheduleWorkouts(makeInput(phases, 7))
    // Week 5 = taper first week; 1 tempo
    const week5Quality = days.filter(d => {
      const d0 = new Date("2026-06-01T00:00:00Z")
      const dDate = new Date(d.date + "T00:00:00Z")
      const dayDiff = Math.floor((dDate.getTime() - d0.getTime()) / 86400000)
      return dayDiff >= 28 && dayDiff < 35 && (d.type === "tempo" || d.type === "mp" || d.type === "intervals")
    })
    expect(week5Quality).toHaveLength(1)
    expect(week5Quality[0]!.type).toBe("tempo")
  })

  it("Taper weeks 2+ get no quality sessions", () => {
    const phases: PhaseEntry[] = [
      { name: "Peak", startWeek: 1, endWeek: 4 },
      { name: "Taper", startWeek: 5, endWeek: 7 },
    ]
    const days = scheduleWorkouts(makeInput(phases, 7))
    // Weeks 6-7 = taper rest weeks; 0 quality
    const taper23Quality = days.filter(d => {
      const d0 = new Date("2026-06-01T00:00:00Z")
      const dDate = new Date(d.date + "T00:00:00Z")
      const dayDiff = Math.floor((dDate.getTime() - d0.getTime()) / 86400000)
      return dayDiff >= 35 && (d.type === "tempo" || d.type === "mp" || d.type === "intervals")
    })
    expect(taper23Quality).toHaveLength(0)
  })

  it("taper week 1 gets exactly 1 tempo even with Peak immediately prior (full 29-week plan)", () => {
    // Mirrors a real 29-week full marathon plan.
    // startDate 2026-03-23 (Monday). Week 27 starts on 2026-09-21.
    const phases: PhaseEntry[] = [
      { name: "General Fitness", startWeek: 1,  endWeek: 6  },
      { name: "Base",            startWeek: 7,  endWeek: 15 },
      { name: "Build",           startWeek: 16, endWeek: 22 },
      { name: "Peak",            startWeek: 23, endWeek: 26 },
      { name: "Taper",           startWeek: 27, endWeek: 29 },
    ]
    const days = scheduleWorkouts({
      startDate: "2026-03-23",
      selectedDays: ["mon", "tue", "wed", "thu", "fri", "sun"],
      longRunDay: "sun",
      weeklyMileageRange: "60-80" as const,
      phases,
      totalWeeks: 29,
      peakWeeklyKm: 100,
      trainingStructure: { runDaysPerWeek: 6, restDaysPerWeek: 1, maxQualitySessions: 2 },
      longRunTargets: { peakLongRunKm: 35, recoveryRunMaxKm: 13 },
      paceZones,
    })
    // Taper W1 = week 27. startDate + (27-1)*7 = 2026-03-23 + 182 days = 2026-09-21.
    const taperW1Start = "2026-09-21"
    const taperW1End   = "2026-09-27"
    const taperW1Quality = days.filter(d =>
      d.date >= taperW1Start &&
      d.date <= taperW1End &&
      (d.type === "tempo" || d.type === "mp" || d.type === "intervals")
    )
    expect(taperW1Quality).toHaveLength(1)
    expect(taperW1Quality[0]!.type).toBe("tempo")
  })
})

describe("progression long runs", () => {
  it("Build week 3 (localIndex 2) gets a progression run", () => {
    // 6-week Build starting week 1; localIndex 2 → 2 % 3 === 2 → progression
    // startDate "2026-06-01" (Mon); week 3 Sat = offset 19 = "2026-06-20"
    const phases: PhaseEntry[] = [{ name: "Build", startWeek: 1, endWeek: 6 }]
    const days = scheduleWorkouts(makeInput(phases, 6))
    const thirdSat = days.find(d => d.date === "2026-06-20") // week 3 Saturday
    expect(thirdSat?.type).toBe("progression")
  })

  it("Build weeks 1 and 2 get regular long runs", () => {
    // Week 1 (localIndex 0): 0 % 3 = 0 ≠ 2 → long
    // Week 2 (localIndex 1): 1 % 3 = 1 ≠ 2 → long
    const phases: PhaseEntry[] = [{ name: "Build", startWeek: 1, endWeek: 6 }]
    const days = scheduleWorkouts(makeInput(phases, 6))
    const sat1 = days.find(d => d.date === "2026-06-06") // week 1 Sat
    const sat2 = days.find(d => d.date === "2026-06-13") // week 2 Sat
    expect(sat1?.type).toBe("long")
    expect(sat2?.type).toBe("long")
  })

  it("Peak odd-indexed weeks get progression runs", () => {
    // 4-week Peak; localIndex 1 and 3 → progression (% 2 === 1)
    const phases: PhaseEntry[] = [{ name: "Peak", startWeek: 1, endWeek: 4 }]
    const days = scheduleWorkouts(makeInput(phases, 4))
    const sat2 = days.find(d => d.date === "2026-06-13") // week 2, localIndex 1
    const sat4 = days.find(d => d.date === "2026-06-27") // week 4, localIndex 3
    expect(sat2?.type).toBe("progression")
    expect(sat4?.type).toBe("progression")
  })

  it("Peak even-indexed weeks get regular long runs", () => {
    const phases: PhaseEntry[] = [{ name: "Peak", startWeek: 1, endWeek: 4 }]
    const days = scheduleWorkouts(makeInput(phases, 4))
    const sat1 = days.find(d => d.date === "2026-06-06") // week 1, localIndex 0
    const sat3 = days.find(d => d.date === "2026-06-20") // week 3, localIndex 2
    expect(sat1?.type).toBe("long")
    expect(sat3?.type).toBe("long")
  })

  it("Base long runs are always type long", () => {
    const phases: PhaseEntry[] = [{ name: "Base", startWeek: 1, endWeek: 6 }]
    const days = scheduleWorkouts(makeInput(phases, 6))
    const longRuns = days.filter(d => d.type === "long" || d.type === "progression")
    expect(longRuns.every(d => d.type === "long")).toBe(true)
  })

  it("progression run has same pace as long run", () => {
    const phases: PhaseEntry[] = [{ name: "Build", startWeek: 1, endWeek: 6 }]
    const days = scheduleWorkouts(makeInput(phases, 6))
    const progression = days.find(d => d.type === "progression")
    expect(progression?.targetPace).toBe(paceZones.longRun)
  })

  it("16-week plan: 2 intervals sessions after early Build boundary fix", () => {
    // Build = W7–10 (4 wks). New early: ceil(4*0.6)=3 → W7–9.
    // W8 is recovery (8%4=0). Non-recovery early: W7, W9 → 2 intervals.
    const phases: PhaseEntry[] = [
      { name: "Base",  startWeek: 1, endWeek: 6 },
      { name: "Build", startWeek: 7, endWeek: 10 },
      { name: "Peak",  startWeek: 11, endWeek: 13 },
      { name: "Taper", startWeek: 14, endWeek: 16 },
    ]
    const days = scheduleWorkouts(makeInput(phases, 16))
    expect(days.filter(d => d.type === "intervals")).toHaveLength(2)
  })

  it("18-week plan: 2 intervals sessions after early Build boundary fix", () => {
    // Build = W8–12 (5 wks). New early: ceil(5*0.6)=3 → W8–10.
    // W8 is recovery (8%4=0). Non-recovery early: W9, W10 → 2 intervals.
    const phases: PhaseEntry[] = [
      { name: "Base",  startWeek: 1, endWeek: 7 },
      { name: "Build", startWeek: 8, endWeek: 12 },
      { name: "Peak",  startWeek: 13, endWeek: 15 },
      { name: "Taper", startWeek: 16, endWeek: 18 },
    ]
    const days = scheduleWorkouts(makeInput(phases, 18))
    expect(days.filter(d => d.type === "intervals")).toHaveLength(2)
  })

  it("21-week plan: 2 intervals sessions after early Build boundary fix", () => {
    // Build = W11–15 (5 wks). New early: ceil(5*0.6)=3 → W11–13.
    // W12 is recovery (12%4=0). Non-recovery early: W11, W13 → 2 intervals.
    const phases: PhaseEntry[] = [
      { name: "General Fitness", startWeek: 1, endWeek: 4 },
      { name: "Base",  startWeek: 5, endWeek: 10 },
      { name: "Build", startWeek: 11, endWeek: 15 },
      { name: "Peak",  startWeek: 16, endWeek: 18 },
      { name: "Taper", startWeek: 19, endWeek: 21 },
    ]
    const days = scheduleWorkouts(makeInput(phases, 21))
    expect(days.filter(d => d.type === "intervals")).toHaveLength(2)
  })
})

// ── Race week ────────────────────────────────────────────────────────────────

describe("scheduleWorkouts — race week", () => {
  // 4-week plan, taper throughout, race on Sunday of week 4.
  // startDate 2026-06-01 (Mon) → week 4 = Mon 2026-06-22 – Sun 2026-06-28.
  // selectedDays: mon, wed, fri, sat; longRunDay: sat; race: 2026-06-28 (Sun).
  // pre-race day: 2026-06-27 (Sat) — coincides with longRunDay.
  const raceInput = {
    ...baseInput,
    raceDateISO: "2026-06-28",
    totalWeeks: 4,
    peakWeeklyKm: 100,
    phases: [{ name: "Taper", startWeek: 1, endWeek: 4 }] as PhaseEntry[],
  }

  function week4Days(days: ReturnType<typeof scheduleWorkouts>) {
    return days.filter(d => d.date >= "2026-06-22" && d.date <= "2026-06-28")
  }

  it("race week has no long run", () => {
    const days = week4Days(scheduleWorkouts(raceInput))
    expect(days.some(d => d.type === "long" || d.type === "progression")).toBe(false)
  })

  it("race week has no quality sessions", () => {
    const days = week4Days(scheduleWorkouts(raceInput))
    const qualityTypes = new Set(["tempo", "intervals", "mp"])
    expect(days.some(d => qualityTypes.has(d.type))).toBe(false)
  })

  it("race day (Sun) gets type rest", () => {
    const days = scheduleWorkouts(raceInput)
    const raceDay = days.find(d => d.date === "2026-06-28")
    expect(raceDay?.type).toBe("rest")
  })

  it("pre-race day gets a shakeout run, not rest", () => {
    const days = scheduleWorkouts(raceInput)
    const preRaceDay = days.find(d => d.date === "2026-06-27")
    expect(preRaceDay?.type).toBe("shakeout")
    expect(preRaceDay?.distanceKm).toBe(5)
    expect(preRaceDay?.targetPace).toBe(paceZones.easy)
  })

  it("shakeout appears on pre-race day even if that day is not in selectedDays", () => {
    // raceInput selectedDays: ["mon","wed","fri","sat"]. Use a race on Monday so
    // the pre-race day (Sunday) is not in selectedDays.
    const days = scheduleWorkouts({
      ...raceInput,
      selectedDays: ["mon", "wed", "fri", "sat"],
      longRunDay: "sat",
      raceDateISO: "2026-06-29", // Monday — pre-race day = Sunday June 28
    })
    const preRaceDay = days.find(d => d.date === "2026-06-28")
    expect(preRaceDay?.type).toBe("shakeout")
    expect(preRaceDay?.distanceKm).toBe(5)
  })

  it("selected days except race day and pre-race day get easy runs", () => {
    // mon (2026-06-22), wed (2026-06-24), fri (2026-06-26) should be easy
    const days = scheduleWorkouts(raceInput)
    expect(days.find(d => d.date === "2026-06-22")?.type).toBe("easy")
    expect(days.find(d => d.date === "2026-06-24")?.type).toBe("easy")
    expect(days.find(d => d.date === "2026-06-26")?.type).toBe("easy")
  })

  it("non-selected days in race week get type rest", () => {
    // tue (2026-06-23), thu (2026-06-25)
    const days = scheduleWorkouts(raceInput)
    expect(days.find(d => d.date === "2026-06-23")?.type).toBe("rest")
    expect(days.find(d => d.date === "2026-06-25")?.type).toBe("rest")
  })

  it("race week easy run total is capped at 20% of peak", () => {
    // peakWeeklyKm=100; taper week 4 → 40% = 40 km, but cap = 100 * 0.20 = 20 km
    // eligible days: mon/wed/fri (3 days); round05(20/3) = 6.5 km each → 19.5 km total
    const days = week4Days(scheduleWorkouts(raceInput))
    const easyKm = days
      .filter(d => d.type === "easy")
      .reduce((s, d) => s + (d.distanceKm ?? 0), 0)
    expect(easyKm).toBeCloseTo(19.5, 1)
  })

  it("race week easy runs are short jogs (≤ 7 km each)", () => {
    // With cap=20 km and 3 eligible days, each easy run should be round05(20/3)=6.5 km
    const days = week4Days(scheduleWorkouts(raceInput))
    const easyDays = days.filter(d => d.type === "easy")
    easyDays.forEach(d => {
      expect(d.distanceKm).toBeDefined()
      expect(d.distanceKm!).toBeLessThanOrEqual(7)
    })
  })

  it("when raceDateISO is absent, normal scheduling applies (no regression)", () => {
    const { raceDateISO: _, ...noRaceInput } = raceInput
    const days = scheduleWorkouts(noRaceInput)
    const w4 = week4Days(days)
    // Normal taper week should still have a long run on longRunDay (sat)
    expect(w4.some(d => d.type === "long" || d.type === "progression")).toBe(true)
  })
})
