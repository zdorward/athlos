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

  it("week 1 lower bounds: 25-40=30, 60-80=60, 80-plus=80", () => {
    const base = { totalWeeks: 8, peakWeeklyKm: 200, phases: noTaperPhases }
    expect(computeWeeklyVolumes({ ...base, weeklyMileageRange: "25-40" as const })[0]).toBe(30)
    expect(computeWeeklyVolumes({ ...base, weeklyMileageRange: "60-80" })[0]).toBe(60)
    expect(computeWeeklyVolumes({ ...base, weeklyMileageRange: "80-plus" })[0]).toBe(80)
  })

  it("last pre-taper week reaches peakWeeklyKm", () => {
    const peak = 100
    const vols = computeWeeklyVolumes({
      totalWeeks: 17,
      weeklyMileageRange: "40-60",
      peakWeeklyKm: peak,
      phases: withTaperPhases, // taper starts week 15, so last pre-taper = week 14
    })
    expect(vols[13]).toBe(peak) // week 14 = index 13
  })

  it("last week reaches peakWeeklyKm when there is no taper", () => {
    const peak = 100
    const vols = computeWeeklyVolumes({
      totalWeeks: 12,
      weeklyMileageRange: "40-60",
      peakWeeklyKm: peak,
      phases: noTaperPhases,
    })
    expect(vols[11]).toBe(peak) // week 12 = index 11
  })

  it("non-recovery weeks follow linear trajectory from startVol to peak", () => {
    const peak = 100
    const vols = computeWeeklyVolumes({
      totalWeeks: 14,
      weeklyMileageRange: "40-60", // startVol = 40
      peakWeeklyKm: peak,
      phases: withTaperPhases, // preTaperWeeks = 14
    })
    // t = (w-1)/13 → targetVol = 40 + 60*t
    expect(vols[0]).toBeCloseTo(40, 1)       // week 1: t=0
    expect(vols[6]).toBeCloseTo(40 + 60 * (6 / 13), 1) // week 7
    expect(vols[13]).toBeCloseTo(100, 1)     // week 14: t=1
  })

  it("recovery weeks (every 4th) are 70% of their linear target", () => {
    const peak = 100
    const vols = computeWeeklyVolumes({
      totalWeeks: 17,
      weeklyMileageRange: "40-60",
      peakWeeklyKm: peak,
      phases: withTaperPhases, // preTaperWeeks = 14
    })
    // Week 4 target: 40 + 60*(3/13) ≈ 53.85; recovery = 53.85*0.7 ≈ 37.69
    const week4Target = 40 + 60 * (3 / 13)
    expect(vols[3]).toBeCloseTo(week4Target * 0.7, 1)

    // Week 8 target: 40 + 60*(7/13) ≈ 72.31; recovery = 72.31*0.7 ≈ 50.62
    const week8Target = 40 + 60 * (7 / 13)
    expect(vols[7]).toBeCloseTo(week8Target * 0.7, 1)
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

  it("taper is capped at peakWeeklyKm", () => {
    const vols = computeWeeklyVolumes({
      totalWeeks: 17,
      weeklyMileageRange: "40-60",
      peakWeeklyKm: 50,
      phases: withTaperPhases,
    })
    expect(Math.max(...vols)).toBeLessThanOrEqual(50)
  })

  it("volumes increase overall from start to peak despite recovery dips", () => {
    const vols = computeWeeklyVolumes({
      totalWeeks: 17,
      weeklyMileageRange: "40-60",
      peakWeeklyKm: 100,
      phases: withTaperPhases,
    })
    // Pre-taper volumes should trend upward: last pre-taper > first
    expect(vols[13]).toBeGreaterThan(vols[0]!)
  })
})
