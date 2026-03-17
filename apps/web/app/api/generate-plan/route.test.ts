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
  })

  it("days contain only valid WorkoutTypes", () => {
    const VALID_TYPES = new Set([
      "easy",
      "long",
      "medium-long",
      "mp",
      "tempo",
      "intervals",
      "rest",
      "race",
      "strength",
    ])
    return POST(makeRequest(validInput)).then(async (res) => {
      const body = await res.json()
      body.days.forEach((d: { type: string }) => {
        expect(VALID_TYPES.has(d.type)).toBe(true)
      })
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
