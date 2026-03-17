import { describe, it, expect } from "vitest"
import { getWorkoutNote } from "./workout-utils"
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
})
