import { describe, it, expect } from "vitest"
import { computeConstraints } from "./constraints"

const base = {
  distance: "full" as const,
  weeklyMileageRange: "40-60" as const,
  totalWeeks: 20,
  goalMinutes: 210,       // 3:30 marathon
  selectedDaysCount: 5,
  isFirstAtDistance: false,
  includeStrength: true,
}

describe("computeConstraints", () => {
  describe("longRunMaxFraction", () => {
    it("is 0.40 for full marathon", () => {
      const c = computeConstraints({ ...base, distance: "full" })
      expect(c.longRunMaxFraction).toBe(0.40)
    })

    it("is 0.38 for half marathon", () => {
      const c = computeConstraints({ ...base, distance: "half" })
      expect(c.longRunMaxFraction).toBe(0.38)
    })
  })

  describe("first-timer constraints", () => {
    it("sets maxQualitySessions to 1 regardless of goal time", () => {
      const c = computeConstraints({ ...base, isFirstAtDistance: true, goalMinutes: 150 })
      expect(c.maxQualitySessions).toBe(1)
    })

    it("sets allowIntervals to false", () => {
      const c = computeConstraints({ ...base, isFirstAtDistance: true })
      expect(c.allowIntervals).toBe(false)
    })

    it("sets allowIntervals to true for experienced runner", () => {
      const c = computeConstraints({ ...base, isFirstAtDistance: false })
      expect(c.allowIntervals).toBe(true)
    })

    it("uses slower ramp rate (0.08) for first-timers", () => {
      const c = computeConstraints({ ...base, isFirstAtDistance: true })
      expect(c.rampRatePerWeek).toBe(0.08)
    })

    it("uses standard ramp rate (0.10) for experienced runners", () => {
      const c = computeConstraints({ ...base, isFirstAtDistance: false })
      expect(c.rampRatePerWeek).toBe(0.10)
    })
  })

  describe("minimumPlanWeeks", () => {
    it("is 16 for first-timer full marathon", () => {
      const c = computeConstraints({ ...base, isFirstAtDistance: true, distance: "full" })
      expect(c.minimumPlanWeeks).toBe(16)
    })

    it("is 12 for first-timer half marathon", () => {
      const c = computeConstraints({ ...base, isFirstAtDistance: true, distance: "half" })
      expect(c.minimumPlanWeeks).toBe(12)
    })

    it("is 8 for experienced runner", () => {
      const c = computeConstraints({ ...base, isFirstAtDistance: false })
      expect(c.minimumPlanWeeks).toBe(8)
    })
  })

  describe("peakWeeklyKm — achievable clamping", () => {
    it("clamps to achievable peak when ramp cannot reach aspirational", () => {
      // under-40 bracket starts at 30 km/week, 0.10 ramp, 5 pre-taper weeks
      // achievable = 30 * 1.1^5 ≈ 48.3 km — far below goal-time-derived ~80 km
      const c = computeConstraints({
        ...base,
        weeklyMileageRange: "under-40",
        totalWeeks: 8,
        goalMinutes: 210,         // would prescribe 80–100 km peak
        isFirstAtDistance: false,
      })
      const achievable = 30 * Math.pow(1.10, 5)
      expect(c.peakWeeklyKm).toBeCloseTo(achievable, 0)
    })

    it("does not clamp when plan is long enough to reach goal peak", () => {
      // 40-60 bracket starts 40 km, 0.10 ramp, 17 pre-taper weeks (20 - 3)
      // achievable = 40 * 1.1^17 ≈ 194 — above aspirational peak
      // computeGoalPeakMileage("full", 209) = { low: 80, high: 100 } (goalMinutes < 210 bucket)
      const c = computeConstraints({
        ...base,
        weeklyMileageRange: "40-60",
        totalWeeks: 20,
        goalMinutes: 209,   // < 210 boundary → { low: 80, high: 100 }
      })
      expect(c.peakWeeklyKm).toBe(100)   // aspirational high, not clamped
    })
  })

  describe("includeStrength", () => {
    it("passes through false", () => {
      const c = computeConstraints({ ...base, includeStrength: false })
      expect(c.includeStrength).toBe(false)
    })

    it("passes through true", () => {
      const c = computeConstraints({ ...base, includeStrength: true })
      expect(c.includeStrength).toBe(true)
    })
  })

  describe("feasibilityWarning", () => {
    it("warns when totalWeeks < minimumPlanWeeks for first-timer full marathon", () => {
      const c = computeConstraints({
        ...base,
        isFirstAtDistance: true,
        totalWeeks: 10,   // below 16
      })
      expect(c.feasibilityWarning).toMatch(/16 weeks/)
    })

    it("warns when achievable long run is below 26 km for full marathon", () => {
      // under-40 starts 30 km, 0.08 first-timer ramp, 5 pre-taper weeks
      // achievable = 30 * 1.08^5 ≈ 44 km; long run = 44 * 0.40 ≈ 17.6 km < 26
      const c = computeConstraints({
        ...base,
        isFirstAtDistance: true,
        weeklyMileageRange: "under-40",
        totalWeeks: 8,
      })
      expect(c.feasibilityWarning).toMatch(/Long run/)
    })

    it("returns null for a sound plan", () => {
      // 40-60 bracket, experienced, 20 weeks — easily achievable
      const c = computeConstraints({ ...base })
      expect(c.feasibilityWarning).toBeNull()
    })

    it("can produce both warnings simultaneously", () => {
      const c = computeConstraints({
        ...base,
        isFirstAtDistance: true,
        weeklyMileageRange: "under-40",
        totalWeeks: 6,  // below 16 AND too short for long runs
      })
      expect(c.feasibilityWarning).toContain("weeks")
      expect(c.feasibilityWarning).toContain("Long run")
    })
  })
})
