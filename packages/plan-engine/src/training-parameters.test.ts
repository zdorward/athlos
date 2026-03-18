import { describe, it, expect } from "vitest"
import { computeGoalPeakMileage, computeTrainingStructure, computeLongRunTargets } from "./training-parameters"

// ─── computeGoalPeakMileage ──────────────────────────────────────────────────

describe("computeGoalPeakMileage", () => {
  it("marathon 3:30 (210 min) → 65–80 km/week", () => {
    const result = computeGoalPeakMileage("full", 210)
    expect(result).toEqual({ low: 65, high: 80 })
  })

  it("marathon 2:30 (150 min, sub-2:45) → 110–130 km/week", () => {
    expect(computeGoalPeakMileage("full", 150)).toEqual({ low: 110, high: 130 })
  })

  it("marathon 2:45 exactly (165 min) → 95–115 km/week (lower bound inclusive)", () => {
    expect(computeGoalPeakMileage("full", 165)).toEqual({ low: 95, high: 115 })
  })

  it("marathon 3:29 (209 min) → 80–100 km/week (just below 3:30 boundary)", () => {
    expect(computeGoalPeakMileage("full", 209)).toEqual({ low: 80, high: 100 })
  })

  it("marathon 5:00 (300 min) → 45–60 km/week", () => {
    expect(computeGoalPeakMileage("full", 300)).toEqual({ low: 45, high: 60 })
  })

  it("half 1:45 (105 min) → 55–70 km/week", () => {
    expect(computeGoalPeakMileage("half", 105)).toEqual({ low: 55, high: 70 })
  })

  it("half 1:15 (75 min, sub-1:20) → 80–95 km/week", () => {
    expect(computeGoalPeakMileage("half", 75)).toEqual({ low: 80, high: 95 })
  })

  it("10k 0:42 (42 min) → 40–55 km/week", () => {
    expect(computeGoalPeakMileage("10k", 42)).toEqual({ low: 40, high: 55 })
  })

  it("10k 0:30 (30 min, sub-35) → 60–75 km/week", () => {
    expect(computeGoalPeakMileage("10k", 30)).toEqual({ low: 60, high: 75 })
  })

  it("5k 0:20 (20 min) → 45–55 km/week", () => {
    expect(computeGoalPeakMileage("5k", 20)).toEqual({ low: 45, high: 55 })
  })

  it("5k 0:15 (15 min, sub-18) → 55–65 km/week", () => {
    expect(computeGoalPeakMileage("5k", 15)).toEqual({ low: 55, high: 65 })
  })

  it("ultra returns null", () => {
    expect(computeGoalPeakMileage("ultra", 360)).toBeNull()
  })

  it("returns null for goalTotalMinutes <= 0", () => {
    expect(computeGoalPeakMileage("full", 0)).toBeNull()
    expect(computeGoalPeakMileage("full", -1)).toBeNull()
  })
})

// ─── computeTrainingStructure ─────────────────────────────────────────────

describe("computeTrainingStructure — full marathon, 3:20 goal (200 min), 1-3, 7 days", () => {
  const result = computeTrainingStructure(200, "full", 7, "40-60")
  it("runDaysPerWeek: 6", () => { expect(result.runDaysPerWeek).toBe(6) })
  it("restDaysPerWeek: 1", () => { expect(result.restDaysPerWeek).toBe(1) })
  it("maxQualitySessions: 2", () => { expect(result.maxQualitySessions).toBe(2) })
})

describe("computeTrainingStructure — full marathon, sub-2:30 (140 min), 3-or-more, 7 days", () => {
  const result = computeTrainingStructure(140, "full", 7, "80-plus")
  it("runDaysPerWeek: 7", () => { expect(result.runDaysPerWeek).toBe(7) })
  it("restDaysPerWeek: 0", () => { expect(result.restDaysPerWeek).toBe(0) })
  it("maxQualitySessions: 3", () => { expect(result.maxQualitySessions).toBe(3) })
})

describe("computeTrainingStructure — full marathon, 3:20 (200 min), 1-3, 5 selected days — selectedDaysCount clamp", () => {
  const result = computeTrainingStructure(200, "full", 5, "40-60")
  it("runDaysPerWeek: 5 (clamped to selectedDaysCount)", () => { expect(result.runDaysPerWeek).toBe(5) })
  it("restDaysPerWeek: 1 (not adjusted by clamp)", () => { expect(result.restDaysPerWeek).toBe(1) })
  it("maxQualitySessions: 2", () => { expect(result.maxQualitySessions).toBe(2) })
})

