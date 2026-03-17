import { describe, it, expect } from "vitest"
import { buildBridgeRuns } from "./bridge-runs"
import type { PlanGenerationInput, WorkoutDay } from "./types"

const BASE_INPUT: PlanGenerationInput = {
  goal: "race",
  race: { name: "Test Race", date: "2026-10-04", distance: "full", city: "Test City" },
  selectedDays: ["wed", "fri"],
  longRunDay: "sun",
  units: "km",
  weeklyMileageRange: "40-60",
}

// 2026-03-23 is a Monday
const NEXT_MONDAY = new Date("2026-03-23T00:00:00Z")

function makeEasyRun(date: string, distanceKm: number, targetPace?: string): WorkoutDay {
  return { date, type: "easy", distanceKm, ...(targetPace && { targetPace }) }
}

describe("buildBridgeRuns", () => {
  it("returns [] when today is Monday", () => {
    const monday = new Date("2026-03-23T00:00:00Z")
    const result = buildBridgeRuns(BASE_INPUT, [], monday)
    expect(result).toEqual([])
  })

  it("returns only rest entries when selected day is not in the gap", () => {
    // gap is Wed 18 – Sun 22; "mon" is not in that range → all 5 days are rest
    const input = { ...BASE_INPUT, selectedDays: ["mon"] }
    const wednesday = new Date("2026-03-18T00:00:00Z")
    const result = buildBridgeRuns(input, [], wednesday)
    expect(result).toHaveLength(5)
    expect(result.every(d => d.type === "rest")).toBe(true)
  })

  it("returns easy for selected day plus rest for non-selected days in the gap", () => {
    // today = Wed 18, selectedDays = ["wed"] → Wed easy + Thu/Fri/Sat/Sun rest = 5 entries
    const input = { ...BASE_INPUT, selectedDays: ["wed"] }
    const wednesday = new Date("2026-03-18T00:00:00Z")
    const result = buildBridgeRuns(input, [], wednesday)
    expect(result).toHaveLength(5)
    expect(result[0]!.date).toBe("2026-03-18")
    expect(result[0]!.type).toBe("easy")
    expect(result.slice(1).every(d => d.type === "rest")).toBe(true)
  })

  it("returns easy runs for selected days and rest for non-selected days in the gap", () => {
    // today = Wed 18, selectedDays = ["wed", "fri"] → Wed easy, Thu rest, Fri easy, Sat rest, Sun rest
    const wednesday = new Date("2026-03-18T00:00:00Z")
    const result = buildBridgeRuns(BASE_INPUT, [], wednesday)
    expect(result).toHaveLength(5)
    expect(result[0]!.date).toBe("2026-03-18")
    expect(result[0]!.type).toBe("easy")
    expect(result[2]!.date).toBe("2026-03-20")
    expect(result[2]!.type).toBe("easy")
  })

  it("computes distanceKm as average of week-1 easy runs", () => {
    const wednesday = new Date("2026-03-18T00:00:00Z")
    const planDays: WorkoutDay[] = [
      makeEasyRun("2026-03-23", 10),  // week 1 easy
      makeEasyRun("2026-03-25", 12),  // week 1 easy
    ]
    const result = buildBridgeRuns(BASE_INPUT, planDays, wednesday)
    expect(result[0]!.distanceKm).toBe(11.0)
  })

  it("uses fallback distance when no week-1 easy runs exist", () => {
    // "40-60" = 50 km/week, 2 selected days → 50/2 = 25.0
    const wednesday = new Date("2026-03-18T00:00:00Z")
    const input = { ...BASE_INPUT, selectedDays: ["wed", "fri"], weeklyMileageRange: "40-60" as const }
    const result = buildBridgeRuns(input, [], wednesday)
    expect(result[0]!.distanceKm).toBe(25.0)
  })

  it("uses fallback with 3 selected days: 50/3 = 16.7", () => {
    const wednesday = new Date("2026-03-18T00:00:00Z")
    const input = { ...BASE_INPUT, selectedDays: ["wed", "fri", "sat"], weeklyMileageRange: "40-60" as const }
    const result = buildBridgeRuns(input, [], wednesday)
    expect(result[0]!.distanceKm).toBe(16.7)
  })

  it("copies targetPace from week-1 easy run", () => {
    const wednesday = new Date("2026-03-18T00:00:00Z")
    const planDays: WorkoutDay[] = [
      makeEasyRun("2026-03-23", 10, "5:30–6:00/km"),
    ]
    const result = buildBridgeRuns(BASE_INPUT, planDays, wednesday)
    expect(result[0]!.targetPace).toBe("5:30–6:00/km")
  })

  it("omits targetPace key when no week-1 easy run has a pace", () => {
    const wednesday = new Date("2026-03-18T00:00:00Z")
    const result = buildBridgeRuns(BASE_INPUT, [], wednesday)
    expect("targetPace" in result[0]!).toBe(false)
  })

  it("adds a long run on Sunday when Sunday is the longRunDay", () => {
    const sunday = new Date("2026-03-22T00:00:00Z")  // Sun before Mon 23
    const input = { ...BASE_INPUT, selectedDays: ["sun"], longRunDay: "sun" }
    const result = buildBridgeRuns(input, [], sunday)
    expect(result).toHaveLength(1)
    expect(result[0]!.date).toBe("2026-03-22")
    expect(result[0]!.type).toBe("long")
  })

  it("long run uses week-1 long run distance and pace", () => {
    const tuesday = new Date("2026-03-17T00:00:00Z")  // Tue, gap = Tue–Sun
    const input = { ...BASE_INPUT, selectedDays: ["tue", "sun"], longRunDay: "sun" }
    const planDays: WorkoutDay[] = [
      { date: "2026-03-23", type: "easy", distanceKm: 10 },
      { date: "2026-03-29", type: "long", distanceKm: 22, targetPace: "5:45–6:15/km" },
    ]
    const result = buildBridgeRuns(input, planDays, tuesday)
    const longRun = result.find(d => d.date === "2026-03-22")
    expect(longRun?.type).toBe("long")
    expect(longRun?.distanceKm).toBe(22)
    expect(longRun?.targetPace).toBe("5:45–6:15/km")
  })

  it("returns a rest entry on Sunday when Sunday is not selected", () => {
    const sunday = new Date("2026-03-22T00:00:00Z")
    const input = { ...BASE_INPUT, selectedDays: ["mon", "wed"] }
    const result = buildBridgeRuns(input, [], sunday)
    expect(result).toHaveLength(1)
    expect(result[0]!.type).toBe("rest")
  })
})

