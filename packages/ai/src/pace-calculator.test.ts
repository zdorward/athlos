import { describe, it, expect } from "vitest"
import { calculatePaceZones, computePhases, computeGoalPeakMileage, calculateRawGoalPace } from "./pace-calculator"

function loSec(zone: string): number {
  const [m, s] = zone.split("–")[0]!.split(":").map(Number)
  return m! * 60 + s!
}

// ─── calculatePaceZones ────────────────────────────────────────────────────

describe("calculatePaceZones — recent race, active", () => {
  // 10K in 47:30 → T_5k = 2850 × (5/10)^1.06 ≈ 1367s → ref = 273.4 s/km
  const zones = calculatePaceZones(
    { hours: 0, minutes: 47, seconds: 30, distance: "10k", context: "active" },
    "recent-race"
  )

  it("returns non-null for valid input", () => {
    expect(zones).not.toBeNull()
  })

  it("sets source to recent-race", () => {
    expect(zones!.source).toBe("recent-race")
  })

  it("vo2max zone: 4:28–4:39/km", () => {
    expect(zones!.vo2max).toBe("4:28–4:39/km")
  })

  it("threshold zone: 4:50–5:01/km", () => {
    expect(zones!.threshold).toBe("4:50–5:01/km")
  })

  it("mp zone: 5:09–5:28/km", () => {
    expect(zones!.mp).toBe("5:09–5:28/km")
  })

  it("mediumLong zone: 5:28–5:42/km", () => {
    expect(zones!.mediumLong).toBe("5:28–5:42/km")
  })

  it("longRun zone: 5:42–6:04/km", () => {
    expect(zones!.longRun).toBe("5:42–6:04/km")
  })

  it("easy zone: 6:06–6:36/km", () => {
    expect(zones!.easy).toBe("6:06–6:36/km")
  })
})

describe("calculatePaceZones — context multipliers", () => {
  it("short-break applies ×1.05 to all zones", () => {
    // ref = 273.4 × 1.05 = 287.1 s/km
    // vo2max fast = 287.1 × 0.98 = 281.4 → 281s → 4:41
    const zones = calculatePaceZones(
      { hours: 0, minutes: 47, seconds: 30, distance: "10k", context: "short-break" },
      "recent-race"
    )!
    expect(zones.vo2max).toBe("4:41–4:53/km")
  })

  it("long-break applies ×1.12 to all zones", () => {
    // ref = 273.4 × 1.12 = 306.2 s/km
    // easy slow = 306.2 × 1.45 = 444.0 → 444s → 7:24
    const zones = calculatePaceZones(
      { hours: 0, minutes: 47, seconds: 30, distance: "10k", context: "long-break" },
      "recent-race"
    )!
    expect(zones.easy).toMatch(/–7:24\/km$/)
  })

  it("defaults to active when context is undefined", () => {
    const withContext = calculatePaceZones(
      { hours: 0, minutes: 47, seconds: 30, distance: "10k", context: "active" },
      "recent-race"
    )
    const withoutContext = calculatePaceZones(
      { hours: 0, minutes: 47, seconds: 30, distance: "10k" },
      "recent-race"
    )
    expect(withContext!.vo2max).toBe(withoutContext!.vo2max)
  })
})

describe("calculatePaceZones — goal time", () => {
  it("applies 5% buffer and sets source to goal-time", () => {
    // 3:30:00 marathon → T with 5% buffer = 13230s
    // T_5k = 13230 × (5/42.195)^1.06 ≈ 1379.4s → ref ≈ 275.88 s/km (Node.js verified)
    // vo2max fast = Math.round(275.88 × 0.98) = Math.round(270.36) = 270 → 4:30
    // vo2max slow = Math.round(275.88 × 1.02) = Math.round(281.40) = 281 → 4:41
    const zones = calculatePaceZones(
      { hours: 3, minutes: 30, seconds: 0, distance: "full" },
      "goal-time"
    )!
    expect(zones.source).toBe("goal-time")
    expect(zones.vo2max).toBe("4:30–4:41/km")
  })

  it("does not apply context multiplier for goal-time source", () => {
    // context field ignored when source is goal-time
    const with_ctx = calculatePaceZones(
      { hours: 3, minutes: 30, seconds: 0, distance: "full", context: "long-break" },
      "goal-time"
    )!
    const without_ctx = calculatePaceZones(
      { hours: 3, minutes: 30, seconds: 0, distance: "full" },
      "goal-time"
    )!
    expect(with_ctx.vo2max).toBe(without_ctx.vo2max)
  })
})