describe("computeTrainingStructure — half marathon, sub-1:15 (70 min), 1-3, 7 days", () => {
  const result = computeTrainingStructure(70, "half", 7, "60-80")
  it("runDaysPerWeek: 7", () => { expect(result.runDaysPerWeek).toBe(7) })
  it("restDaysPerWeek: 0", () => { expect(result.restDaysPerWeek).toBe(0) })
  it("maxQualitySessions: 3", () => { expect(result.maxQualitySessions).toBe(3) })
})

describe("computeTrainingStructure — 5k, 200 min, 1-3, 7 days — maxQuality+1, runDays cap", () => {
  const result = computeTrainingStructure(200, "5k", 7, "40-60")
  it("runDaysPerWeek: 6", () => { expect(result.runDaysPerWeek).toBe(6) })
  it("restDaysPerWeek: 1", () => { expect(result.restDaysPerWeek).toBe(1) })
  it("maxQualitySessions: 3 (5k bonus)", () => { expect(result.maxQualitySessions).toBe(3) })
})

describe("computeTrainingStructure — 5k, 140 min, 1-3, 7 days — run days capped from 7 to 6", () => {
  const result = computeTrainingStructure(140, "5k", 7, "80-plus")
  it("runDaysPerWeek: 6 (capped from 7)", () => { expect(result.runDaysPerWeek).toBe(6) })
  it("restDaysPerWeek: 1 (incremented due to cap)", () => { expect(result.restDaysPerWeek).toBe(1) })
  it("maxQualitySessions: 4 (3+1 bonus)", () => { expect(result.maxQualitySessions).toBe(4) })
})

describe("computeTrainingStructure — ultra (goalMinutes ignored, uses mileage fallback)", () => {
  const result = computeTrainingStructure(200, "ultra", 7, "60-80")
  it("runDaysPerWeek: 6", () => { expect(result.runDaysPerWeek).toBe(6) })
  it("restDaysPerWeek: 1", () => { expect(result.restDaysPerWeek).toBe(1) })
  it("maxQualitySessions: 2", () => { expect(result.maxQualitySessions).toBe(2) })
})

describe("computeTrainingStructure — full marathon, 4:30+ (360 min / 6h), 7 days — 4-day tier", () => {
  const result = computeTrainingStructure(360, "full", 7, "40-60")
  it("runDaysPerWeek: 4", () => { expect(result.runDaysPerWeek).toBe(4) })
  it("restDaysPerWeek: 3", () => { expect(result.restDaysPerWeek).toBe(3) })
  it("maxQualitySessions: 1", () => { expect(result.maxQualitySessions).toBe(1) })
})

describe("computeTrainingStructure — no goal time, full marathon, uses mileage fallback", () => {
  const result = computeTrainingStructure(null, "full", 7, "under-40")
  it("runDaysPerWeek: 5", () => { expect(result.runDaysPerWeek).toBe(5) })
  it("restDaysPerWeek: 2", () => { expect(result.restDaysPerWeek).toBe(2) })
  it("maxQualitySessions: 1", () => { expect(result.maxQualitySessions).toBe(1) })
})

// ─── computeLongRunTargets ─────────────────────────────────────────────────

describe("computeLongRunTargets — full marathon, null peakWeeklyKm (mid-range fallback)", () => {
  const result = computeLongRunTargets("full", null)
  it("peakLongRunKm: 35", () => { expect(result.peakLongRunKm).toBe(35) })
  it("recoveryRunMaxKm: 13", () => { expect(result.recoveryRunMaxKm).toBe(13) })
})

describe("computeLongRunTargets — full marathon, high=60 (< 65 bucket)", () => {
  const result = computeLongRunTargets("full", { low: 45, high: 60 })
  it("peakLongRunKm: 29", () => { expect(result.peakLongRunKm).toBe(29) })
  it("recoveryRunMaxKm: 11", () => { expect(result.recoveryRunMaxKm).toBe(11) })
})

describe("computeLongRunTargets — full marathon, high=80 (< 90 bucket)", () => {
  const result = computeLongRunTargets("full", { low: 65, high: 80 })
  it("peakLongRunKm: 35", () => { expect(result.peakLongRunKm).toBe(35) })
  it("recoveryRunMaxKm: 13", () => { expect(result.recoveryRunMaxKm).toBe(13) })
})

describe("computeLongRunTargets — full marathon, high=100 (< 116 bucket)", () => {
  const result = computeLongRunTargets("full", { low: 80, high: 100 })
  it("peakLongRunKm: 38", () => { expect(result.peakLongRunKm).toBe(38) })
  it("recoveryRunMaxKm: 16", () => { expect(result.recoveryRunMaxKm).toBe(16) })
})

