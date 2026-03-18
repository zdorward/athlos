import { describe, it, expect } from "vitest"
import { getWorkoutNote, groupDaysByDate, WORKOUT_NAMES } from "./workout-utils"
import type { WorkoutDay } from "@workspace/plan-engine"

describe("getWorkoutNote — intervals", () => {
  it("prescribes rep count and target pace when both are defined", () => {
    const day: WorkoutDay = {
      date: "2026-06-01",
      type: "intervals",
      distanceKm: 10,
      targetPace: "4:30–4:45/km",
    }
    expect(getWorkoutNote(day, "km")).toBe(
      "8×1km at 4:30–4:45/km with 2–3 min jog recovery. Stop the session if your pace slips — quality over quantity."
    )
  })

  it("falls back to VO2max pace label when targetPace is not defined", () => {
    const day: WorkoutDay = { date: "2026-06-01", type: "intervals", distanceKm: 6 }
    expect(getWorkoutNote(day, "km")).toBe(
      "4×1km at VO2max pace with 2–3 min jog recovery. Stop the session if your pace slips — quality over quantity."
    )
  })

  it("uses generic fallback when distanceKm is not defined", () => {
    const day: WorkoutDay = { date: "2026-06-01", type: "intervals" }
    expect(getWorkoutNote(day, "km")).toBe(
      "800m–1km repeats at VO2max pace with 2–3 min jog recovery."
    )
  })

  it("floors rep count at 3 for short sessions", () => {
    const day: WorkoutDay = { date: "2026-06-01", type: "intervals", distanceKm: 4 }
    expect(getWorkoutNote(day, "km")).toBe(
      "3×1km at VO2max pace with 2–3 min jog recovery. Stop the session if your pace slips — quality over quantity."
    )
  })

  it("caps rep count at 8 for large sessions", () => {
    const day: WorkoutDay = { date: "2026-06-01", type: "intervals", distanceKm: 14 }
    expect(getWorkoutNote(day, "km")).toBe(
      "8×1km at VO2max pace with 2–3 min jog recovery. Stop the session if your pace slips — quality over quantity."
    )
  })
})

describe("groupDaysByDate", () => {
  it("groups entries sharing the same date into one array", () => {
    const days: WorkoutDay[] = [
      { date: "2026-06-02", type: "easy", distanceKm: 5 },
      { date: "2026-06-02", type: "strength" },
      { date: "2026-06-03", type: "rest" },
    ]
    const result = groupDaysByDate(days)
    expect(result.size).toBe(2)
    expect(result.get("2026-06-02")).toHaveLength(2)
    expect(result.get("2026-06-03")).toHaveLength(1)
  })

  it("preserves insertion order", () => {
    const days: WorkoutDay[] = [
      { date: "2026-06-05", type: "long", distanceKm: 20 },
      { date: "2026-06-03", type: "easy", distanceKm: 8 },
    ]
    const keys = Array.from(groupDaysByDate(days).keys())
    expect(keys).toEqual(["2026-06-05", "2026-06-03"])
  })

  it("handles an empty array", () => {
    expect(groupDaysByDate([]).size).toBe(0)
  })
})

describe("WORKOUT_NAMES", () => {
  it('strength displays as "Strength Training"', () => {
    expect(WORKOUT_NAMES["strength"]).toBe("Strength Training")
  })
})
