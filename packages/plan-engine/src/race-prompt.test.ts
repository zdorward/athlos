import { describe, it, expect } from "vitest"
import { peakStrengthDay } from "./race-prompt"

describe("peakStrengthDay", () => {
  it("returns null for empty array", () => {
    expect(peakStrengthDay([], "sun")).toBeNull()
  })

  it("returns the only day when array has one element", () => {
    expect(peakStrengthDay(["wed"], "sun")).toBe("wed")
  })

  it("returns the day furthest from the long run day (sun long run)", () => {
    // sun=0. wed: |3-0|=3, min(3,4)=3. sat: |6-0|=6, min(6,1)=1. → wed wins
    expect(peakStrengthDay(["wed", "sat"], "sun")).toBe("wed")
  })

  it("handles circular distance across week boundary", () => {
    // fri long run (5). sun: |0-5|=5, min(5,2)=2. mon: |1-5|=4, min(4,3)=3. → mon wins
    expect(peakStrengthDay(["sun", "mon"], "fri")).toBe("mon")
  })

  it("returns the furthest day from 3 options", () => {
    // sun long run. mon: min(1,6)=1. wed: min(3,4)=3. fri: min(5,2)=2. → wed wins
    expect(peakStrengthDay(["mon", "wed", "fri"], "sun")).toBe("wed")
  })
})
