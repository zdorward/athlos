import { describe, it, expect } from "vitest"
import {
  deriveExpectedEffort,
  buildReplacementWorkout,
  checkAdaptationTrigger,
  type WorkoutLogInput,
} from "./adaptation"

// ─── deriveExpectedEffort ─────────────────────────────────────────────────────

describe("deriveExpectedEffort", () => {
  it("returns hard for tempo", () => {
    expect(deriveExpectedEffort("tempo")).toBe("hard")
  })
  it("returns hard for intervals", () => {
    expect(deriveExpectedEffort("intervals")).toBe("hard")
  })
  it("returns hard for mp", () => {
    expect(deriveExpectedEffort("mp")).toBe("hard")
  })
  it("returns hard for race", () => {
    expect(deriveExpectedEffort("race")).toBe("hard")
  })
  it("returns moderate for long", () => {
    expect(deriveExpectedEffort("long")).toBe("moderate")
  })
  it("returns moderate for medium-long", () => {
    expect(deriveExpectedEffort("medium-long")).toBe("moderate")
  })
  it("returns easy for easy", () => {
    expect(deriveExpectedEffort("easy")).toBe("easy")
  })
  it("returns easy for strength", () => {
    expect(deriveExpectedEffort("strength")).toBe("easy")
  })
  it("returns easy for rest", () => {
    expect(deriveExpectedEffort("rest")).toBe("easy")
  })
})

// ─── checkAdaptationTrigger ───────────────────────────────────────────────────

function makeLog(
  overrides: Partial<WorkoutLogInput> & Pick<WorkoutLogInput, "workoutDate">
): WorkoutLogInput {
  return {
    workoutType: "easy",
    expectedEffort: "easy",
    actualEffort: "good",
    completed: true,
    soreness: "none",
    ...overrides,
  }
}

describe("checkAdaptationTrigger", () => {
  it("does not trigger with 0 logs", () => {
    expect(checkAdaptationTrigger([]).triggered).toBe(false)
  })

  // Use a fixed referenceDate in all time-sensitive tests so they don't
  // break as real time passes. "2026-03-16" is the canonical reference date.
  const REF = "2026-03-16"

  it("does not trigger with 1 unexpectedly hard log", () => {
    const logs = [
      makeLog({ workoutDate: "2026-03-10", workoutType: "easy", expectedEffort: "easy", actualEffort: "hard" }),
    ]
    expect(checkAdaptationTrigger(logs, REF).triggered).toBe(false)
  })

  it("triggers with 2 unexpectedly hard logs within 7 days", () => {
    const logs = [
      makeLog({ workoutDate: "2026-03-10", workoutType: "easy", expectedEffort: "easy", actualEffort: "hard" }),
      makeLog({ workoutDate: "2026-03-13", workoutType: "easy", expectedEffort: "easy", actualEffort: "hard" }),
    ]
    const result = checkAdaptationTrigger(logs, REF)
    expect(result.triggered).toBe(true)
    expect(result.reason).toMatch(/2 unexpectedly hard/)
  })

  it("includes reason count in trigger message", () => {
    const logs = [
      makeLog({ workoutDate: "2026-03-10", workoutType: "easy", expectedEffort: "easy", actualEffort: "hard" }),
      makeLog({ workoutDate: "2026-03-11", workoutType: "easy", expectedEffort: "easy", actualEffort: "hard" }),
      makeLog({ workoutDate: "2026-03-12", workoutType: "easy", expectedEffort: "easy", actualEffort: "hard" }),
    ]
    const result = checkAdaptationTrigger(logs, REF)
    expect(result.triggered).toBe(true)
    expect(result.reason).toMatch(/3 unexpectedly hard/)
  })

  it("does not count expectedEffort=hard workouts toward unexpectedly-hard tally", () => {
    const logs = [
      makeLog({ workoutDate: "2026-03-10", workoutType: "tempo", expectedEffort: "hard", actualEffort: "hard" }),
      makeLog({ workoutDate: "2026-03-12", workoutType: "tempo", expectedEffort: "hard", actualEffort: "hard" }),
      makeLog({ workoutDate: "2026-03-14", workoutType: "tempo", expectedEffort: "hard", actualEffort: "hard" }),
    ]
    expect(checkAdaptationTrigger(logs, REF).triggered).toBe(false)
  })

  it("does not trigger when unexpectedly hard logs are older than 7 days", () => {
    const logs = [
      makeLog({ workoutDate: "2026-01-01", workoutType: "easy", expectedEffort: "easy", actualEffort: "hard" }),
      makeLog({ workoutDate: "2026-01-02", workoutType: "easy", expectedEffort: "easy", actualEffort: "hard" }),
    ]
    const referenceDate = "2026-03-16"
    expect(checkAdaptationTrigger(logs, referenceDate).triggered).toBe(false)
  })

  it("triggers on 2 significant soreness logs within 3 calendar days", () => {
    const logs = [
      makeLog({ workoutDate: "2026-03-10", soreness: "significant" }),
      makeLog({ workoutDate: "2026-03-12", soreness: "significant" }),
    ]
    const result = checkAdaptationTrigger(logs, REF)
    expect(result.triggered).toBe(true)
    expect(result.reason).toMatch(/significant soreness/)
  })

  it("does not trigger when significant soreness logs are more than 3 days apart", () => {
    const logs = [
      makeLog({ workoutDate: "2026-03-10", soreness: "significant" }),
      makeLog({ workoutDate: "2026-03-14", soreness: "significant" }),
    ]
    expect(checkAdaptationTrigger(logs, REF).triggered).toBe(false)
  })

  it("counts incomplete workouts (completed=false) toward unexpectedly-hard tally", () => {
    const logs = [
      makeLog({ workoutDate: "2026-03-10", expectedEffort: "easy", actualEffort: "hard", completed: false }),
      makeLog({ workoutDate: "2026-03-12", expectedEffort: "easy", actualEffort: "hard", completed: false }),
    ]
    expect(checkAdaptationTrigger(logs, REF).triggered).toBe(true)
  })

  it("prefers unexpectedly-hard trigger over soreness trigger when both present", () => {
    const logs = [
      makeLog({ workoutDate: "2026-03-10", expectedEffort: "easy", actualEffort: "hard", soreness: "significant" }),
      makeLog({ workoutDate: "2026-03-12", expectedEffort: "easy", actualEffort: "hard", soreness: "significant" }),
    ]
    const result = checkAdaptationTrigger(logs, REF)
    expect(result.reason).toMatch(/unexpectedly hard/)
  })
})

