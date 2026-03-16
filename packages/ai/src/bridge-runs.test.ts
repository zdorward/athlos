import { describe, it, expect } from "vitest"
import { buildBridgeRuns } from "./bridge-runs"
import type { PlanGenerationInput, WorkoutDay } from "./types"

const BASE_INPUT: PlanGenerationInput = {
  goal: "race",
  race: { name: "Test Race", date: "2026-10-04", distance: "full", city: "Test City" },
  selectedDays: ["wed", "fri"],
  longRunDay: "sun",
  units: "km",
  strengthTraining: false,
  weeklyMileageRange: "40-60",
}

// 2026-03-23 is a Monday
const NEXT_MONDAY = new Date("2026-03-23T00:00:00Z")

function makeEasyRun(date: string, distanceKm: number, targetPace?: string): WorkoutDay {
  return { date, type: "easy", distanceKm, description: "Easy run.", ...(targetPace && { targetPace }) }
}

describe("buildBridgeRuns", () => {
  it("returns [] when today is Monday", () => {
    const monday = new Date("2026-03-23T00:00:00Z")
    const result = buildBridgeRuns(BASE_INPUT, [], monday)
    expect(result).toEqual([])
  })

  it("returns [] when selected day is not in the gap", () => {
    // gap is Wed 18 – Sun 22; "mon" is not in that range
    const input = { ...BASE_INPUT, selectedDays: ["mon"] }
    const wednesday = new Date("2026-03-18T00:00:00Z")
    const result = buildBridgeRuns(input, [], wednesday)
    expect(result).toEqual([])
  })

  it("returns one bridge run when one selected day falls in the gap", () => {
    // today = Wed 18, selectedDays = ["wed"] → one run on 2026-03-18
    const input = { ...BASE_INPUT, selectedDays: ["wed"] }
    const wednesday = new Date("2026-03-18T00:00:00Z")
    const result = buildBridgeRuns(input, [], wednesday)
    expect(result).toHaveLength(1)
    expect(result[0]!.date).toBe("2026-03-18")
    expect(result[0]!.type).toBe("easy")
  })

  it("returns multiple bridge runs for multiple selected days in the gap", () => {
    // today = Wed 18, selectedDays = ["wed", "fri"] → runs on Wed 18 and Fri 20
    const wednesday = new Date("2026-03-18T00:00:00Z")
    const result = buildBridgeRuns(BASE_INPUT, [], wednesday)
    expect(result).toHaveLength(2)
    expect(result[0]!.date).toBe("2026-03-18")
    expect(result[1]!.date).toBe("2026-03-20")
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

  it("adds bridge run on Sunday when Sunday is selected", () => {
    const sunday = new Date("2026-03-22T00:00:00Z")  // Sun before Mon 23
    const input = { ...BASE_INPUT, selectedDays: ["sun"] }
    const result = buildBridgeRuns(input, [], sunday)
    expect(result).toHaveLength(1)
    expect(result[0]!.date).toBe("2026-03-22")
  })

  it("returns [] on Sunday when Sunday is not selected", () => {
    const sunday = new Date("2026-03-22T00:00:00Z")
    const input = { ...BASE_INPUT, selectedDays: ["mon", "wed"] }
    const result = buildBridgeRuns(input, [], sunday)
    expect(result).toEqual([])
  })
})
