import { describe, it, expect } from "vitest"
import { POST } from "./route"
import { NextRequest } from "next/server"

function makeRequest(body: object): NextRequest {
  return new NextRequest("http://localhost/api/generate-plan", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

const validInput = {
  goal: "race",
  race: { name: "Test Marathon", date: "2027-04-01", distance: "full", city: "Test City" },
  goalTime: { hours: 3, minutes: 30, seconds: 0 },
  selectedDays: ["mon", "wed", "fri", "sat"],
  longRunDay: "sat",
  units: "km",
  weeklyMileageRange: "40-60",
  isFirstAtDistance: false,
  includeStrength: true,
}

describe("POST /api/generate-plan", () => {
  it("returns valid plan shape for a full marathon", async () => {
    const res = await POST(makeRequest(validInput))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.days).toBeInstanceOf(Array)
    expect(body.days.length).toBeGreaterThan(0)
    expect(typeof body.totalWeeks).toBe("number")
    expect(typeof body.totalKm).toBe("number")
    expect(typeof body.peakWeekKm).toBe("number")
    expect(body.phases).toBeInstanceOf(Array)
    expect(body.totalWeeks).toBeGreaterThan(0)
    expect(body.totalKm).toBeGreaterThan(0)
    expect(body.peakWeekKm).toBeGreaterThan(0)
    expect(body.phases.length).toBeGreaterThan(0)
  })

  it("days contain only valid WorkoutTypes", async () => {
    const VALID_TYPES = new Set([
      "easy",
      "long",
      "progression",
      "mp",
      "tempo",
      "intervals",
      "rest",
      "race",
      "strength",
      "shakeout",
    ])
    const res = await POST(makeRequest(validInput))
    const body = await res.json()
    body.days.forEach((d: { type: string }) => {
      expect(VALID_TYPES.has(d.type)).toBe(true)
    })
  })

  it("no WorkoutDay has a description field", async () => {
    const res = await POST(makeRequest(validInput))
    const body = await res.json()
    body.days.forEach((d: Record<string, unknown>) => {
      expect(d["description"]).toBeUndefined()
    })
  })

  it("returns 400 when selectedDays has fewer than 2 entries", async () => {
    const res = await POST(
      makeRequest({ ...validInput, selectedDays: ["sat"], longRunDay: "sat" }),
    )
    expect(res.status).toBe(400)
  })

  it("returns 400 when longRunDay is not in selectedDays", async () => {
    const res = await POST(makeRequest({ ...validInput, longRunDay: "sun" }))
    expect(res.status).toBe(400)
  })

  // "80-plus" requires >=80 km/week; a 6h marathon goal time implies ~45 km/week peak → 400
  it("returns 400 when weeklyMileageRange lower bound exceeds peakWeeklyKm", async () => {
    const res = await POST(
      makeRequest({
        ...validInput,
        weeklyMileageRange: "80-plus",
        goalTime: { hours: 6, minutes: 0, seconds: 0 },
      }),
    )
    expect(res.status).toBe(400)
  })

  it("deterministic: identical inputs return identical days", async () => {
    const [a, b] = await Promise.all([
      POST(makeRequest(validInput)).then((r) => r.json()),
      POST(makeRequest(validInput)).then((r) => r.json()),
    ])
    expect(a.days).toEqual(b.days)
  })

  it("long run always falls on longRunDay (saturday)", async () => {
    const res = await POST(makeRequest(validInput))
    const body = await res.json()
    const longRuns = body.days.filter((d: { type: string }) => d.type === "long")
    longRuns.forEach((d: { date: string }) => {
      // Saturday = day 6 in UTC
      expect(new Date(d.date + "T00:00:00Z").getUTCDay()).toBe(6)
    })
  })
})

describe("POST /api/generate-plan — bridge runs and planStartDate", () => {
  it("returns planStartDate as a valid ISO date string", async () => {
    const res = await POST(makeRequest(validInput))
    const body = await res.json()
    expect(typeof body.planStartDate).toBe("string")
    expect(body.planStartDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it("planStartDate is a Monday", async () => {
    const res = await POST(makeRequest(validInput))
    const body = await res.json()
    const dow = new Date(body.planStartDate + "T00:00:00Z").getUTCDay()
    expect(dow).toBe(1) // 1 = Monday
  })

  it("when today is provided, days before planStartDate are bridge days", async () => {
    // today = 2026-03-18 (Wednesday); plan starts Monday 2026-03-24
    const input = {
      ...validInput,
      today: "2026-03-18",
      selectedDays: ["wed", "sat"],
      longRunDay: "sat",
    }
    const res = await POST(makeRequest(input))
    const body = await res.json()
    const bridgeDays = body.days.filter((d: { date: string }) => d.date < body.planStartDate)
    expect(bridgeDays.length).toBeGreaterThan(0)
    // All dates before planStartDate are in the Wed–Sun gap
    bridgeDays.forEach((d: { date: string }) => {
      expect(d.date >= "2026-03-18").toBe(true)
      expect(d.date < body.planStartDate).toBe(true)
    })
  })

  it("when today equals planStartDate (Monday), no bridge days are prepended", async () => {
    // today = 2026-03-23 (Monday) — plan also starts this Monday → no gap
    const input = { ...validInput, today: "2026-03-23" }
    const res = await POST(makeRequest(input))
    const body = await res.json()
    const bridgeDays = body.days.filter((d: { date: string }) => d.date < body.planStartDate)
    expect(bridgeDays.length).toBe(0)
  })
})

describe("POST /api/generate-plan — constraints and feasibilityWarning", () => {
  it("includes feasibilityWarning in response", async () => {
    const res = await POST(makeRequest(validInput))
    const body = await res.json()
    expect("feasibilityWarning" in body).toBe(true)
    expect(body.feasibilityWarning).toBeNull()
  })

  it("returns feasibilityWarning for first-timer with insufficient weeks", async () => {
    const firstTimerInput = {
      ...validInput,
      race: { ...validInput.race, date: "2026-07-01" }, // ~14 weeks away from 2026-03-19
      isFirstAtDistance: true,
      weeklyMileageRange: "25-40" as const,
    }
    const res = await POST(makeRequest(firstTimerInput))
    const body = await res.json()
    expect(body.feasibilityWarning).not.toBeNull()
    expect(typeof body.feasibilityWarning).toBe("string")
  })

  it("no strength workouts when includeStrength is false", async () => {
    const noStrengthInput = { ...validInput, includeStrength: false }
    const res = await POST(makeRequest(noStrengthInput))
    const body = await res.json()
    const strengthDays = body.days.filter((d: { type: string }) => d.type === "strength")
    expect(strengthDays).toHaveLength(0)
  })
})
