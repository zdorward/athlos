import { describe, it, expect } from "vitest"
import { calculatePaceZones, calculateRawGoalPace } from "./pace-calculator"

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


