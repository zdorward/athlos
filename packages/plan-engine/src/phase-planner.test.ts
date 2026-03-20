import { describe, it, expect } from "vitest"
import { computePhases } from "./phase-planner"

describe("computePhases — 28 week full marathon (5-phase)", () => {
  const phases = computePhases(28, "full")

  it("produces 5 phases", () => {
    expect(phases).toHaveLength(5)
  })

  it("phase names are correct", () => {
    expect(phases.map(p => p.name)).toEqual([
      "General Fitness", "Base", "Build", "Peak", "Taper"
    ])
  })

  it("weeks are contiguous and sum to 28", () => {
    expect(phases[0]!.startWeek).toBe(1)
    expect(phases[4]!.endWeek).toBe(28)
    for (let i = 1; i < phases.length; i++) {
      expect(phases[i]!.startWeek).toBe(phases[i - 1]!.endWeek + 1)
    }
  })

  it("matches expected: GF=5, Base=8, Build=8, Peak=4, Taper=3", () => {
    expect(phases[0]).toEqual({ name: "General Fitness", startWeek: 1, endWeek: 5 })
    expect(phases[1]).toEqual({ name: "Base", startWeek: 6, endWeek: 13 })
    expect(phases[2]).toEqual({ name: "Build", startWeek: 14, endWeek: 21 })
    expect(phases[3]).toEqual({ name: "Peak", startWeek: 22, endWeek: 25 })
    expect(phases[4]).toEqual({ name: "Taper", startWeek: 26, endWeek: 28 })
  })
})

describe("computePhases — 16 week half marathon (4-phase)", () => {
  const phases = computePhases(16, "half")

  it("produces 4 phases (Base, Build, Peak, Taper)", () => {
    expect(phases.map(p => p.name)).toEqual(["Base", "Build", "Peak", "Taper"])
  })

  it("weeks sum to 16", () => {
    expect(phases[0]!.startWeek).toBe(1)
    expect(phases[phases.length - 1]!.endWeek).toBe(16)
    for (let i = 1; i < phases.length; i++) {
      expect(phases[i]!.startWeek).toBe(phases[i - 1]!.endWeek + 1)
    }
  })

  it("taper is at least 3 weeks for half", () => {
    const taper = phases.find(p => p.name === "Taper")!
    expect(taper.endWeek - taper.startWeek + 1).toBeGreaterThanOrEqual(3)
  })

  it("peak is at least 3 weeks for half", () => {
    const peak = phases.find(p => p.name === "Peak")!
    expect(peak.endWeek - peak.startWeek + 1).toBeGreaterThanOrEqual(3)
  })
})

describe("computePhases — 4 week 5K (very short)", () => {
  const phases = computePhases(4, "5k")

  it("weeks sum to 4", () => {
    const total = phases.reduce((s, p) => s + p.endWeek - p.startWeek + 1, 0)
    expect(total).toBe(4)
  })

  it("taper is at least 2 weeks for 5K", () => {
    const taper = phases.find(p => p.name === "Taper")!
    expect(taper.endWeek - taper.startWeek + 1).toBeGreaterThanOrEqual(2)
  })

  it("starts at week 1", () => {
    expect(phases[0]!.startWeek).toBe(1)
  })
})

describe("computePhases — 22 week full marathon: peak >= 3 weeks", () => {
  const phases = computePhases(22, "full")

  it("produces 5 phases", () => {
    expect(phases.map(p => p.name)).toEqual([
      "General Fitness", "Base", "Build", "Peak", "Taper"
    ])
  })

  it("weeks sum to 22", () => {
    const total = phases.reduce((s, p) => s + p.endWeek - p.startWeek + 1, 0)
    expect(total).toBe(22)
  })

  it("peak is at least 4 weeks for full marathon", () => {
    const peak = phases.find(p => p.name === "Peak")!
    expect(peak.endWeek - peak.startWeek + 1).toBeGreaterThanOrEqual(4)
  })

  it("taper is exactly 3 weeks", () => {
    const taper = phases.find(p => p.name === "Taper")!
    expect(taper.endWeek - taper.startWeek + 1).toBe(3)
  })

  it("matches expected: GF=1, Base=7, Build=7, Peak=4, Taper=3", () => {
    expect(phases[0]).toEqual({ name: "General Fitness", startWeek: 1, endWeek: 1 })
    expect(phases[1]).toEqual({ name: "Base", startWeek: 2, endWeek: 8 })
    expect(phases[2]).toEqual({ name: "Build", startWeek: 9, endWeek: 15 })
    expect(phases[3]).toEqual({ name: "Peak", startWeek: 16, endWeek: 19 })
    expect(phases[4]).toEqual({ name: "Taper", startWeek: 20, endWeek: 22 })
  })
})