describe("calculatePaceZones — invalid input", () => {
  it("returns null for zero time", () => {
    const result = calculatePaceZones(
      { hours: 0, minutes: 0, seconds: 0, distance: "10k" },
      "recent-race"
    )
    expect(result).toBeNull()
  })

  it("returns null for impossibly fast pace (< 2:00/km)", () => {
    // 10K in 0:10:00 = 1:00/km — physically impossible
    const result = calculatePaceZones(
      { hours: 0, minutes: 10, seconds: 0, distance: "10k" },
      "recent-race"
    )
    expect(result).toBeNull()
  })
})

// ─── computePhases ────────────────────────────────────────────────────────

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

  it("matches spec example: GF=6, Base=8, Build=7, Peak=3, Taper=4", () => {
    expect(phases[0]).toEqual({ name: "General Fitness", startWeek: 1, endWeek: 6 })
    expect(phases[1]).toEqual({ name: "Base", startWeek: 7, endWeek: 14 })
    expect(phases[2]).toEqual({ name: "Build", startWeek: 15, endWeek: 21 })
    expect(phases[3]).toEqual({ name: "Peak", startWeek: 22, endWeek: 24 })
    expect(phases[4]).toEqual({ name: "Taper", startWeek: 25, endWeek: 28 })
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

// ─── calculateRawGoalPace ────────────────────────────────────────────────────

describe("calculateRawGoalPace", () => {
  it("3:30 marathon — returns raw mp zone (no 5% buffer)", () => {
    // total = 12600s, no buffer
    // t5k = 12600 * (5/42.195)^1.06 = 12600 * 0.104263 = 1313.71s → ref = 262.74 s/km
    // mp lower: round(262.74 * 1.13) = round(296.90) = 297 → 4:57
    // mp upper: round(262.74 * 1.20) = round(315.29) = 315 → 5:15
    const result = calculateRawGoalPace({ hours: 3, minutes: 30, seconds: 0, distance: "full" })
    expect(result).toBe("4:57–5:15/km")
  })

  it("3:30 marathon raw goal pace is faster than goal-time calculatePaceZones mp (which has 5% buffer)", () => {
    const buffered = calculatePaceZones({ hours: 3, minutes: 30, seconds: 0, distance: "full" }, "goal-time")!
    const raw = calculateRawGoalPace({ hours: 3, minutes: 30, seconds: 0, distance: "full" })!
    expect(loSec(raw)).toBeLessThan(loSec(buffered.mp))
  })

  it("returns null for zero time", () => {
    expect(calculateRawGoalPace({ hours: 0, minutes: 0, seconds: 0, distance: "full" })).toBeNull()
  })

  it("returns null for impossibly fast pace", () => {
    expect(calculateRawGoalPace({ hours: 0, minutes: 10, seconds: 0, distance: "10k" })).toBeNull()
  })

  it("works for half marathon", () => {
    const result = calculateRawGoalPace({ hours: 1, minutes: 45, seconds: 0, distance: "half" })
    expect(result).not.toBeNull()
    expect(result).toMatch(/^\d+:\d{2}–\d+:\d{2}\/km$/)
  })

  it("seconds parameter affects output — faster goal time produces faster pace", () => {
    const slower = calculateRawGoalPace({ hours: 3, minutes: 30, seconds: 0, distance: "full" })!
    const faster = calculateRawGoalPace({ hours: 3, minutes: 29, seconds: 30, distance: "full" })!
    // 3:29:30 is faster than 3:30:00, so raw pace lower bound should be fewer seconds
    expect(loSec(faster)).toBeLessThan(loSec(slower))
  })
})

describe("calculatePaceZones — slow runner (no zone overlap)", () => {
  // 5K in 35:00 → ref = 2100/5 = 420 s/km (active, recent-race, no Riegel conversion needed)
  // Actually: T_5k = 2100 * (5/5)^1.06 = 2100 → ref = 420
  // longRun upper: Math.round(420 * 1.33) = Math.round(558.6) = 559 → 9:19
  // easy lower:    Math.round(420 * 1.34) = Math.round(562.8) = 563 → 9:23
  // Verify no zone string overlap between longRun and easy
  const zones = calculatePaceZones(
    { hours: 0, minutes: 35, seconds: 0, distance: "5k", context: "active" },
    "recent-race"
  )!

  it("returns non-null", () => {
    expect(zones).not.toBeNull()
  })

  it("longRun and easy zones do not overlap", () => {
    // Parse the upper bound of longRun and lower bound of easy
    const longRunUpper = zones.longRun.split("–")[1]!.replace("/km", "")
    const easyLower = zones.easy.split("–")[0]!
    // Verify easy lower pace is slower (more seconds) than longRun upper
    function toSec(pace: string): number {
      const [m, s] = pace.split(":").map(Number)
      return m! * 60 + s!
    }
    expect(toSec(easyLower)).toBeGreaterThanOrEqual(toSec(longRunUpper))
  })
})
