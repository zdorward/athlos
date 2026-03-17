import { describe, it, expect } from "vitest"
import { computeWeeklyVolumes } from "./volume-progression"
import type { PhaseEntry } from "./types"

const noTaperPhases: PhaseEntry[] = [
  { name: "Base",  startWeek: 1, endWeek: 6 },
  { name: "Build", startWeek: 7, endWeek: 10 },
  { name: "Peak",  startWeek: 11, endWeek: 12 },
]

const withTaperPhases: PhaseEntry[] = [
  { name: "Base",  startWeek: 1, endWeek: 6 },
  { name: "Build", startWeek: 7, endWeek: 10 },
  { name: "Peak",  startWeek: 11, endWeek: 14 },
  { name: "Taper", startWeek: 15, endWeek: 17 },
]

describe("computeWeeklyVolumes", () => {
  it("week 1 uses lower bound of weeklyMileageRange", () => {
    const vols = computeWeeklyVolumes({
      totalWeeks: 8,
      weeklyMileageRange: "40-60",
      peakWeeklyKm: 100,
      phases: noTaperPhases,
    })
    expect(vols[0]).toBe(40)
  })

  it("week 1 lower bounds: under-40=30, 60-80=60, 80-plus=80", () => {
    const base = { totalWeeks: 8, peakWeeklyKm: 200, phases: noTaperPhases }
    expect(computeWeeklyVolumes({ ...base, weeklyMileageRange: "under-40" })[0]).toBe(30)
    expect(computeWeeklyVolumes({ ...base, weeklyMileageRange: "60-80" })[0]).toBe(60)
    expect(computeWeeklyVolumes({ ...base, weeklyMileageRange: "80-plus" })[0]).toBe(80)
  })

  it("non-recovery weeks grow by 10%", () => {
    const vols = computeWeeklyVolumes({
      totalWeeks: 3,
      weeklyMileageRange: "40-60",
      peakWeeklyKm: 200,
      phases: noTaperPhases,
    })
    expect(vols[1]).toBeCloseTo(44, 5)
    expect(vols[2]).toBeCloseTo(48.4, 5)
  })

  it("week 4 is a recovery week at 70% of week 3", () => {
    const vols = computeWeeklyVolumes({
      totalWeeks: 5,
      weeklyMileageRange: "40-60",
      peakWeeklyKm: 200,
      phases: noTaperPhases,
    })
    const week3 = vols[2]!
    expect(vols[3]).toBeCloseTo(week3 * 0.7, 5)
  })

  it("week 8 is a recovery week at 70% of week 7", () => {
    const vols = computeWeeklyVolumes({
      totalWeeks: 9,
      weeklyMileageRange: "40-60",
      peakWeeklyKm: 200,
      phases: noTaperPhases,
    })
    expect(vols[7]).toBeCloseTo(vols[6]! * 0.7, 5)
  })

  it("result is capped at peakWeeklyKm", () => {
    const vols = computeWeeklyVolumes({
      totalWeeks: 20,
      weeklyMileageRange: "80-plus",
      peakWeeklyKm: 90,
      phases: noTaperPhases,
    })
    expect(Math.max(...vols)).toBeLessThanOrEqual(90)
  })

  it("taper week 1 = 80% of peak, week 2 = 60%, week 3 = 40%", () => {
    const peak = 100
    const vols = computeWeeklyVolumes({
      totalWeeks: 17,
      weeklyMileageRange: "40-60",
      peakWeeklyKm: peak,
      phases: withTaperPhases,
    })
    expect(vols[14]).toBe(80) // taper week 1 = index 14
    expect(vols[15]).toBe(60) // taper week 2
    expect(vols[16]).toBe(40) // taper week 3
  })

  it("taper overrides recovery week rule", () => {
    const vols = computeWeeklyVolumes({
      totalWeeks: 17,
      weeklyMileageRange: "40-60",
      peakWeeklyKm: 100,
      phases: withTaperPhases,
    })
    expect(vols[15]).toBe(60)
  })

  it("final non-taper week suppresses recovery rule when weekNumber % 4 === 0", () => {
    const vols = computeWeeklyVolumes({
      totalWeeks: 12,
      weeklyMileageRange: "40-60",
      peakWeeklyKm: 200,
      phases: noTaperPhases,
    })
    expect(vols[11]).toBeCloseTo(vols[10]! * 1.1, 5)
  })

  it("taper is capped at peakWeeklyKm", () => {
    const vols = computeWeeklyVolumes({
      totalWeeks: 17,
      weeklyMileageRange: "40-60",
      peakWeeklyKm: 50,
      phases: withTaperPhases,
    })
    expect(Math.max(...vols)).toBeLessThanOrEqual(50)
  })
})
