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
  it("Sunday long run, count 2 → wed, thu (both dist 3 from Sunday)", () => {
    expect(recommendStrengthDays("sun", 2)).toEqual(["wed", "thu"])
  })
  it("Saturday long run, count 2 → tue, wed (both dist 3 from Saturday)", () => {
    expect(recommendStrengthDays("sat", 2)).toEqual(["tue", "wed"])
  })
  it("Monday long run, count 1 → thu (dist 3; tiebreak: Thu idx=4 < Fri idx=5)", () => {
    // Mon idx=1. Thu: min(|4-1|,7-3)=min(3,4)=3. Fri: min(|5-1|,7-4)=min(4,3)=3.
    expect(recommendStrengthDays("mon", 1)).toEqual(["thu"])
  })
  it("Wednesday long run, count 2 → sun, sat (both dist 3 from Wed)", () => {
    // Wed idx=3. Sun: min(|0-3|,7-3)=min(3,4)=3. Sat: min(|6-3|,7-3)=min(3,4)=3. Sun idx=0 < Sat idx=6
    expect(recommendStrengthDays("wed", 2)).toEqual(["sun", "sat"])
  })
  it("count 0 returns empty array", () => {
    expect(recommendStrengthDays("sun", 0)).toEqual([])
  })
})