// ─── buildReplacementWorkout ──────────────────────────────────────────────────

describe("buildReplacementWorkout", () => {
  it("returns null for easy", () => {
    expect(buildReplacementWorkout({ date: "2026-03-20", type: "easy", description: "Easy run." })).toBeNull()
  })

  it("returns null for race", () => {
    expect(buildReplacementWorkout({ date: "2026-03-20", type: "race", description: "Race day." })).toBeNull()
  })

  it("returns null for rest", () => {
    expect(buildReplacementWorkout({ date: "2026-03-20", type: "rest", description: "Rest." })).toBeNull()
  })

  it("replaces tempo with easy run, preserves distance", () => {
    const result = buildReplacementWorkout({ date: "2026-03-20", type: "tempo", distanceKm: 10, description: "Tempo." })
    expect(result).not.toBeNull()
    expect(result!.type).toBe("easy")
    expect(result!.distanceKm).toBe(10)
    expect(result!.targetPace).toBeUndefined()
    expect(result!.targetHR).toBe("Zone 2 (130–145 bpm)")
    expect(result!.date).toBe("2026-03-20")
  })

  it("replaces intervals with easy run, preserves distance", () => {
    const result = buildReplacementWorkout({ date: "2026-03-20", type: "intervals", distanceKm: 8, description: "Intervals." })
    expect(result!.type).toBe("easy")
    expect(result!.distanceKm).toBe(8)
  })

  it("replaces mp with easy run, preserves distance", () => {
    const result = buildReplacementWorkout({ date: "2026-03-20", type: "mp", distanceKm: 16, description: "MP run." })
    expect(result!.type).toBe("easy")
    expect(result!.distanceKm).toBe(16)
  })

  it("replaces long with medium-long at ~70% distance", () => {
    const result = buildReplacementWorkout({ date: "2026-03-20", type: "long", distanceKm: 30, description: "Long run." })
    expect(result!.type).toBe("medium-long")
    expect(result!.distanceKm).toBe(21)  // 30 * 0.7 = 21.0
  })

  it("rounds long replacement distance to 1 decimal", () => {
    const result = buildReplacementWorkout({ date: "2026-03-20", type: "long", distanceKm: 25, description: "Long run." })
    expect(result!.distanceKm).toBe(17.5)
  })

  it("replaces medium-long with easy run, preserves distance", () => {
    const result = buildReplacementWorkout({ date: "2026-03-20", type: "medium-long", distanceKm: 18, description: "ML." })
    expect(result!.type).toBe("easy")
    expect(result!.distanceKm).toBe(18)
  })

  it("replaces strength with rest day", () => {
    const result = buildReplacementWorkout({ date: "2026-03-20", type: "strength", description: "Lift." })
    expect(result!.type).toBe("rest")
    expect(result!.distanceKm).toBeUndefined()
  })

  it("clears targetPace on replacement", () => {
    const result = buildReplacementWorkout({ date: "2026-03-20", type: "tempo", distanceKm: 10, description: "Tempo.", targetPace: "4:30/km" })
    expect(result!.targetPace).toBeUndefined()
  })
})
