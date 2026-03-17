import { describe, it, expect } from "vitest"
import { recommendStrengthCount, recommendStrengthDays } from "./strength-recommendation"

describe("recommendStrengthCount", () => {
  describe("with peakMileageHigh available", () => {
    it("returns 1 when peakMileageHigh >= 95", () => {
      expect(recommendStrengthCount(95, "40-60")).toBe(1)
    })
    it("returns 1 when peakMileageHigh is above 95", () => {
      expect(recommendStrengthCount(130, "80-plus")).toBe(1)
    })
    it("returns 2 when peakMileageHigh < 95", () => {
      expect(recommendStrengthCount(94, "40-60")).toBe(2)
    })
    it("returns 2 when peakMileageHigh is low", () => {
      expect(recommendStrengthCount(60, "under-40")).toBe(2)
    })
    it("boundary: exactly 95 returns 1", () => {
      expect(recommendStrengthCount(95, "60-80")).toBe(1)
    })
    it("boundary: 94 returns 2", () => {
      expect(recommendStrengthCount(94, "60-80")).toBe(2)
    })
  })

  describe("with peakMileageHigh null (mileage range fallback)", () => {
    it("returns 1 for 80-plus", () => {
      expect(recommendStrengthCount(null, "80-plus")).toBe(1)
    })
    it("returns 2 for 60-80", () => {
      expect(recommendStrengthCount(null, "60-80")).toBe(2)
    })
    it("returns 2 for 40-60", () => {
      expect(recommendStrengthCount(null, "40-60")).toBe(2)
    })
    it("returns 2 for under-40", () => {
      expect(recommendStrengthCount(null, "under-40")).toBe(2)
    })
  })
})

describe("recommendStrengthDays", () => {
  it("Sunday long run, count 1 → wed (highest dist, lower index wins tiebreak)", () => {
    expect(recommendStrengthDays("sun", 1)).toEqual(["wed"])
  })
  it("Sunday long run, count 2 → wed, fri (non-consecutive; thu skipped as adjacent to wed)", () => {
    expect(recommendStrengthDays("sun", 2)).toEqual(["wed", "fri"])
  })
  it("Saturday long run, count 2 → tue, thu (non-consecutive; wed skipped as adjacent to tue)", () => {
    expect(recommendStrengthDays("sat", 2)).toEqual(["tue", "thu"])
  })
  it("Monday long run, count 1 → thu (dist 3; tiebreak: Thu idx=4 < Fri idx=5)", () => {
    // Mon idx=1. Thu: min(|4-1|,7-3)=min(3,4)=3. Fri: min(|5-1|,7-4)=min(4,3)=3.
    expect(recommendStrengthDays("mon", 1)).toEqual(["thu"])
  })
  it("Wednesday long run, count 2 → sun, fri (non-consecutive; sat skipped as adjacent to sun)", () => {
    // Wed idx=3. Sorted: sun(3), sat(3), mon(2), fri(2),...
    // Sun and Sat are circularly adjacent (min(6,1)=1), so Sat is skipped.
    expect(recommendStrengthDays("wed", 2)).toEqual(["sun", "fri"])
  })
  it("count 0 returns empty array", () => {
    expect(recommendStrengthDays("sun", 0)).toEqual([])
  })

  describe("adjacency constraint — no back-to-back days", () => {
    it("result never contains two consecutive days (sun long run, count 2)", () => {
      const result = recommendStrengthDays("sun", 2)
      expect(result).toHaveLength(2)
      const [a, b] = result as [string, string]
      const DAY_INDEX: Record<string, number> = { sun:0, mon:1, tue:2, wed:3, thu:4, fri:5, sat:6 }
      const diff = Math.abs(DAY_INDEX[a]! - DAY_INDEX[b]!)
      const circDist = Math.min(diff, 7 - diff)
      expect(circDist).toBeGreaterThan(1)
    })
    it("result never contains two consecutive days (sat long run, count 2)", () => {
      const result = recommendStrengthDays("sat", 2)
      expect(result).toHaveLength(2)
      const [a, b] = result as [string, string]
      const DAY_INDEX: Record<string, number> = { sun:0, mon:1, tue:2, wed:3, thu:4, fri:5, sat:6 }
      const diff = Math.abs(DAY_INDEX[a]! - DAY_INDEX[b]!)
      const circDist = Math.min(diff, 7 - diff)
      expect(circDist).toBeGreaterThan(1)
    })
    it("result never contains two consecutive days (wed long run, count 2)", () => {
      const result = recommendStrengthDays("wed", 2)
      expect(result).toHaveLength(2)
      const [a, b] = result as [string, string]
      const DAY_INDEX: Record<string, number> = { sun:0, mon:1, tue:2, wed:3, thu:4, fri:5, sat:6 }
      const diff = Math.abs(DAY_INDEX[a]! - DAY_INDEX[b]!)
      const circDist = Math.min(diff, 7 - diff)
      expect(circDist).toBeGreaterThan(1)
    })
  })
})