describe("buildBridgeRuns — rest days for non-selected days", () => {
  it("emits rest entries for non-selected days in the gap", () => {
    // today = Thu 2026-03-19, selectedDays = ["wed"] only
    // gap: Thu 19, Fri 20, Sat 21, Sun 22 → Wed is not in gap, so no easy runs
    // All 4 days should be rest
    const input = { ...BASE_INPUT, selectedDays: ["wed"] }
    const thursday = new Date("2026-03-19T00:00:00Z")
    const result = buildBridgeRuns(input, [], thursday)
    expect(result.length).toBe(4) // Thu–Sun
    expect(result.every(d => d.type === "rest")).toBe(true)
  })

  it("emits rest for non-selected days and easy for selected days in the same gap", () => {
    // today = Wed 2026-03-18, selectedDays = ["wed", "fri"]
    // gap: Wed 18, Thu 19, Fri 20, Sat 21, Sun 22
    // Wed 18 → easy, Thu 19 → rest, Fri 20 → easy, Sat 21 → rest, Sun 22 → rest
    const input = { ...BASE_INPUT, selectedDays: ["wed", "fri"] }
    const wednesday = new Date("2026-03-18T00:00:00Z")
    const result = buildBridgeRuns(input, [], wednesday)
    expect(result.length).toBe(5)
    expect(result.find(d => d.date === "2026-03-18")?.type).toBe("easy")
    expect(result.find(d => d.date === "2026-03-19")?.type).toBe("rest")
    expect(result.find(d => d.date === "2026-03-20")?.type).toBe("easy")
    expect(result.find(d => d.date === "2026-03-21")?.type).toBe("rest")
    expect(result.find(d => d.date === "2026-03-22")?.type).toBe("rest")
  })

  it("rest entries have no distanceKm", () => {
    const input = { ...BASE_INPUT, selectedDays: ["wed"] }
    const thursday = new Date("2026-03-19T00:00:00Z")
    const result = buildBridgeRuns(input, [], thursday)
    result.forEach(d => {
      if (d.type === "rest") expect(d.distanceKm).toBeUndefined()
    })
  })
})