describe("computeLongRunTargets — full marathon, high=130 (>= 116 bucket)", () => {
  const result = computeLongRunTargets("full", { low: 110, high: 130 })
  it("peakLongRunKm: 38", () => { expect(result.peakLongRunKm).toBe(38) })
  it("recoveryRunMaxKm: 16", () => { expect(result.recoveryRunMaxKm).toBe(16) })
})

describe("computeLongRunTargets — half marathon, null peakWeeklyKm (mid-range fallback)", () => {
  const result = computeLongRunTargets("half", null)
  it("peakLongRunKm: 22", () => { expect(result.peakLongRunKm).toBe(22) })
  it("recoveryRunMaxKm: 11", () => { expect(result.recoveryRunMaxKm).toBe(11) })
})

describe("computeLongRunTargets — half marathon, high=45 (< 50 bucket)", () => {
  const result = computeLongRunTargets("half", { low: 35, high: 45 })
  it("peakLongRunKm: 19", () => { expect(result.peakLongRunKm).toBe(19) })
  it("recoveryRunMaxKm: 9", () => { expect(result.recoveryRunMaxKm).toBe(9) })
})

describe("computeLongRunTargets — half marathon, high=65 (< 75 bucket)", () => {
  const result = computeLongRunTargets("half", { low: 55, high: 65 })
  it("peakLongRunKm: 22", () => { expect(result.peakLongRunKm).toBe(22) })
  it("recoveryRunMaxKm: 11", () => { expect(result.recoveryRunMaxKm).toBe(11) })
})

describe("computeLongRunTargets — half marathon, high=80 (>= 75 bucket)", () => {
  const result = computeLongRunTargets("half", { low: 65, high: 80 })
  it("peakLongRunKm: 26", () => { expect(result.peakLongRunKm).toBe(26) })
  it("recoveryRunMaxKm: 13", () => { expect(result.recoveryRunMaxKm).toBe(13) })
})

describe("computeLongRunTargets — 5k, null peakWeeklyKm (mid-range fallback)", () => {
  const result = computeLongRunTargets("5k", null)
  it("peakLongRunKm: 13", () => { expect(result.peakLongRunKm).toBe(13) })
  it("recoveryRunMaxKm: 8", () => { expect(result.recoveryRunMaxKm).toBe(8) })
})

describe("computeLongRunTargets — 5k, high=40 (< 45 bucket)", () => {
  const result = computeLongRunTargets("5k", { low: 30, high: 40 })
  it("peakLongRunKm: 11", () => { expect(result.peakLongRunKm).toBe(11) })
  it("recoveryRunMaxKm: 7", () => { expect(result.recoveryRunMaxKm).toBe(7) })
})

describe("computeLongRunTargets — 5k, high=55 (< 65 bucket)", () => {
  const result = computeLongRunTargets("5k", { low: 45, high: 55 })
  it("peakLongRunKm: 13", () => { expect(result.peakLongRunKm).toBe(13) })
  it("recoveryRunMaxKm: 8", () => { expect(result.recoveryRunMaxKm).toBe(8) })
})

describe("computeLongRunTargets — 10k, high=70 (>= 65 bucket)", () => {
  const result = computeLongRunTargets("10k", { low: 60, high: 70 })
  it("peakLongRunKm: 16", () => { expect(result.peakLongRunKm).toBe(16) })
  it("recoveryRunMaxKm: 10", () => { expect(result.recoveryRunMaxKm).toBe(10) })
})

describe("computeLongRunTargets — ultra (fixed values, peakWeeklyKm ignored)", () => {
  const result = computeLongRunTargets("ultra", { low: 50, high: 100 })
  it("peakLongRunKm: 32", () => { expect(result.peakLongRunKm).toBe(32) })
  it("recoveryRunMaxKm: 14", () => { expect(result.recoveryRunMaxKm).toBe(14) })
})

describe("computeLongRunTargets — ultra, null peakWeeklyKm", () => {
  const result = computeLongRunTargets("ultra", null)
  it("peakLongRunKm: 32", () => { expect(result.peakLongRunKm).toBe(32) })
  it("recoveryRunMaxKm: 14", () => { expect(result.recoveryRunMaxKm).toBe(14) })
})

describe("computeLongRunTargets — unknown distance, null peakWeeklyKm (unknown fallback)", () => {
  const result = computeLongRunTargets("obstacle-course", null)
  it("peakLongRunKm: 29", () => { expect(result.peakLongRunKm).toBe(29) })
  it("recoveryRunMaxKm: 11", () => { expect(result.recoveryRunMaxKm).toBe(11) })
})
