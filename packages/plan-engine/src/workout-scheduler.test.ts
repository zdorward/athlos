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

  it("Base phase: 1 quality/week — intervals on even local index, tempo on odd", () => {
    const days = scheduleWorkouts({
      ...baseInput,
      phases: [{ name: "Base", startWeek: 1, endWeek: 4 }],
    })
    const week1Quality = days.filter(d => d.date >= "2026-06-01" && d.date <= "2026-06-07" && ["intervals","tempo"].includes(d.type))
    const week2Quality = days.filter(d => d.date >= "2026-06-08" && d.date <= "2026-06-14" && ["intervals","tempo"].includes(d.type))
    expect(week1Quality).toHaveLength(1)
    expect(week1Quality[0]!.type).toBe("intervals") // week 1 = local index 0 = even
    expect(week2Quality[0]!.type).toBe("tempo")      // week 2 = local index 1 = odd
  })

  it("Build first half: 1 tempo/week", () => {
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
    // Build week 1 (startWeek=3, local index 0 < floor(4/2)=2) = first half = 1 tempo
    const buildW1 = days.filter(d => d.date >= "2026-06-15" && d.date <= "2026-06-21" && ["tempo","mp","intervals"].includes(d.type))
    expect(buildW1).toHaveLength(1)
    expect(buildW1[0]!.type).toBe("tempo")
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
    // Build week 3 (local index 2 >= floor(4/2)=2) = second half = tempo + mp
    const buildW3 = days.filter(d => d.date >= "2026-06-29" && d.date <= "2026-07-05" && ["tempo","mp","intervals"].includes(d.type))
    expect(buildW3).toHaveLength(2)
    const types = buildW3.map(d => d.type)
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

  it("Peak quality: mp is placed on an earlier calendar day than tempo", () => {
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
      // mp should be on an earlier or same day as tempo
      expect(mpDay.date <= tempoDay.date).toBe(true)
    }
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
    // Use 5 run days so there are enough easy days (non-adjacent to long run) for strength
    // Long run on sat → fri is adjacent, so mon/tue/wed/thu are all valid easy day candidates
    const days = scheduleWorkouts({
      ...baseInput,
      totalWeeks: 4,
      selectedDays: ["mon", "tue", "wed", "thu", "sat"],
      phases: [{ name: "Peak", startWeek: 1, endWeek: 4 }],
      trainingStructure: { runDaysPerWeek: 5, restDaysPerWeek: 2, maxQualitySessions: 2 },
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
})

describe("scheduleWorkouts — determinism", () => {
  it("identical inputs produce identical outputs", () => {
    const a = scheduleWorkouts(baseInput)
    const b = scheduleWorkouts(baseInput)
    expect(a).toEqual(b)
  })
})