describe("computePhases — exactly 21 weeks triggers 5-phase", () => {
  const phases = computePhases(21, "full")

  it("produces 5 phases", () => {
    expect(phases.some(p => p.name === "General Fitness")).toBe(true)
  })

  it("weeks sum to 21", () => {
    const total = phases.reduce((s, p) => s + p.endWeek - p.startWeek + 1, 0)
    expect(total).toBe(21)
  })
})

describe("computePhases — exactly 20 weeks (last 4-phase case)", () => {
  const phases = computePhases(20, "half")

  it("produces 4 phases (not 5)", () => {
    expect(phases.some(p => p.name === "General Fitness")).toBe(false)
    expect(phases.map(p => p.name)).toEqual(["Base", "Build", "Peak", "Taper"])
  })

  it("weeks sum to 20", () => {
    const total = phases.reduce((s, p) => s + p.endWeek - p.startWeek + 1, 0)
    expect(total).toBe(20)
  })

  it("taper is at least 3 weeks for half", () => {
    const taper = phases.find(p => p.name === "Taper")!
    expect(taper.endWeek - taper.startWeek + 1).toBeGreaterThanOrEqual(3)
  })
})

describe("computePhases — 29 week full marathon: GF fills gap", () => {
  it("25-40: GF=4, Base=9, Build=9, Peak=4, Taper=3", () => {
    const phases = computePhases(29, "full", "25-40")
    expect(phases[0]).toEqual({ name: "General Fitness", startWeek: 1, endWeek: 4 })
    expect(phases[1]).toEqual({ name: "Base", startWeek: 5, endWeek: 13 })
    expect(phases[2]).toEqual({ name: "Build", startWeek: 14, endWeek: 22 })
    expect(phases[3]).toEqual({ name: "Peak", startWeek: 23, endWeek: 26 })
    expect(phases[4]).toEqual({ name: "Taper", startWeek: 27, endWeek: 29 })
  })

  it("80-plus: GF cap does not bite at 29 weeks — same layout as 25-40", () => {
    const phases = computePhases(29, "full", "80-plus")
    expect(phases[0]).toEqual({ name: "General Fitness", startWeek: 1, endWeek: 4 })
    expect(phases[1]).toEqual({ name: "Base", startWeek: 5, endWeek: 13 })
    expect(phases[2]).toEqual({ name: "Build", startWeek: 14, endWeek: 22 })
    expect(phases[3]).toEqual({ name: "Peak", startWeek: 23, endWeek: 26 })
    expect(phases[4]).toEqual({ name: "Taper", startWeek: 27, endWeek: 29 })
  })
})

describe("computePhases — 52 week full marathon: GF capped by mileage range", () => {
  it("25-40: GF is capped at 12 weeks", () => {
    const phases = computePhases(52, "full", "25-40")
    const gf = phases.find(p => p.name === "General Fitness")!
    expect(gf.endWeek - gf.startWeek + 1).toBe(12)
  })

  it("80-plus: GF is capped at 6 weeks", () => {
    const phases = computePhases(52, "full", "80-plus")
    const gf = phases.find(p => p.name === "General Fitness")!
    expect(gf.endWeek - gf.startWeek + 1).toBe(6)
  })
})

describe("computePhases — full marathon peakMin is 4 weeks", () => {
  it("21-week full: peak >= 4", () => {
    const phases = computePhases(21, "full")
    const peak = phases.find(p => p.name === "Peak")!
    expect(peak.endWeek - peak.startWeek + 1).toBeGreaterThanOrEqual(4)
  })
})
