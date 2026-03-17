# pace-calculator.ts Split Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `pace-calculator.ts` into three focused files — one for pace math, one for phase scheduling, one for training parameters — with test files to match, and no changes to any public API or logic.

**Architecture:** Pure file-level extraction with zero logic changes. New files are created and tests written for them first (TDD), then the source code is moved, and finally the old file is trimmed and `index.ts` updated. At no point do the package's exported names or behavior change.

**Tech Stack:** TypeScript, Vitest

---

## File Map

| Action | File |
|--------|------|
| Modify | `packages/plan-engine/src/pace-calculator.ts` |
| Create | `packages/plan-engine/src/phase-planner.ts` |
| Create | `packages/plan-engine/src/training-parameters.ts` |
| Modify | `packages/plan-engine/src/index.ts` |
| Modify | `packages/plan-engine/src/pace-calculator.test.ts` |
| Create | `packages/plan-engine/src/phase-planner.test.ts` |
| Create | `packages/plan-engine/src/training-parameters.test.ts` |

**Spec:** `docs/superpowers/specs/2026-03-17-pace-calculator-split-design.md`

---

### Task 1: Extract phase schedule → `phase-planner.ts`

**Files:**
- Create: `packages/plan-engine/src/phase-planner.test.ts`
- Create: `packages/plan-engine/src/phase-planner.ts`

- [ ] **Step 1: Write the failing test file**

Create `packages/plan-engine/src/phase-planner.test.ts`. This imports from `./phase-planner`, which doesn't exist yet.

```ts
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
  it("under-40: GF=4, Base=9, Build=9, Peak=4, Taper=3", () => {
    const phases = computePhases(29, "full", "under-40")
    expect(phases[0]).toEqual({ name: "General Fitness", startWeek: 1, endWeek: 4 })
    expect(phases[1]).toEqual({ name: "Base", startWeek: 5, endWeek: 13 })
    expect(phases[2]).toEqual({ name: "Build", startWeek: 14, endWeek: 22 })
    expect(phases[3]).toEqual({ name: "Peak", startWeek: 23, endWeek: 26 })
    expect(phases[4]).toEqual({ name: "Taper", startWeek: 27, endWeek: 29 })
  })

  it("80-plus: GF cap does not bite at 29 weeks — same layout as under-40", () => {
    const phases = computePhases(29, "full", "80-plus")
    expect(phases[0]).toEqual({ name: "General Fitness", startWeek: 1, endWeek: 4 })
    expect(phases[1]).toEqual({ name: "Base", startWeek: 5, endWeek: 13 })
    expect(phases[2]).toEqual({ name: "Build", startWeek: 14, endWeek: 22 })
    expect(phases[3]).toEqual({ name: "Peak", startWeek: 23, endWeek: 26 })
    expect(phases[4]).toEqual({ name: "Taper", startWeek: 27, endWeek: 29 })
  })
})

describe("computePhases — 52 week full marathon: GF capped by mileage range", () => {
  it("under-40: GF is capped at 12 weeks", () => {
    const phases = computePhases(52, "full", "under-40")
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/zackdorward/dev/athlos && pnpm --filter @workspace/plan-engine test
```

Expected: failures on the `phase-planner.test.ts` file with `Cannot find module './phase-planner'`. The existing `pace-calculator.test.ts` tests should still pass.

- [ ] **Step 3: Create `phase-planner.ts`**

Create `packages/plan-engine/src/phase-planner.ts` with this exact content (moved verbatim from `pace-calculator.ts` lines 101–180):

```ts
import type { PhaseEntry, WeeklyMileageRange } from "./types"

function getTaperMin(distance: string): number {
  // "ultra" intentionally falls through to the same minimum as half/full (3 weeks)
  return distance === "5k" || distance === "10k" ? 2 : 3
}

function getPeakMin(distance: string): number {
  if (distance === "5k" || distance === "10k") return 2
  if (distance === "half") return 3
  return 4  // full, ultra, unknown
}

const GF_CAP: Record<WeeklyMileageRange, number> = {
  "under-40": 12,
  "40-60":    10,
  "60-80":     8,
  "80-plus":   6,
}

/**
 * Compute the phase schedule for a training plan.
 *
 * ≤ 20 weeks → 4 phases (Base, Build, Peak, Taper)
 * 21+ weeks  → 5 phases (General Fitness, Base, Build, Peak, Taper)
 *
 * Taper minimum is always respected. Phases with 0 weeks are omitted.
 */
export function computePhases(
  totalWeeks: number,
  distance: string,
  weeklyMileageRange: WeeklyMileageRange = "40-60",
): PhaseEntry[] {
  const taperMin = getTaperMin(distance)
  const taper = taperMin
  const peakMin = getPeakMin(distance)
  let remaining = totalWeeks - taper - peakMin

  const result: PhaseEntry[] = []
  let w = 1

  function pushPhase(name: string, weeks: number) {
    if (weeks <= 0) return
    result.push({ name, startWeek: w, endWeek: w + weeks - 1 })
    w += weeks
    remaining -= weeks
  }

  if (totalWeeks <= 20) {
    // 4-phase
    const base  = Math.min(remaining, Math.max(1, Math.round(totalWeeks * 0.40)))
    remaining -= base
    const build = Math.min(remaining, Math.max(0, Math.round(totalWeeks * 0.30)))
    remaining -= build
    const peak  = peakMin + Math.max(0, remaining)

    pushPhase("Base",  base)
    pushPhase("Build", build)
    pushPhase("Peak",  peak)
  } else {
    // 5-phase: Base and Build are sized first, GF fills the remainder up to the
    // mileage-bracket cap, Peak gets any overflow above the cap.
    const base  = Math.min(remaining, Math.max(1, Math.round(totalWeeks * 0.30)))
    remaining -= base
    const build = Math.min(remaining, Math.max(1, Math.round(totalWeeks * 0.30)))
    remaining -= build
    const gf    = Math.min(remaining, GF_CAP[weeklyMileageRange])
    remaining -= gf
    const peak  = peakMin + Math.max(0, remaining)

    pushPhase("General Fitness", gf)
    pushPhase("Base",  base)
    pushPhase("Build", build)
    pushPhase("Peak",  peak)
  }

  // Always push taper last (resets `remaining` tracking; use totalWeeks as anchor)
  result.push({ name: "Taper", startWeek: w, endWeek: totalWeeks })
  return result
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/zackdorward/dev/athlos && pnpm --filter @workspace/plan-engine test
```

Expected: all tests pass, including the new `phase-planner.test.ts` suite.

- [ ] **Step 5: Commit**

```bash
cd /Users/zackdorward/dev/athlos
git add packages/plan-engine/src/phase-planner.ts packages/plan-engine/src/phase-planner.test.ts
git commit -m "refactor: extract computePhases to phase-planner.ts"
```

---

### Task 2: Extract training parameters → `training-parameters.ts`

**Files:**
- Create: `packages/plan-engine/src/training-parameters.test.ts`
- Create: `packages/plan-engine/src/training-parameters.ts`

- [ ] **Step 1: Write the failing test file**

Create `packages/plan-engine/src/training-parameters.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { computeGoalPeakMileage, computeTrainingStructure, computeLongRunTargets } from "./training-parameters"

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

// ─── computeTrainingStructure ─────────────────────────────────────────────

describe("computeTrainingStructure — full marathon, 3:20 goal (200 min), 1-3, 7 days", () => {
  const result = computeTrainingStructure(200, "full", 7, "40-60")
  it("runDaysPerWeek: 6", () => { expect(result.runDaysPerWeek).toBe(6) })
  it("restDaysPerWeek: 1", () => { expect(result.restDaysPerWeek).toBe(1) })
  it("maxQualitySessions: 2", () => { expect(result.maxQualitySessions).toBe(2) })
})

describe("computeTrainingStructure — full marathon, sub-2:30 (140 min), 3-or-more, 7 days", () => {
  const result = computeTrainingStructure(140, "full", 7, "80-plus")
  it("runDaysPerWeek: 7", () => { expect(result.runDaysPerWeek).toBe(7) })
  it("restDaysPerWeek: 0", () => { expect(result.restDaysPerWeek).toBe(0) })
  it("maxQualitySessions: 3", () => { expect(result.maxQualitySessions).toBe(3) })
})

describe("computeTrainingStructure — full marathon, 3:20 (200 min), 1-3, 5 selected days — selectedDaysCount clamp", () => {
  const result = computeTrainingStructure(200, "full", 5, "40-60")
  it("runDaysPerWeek: 5 (clamped to selectedDaysCount)", () => { expect(result.runDaysPerWeek).toBe(5) })
  it("restDaysPerWeek: 1 (not adjusted by clamp)", () => { expect(result.restDaysPerWeek).toBe(1) })
  it("maxQualitySessions: 2", () => { expect(result.maxQualitySessions).toBe(2) })
})

describe("computeTrainingStructure — half marathon, sub-1:15 (70 min), 1-3, 7 days", () => {
  const result = computeTrainingStructure(70, "half", 7, "60-80")
  it("runDaysPerWeek: 7", () => { expect(result.runDaysPerWeek).toBe(7) })
  it("restDaysPerWeek: 0", () => { expect(result.restDaysPerWeek).toBe(0) })
  it("maxQualitySessions: 3", () => { expect(result.maxQualitySessions).toBe(3) })
})

describe("computeTrainingStructure — 5k, 200 min, 1-3, 7 days — maxQuality+1, runDays cap", () => {
  const result = computeTrainingStructure(200, "5k", 7, "40-60")
  it("runDaysPerWeek: 6", () => { expect(result.runDaysPerWeek).toBe(6) })
  it("restDaysPerWeek: 1", () => { expect(result.restDaysPerWeek).toBe(1) })
  it("maxQualitySessions: 3 (5k bonus)", () => { expect(result.maxQualitySessions).toBe(3) })
})

describe("computeTrainingStructure — 5k, 140 min, 1-3, 7 days — run days capped from 7 to 6", () => {
  const result = computeTrainingStructure(140, "5k", 7, "80-plus")
  it("runDaysPerWeek: 6 (capped from 7)", () => { expect(result.runDaysPerWeek).toBe(6) })
  it("restDaysPerWeek: 1 (incremented due to cap)", () => { expect(result.restDaysPerWeek).toBe(1) })
  it("maxQualitySessions: 4 (3+1 bonus)", () => { expect(result.maxQualitySessions).toBe(4) })
})

describe("computeTrainingStructure — ultra (goalMinutes ignored, uses mileage fallback)", () => {
  const result = computeTrainingStructure(200, "ultra", 7, "60-80")
  it("runDaysPerWeek: 6", () => { expect(result.runDaysPerWeek).toBe(6) })
  it("restDaysPerWeek: 1", () => { expect(result.restDaysPerWeek).toBe(1) })
  it("maxQualitySessions: 2", () => { expect(result.maxQualitySessions).toBe(2) })
})

describe("computeTrainingStructure — full marathon, 4:30+ (360 min / 6h), 7 days — 4-day tier", () => {
  const result = computeTrainingStructure(360, "full", 7, "40-60")
  it("runDaysPerWeek: 4", () => { expect(result.runDaysPerWeek).toBe(4) })
  it("restDaysPerWeek: 3", () => { expect(result.restDaysPerWeek).toBe(3) })
  it("maxQualitySessions: 1", () => { expect(result.maxQualitySessions).toBe(1) })
})

describe("computeTrainingStructure — no goal time, full marathon, uses mileage fallback", () => {
  const result = computeTrainingStructure(null, "full", 7, "under-40")
  it("runDaysPerWeek: 5", () => { expect(result.runDaysPerWeek).toBe(5) })
  it("restDaysPerWeek: 2", () => { expect(result.restDaysPerWeek).toBe(2) })
  it("maxQualitySessions: 1", () => { expect(result.maxQualitySessions).toBe(1) })
})

// ─── computeLongRunTargets ─────────────────────────────────────────────────

describe("computeLongRunTargets — full marathon, null peakWeeklyKm (mid-range fallback)", () => {
  const result = computeLongRunTargets("full", null)
  it("peakLongRunKm: 35", () => { expect(result.peakLongRunKm).toBe(35) })
  it("recoveryRunMaxKm: 13", () => { expect(result.recoveryRunMaxKm).toBe(13) })
})

describe("computeLongRunTargets — full marathon, high=60 (< 65 bucket)", () => {
  const result = computeLongRunTargets("full", { low: 45, high: 60 })
  it("peakLongRunKm: 29", () => { expect(result.peakLongRunKm).toBe(29) })
  it("recoveryRunMaxKm: 11", () => { expect(result.recoveryRunMaxKm).toBe(11) })
})

describe("computeLongRunTargets — full marathon, high=80 (< 90 bucket)", () => {
  const result = computeLongRunTargets("full", { low: 65, high: 80 })
  it("peakLongRunKm: 35", () => { expect(result.peakLongRunKm).toBe(35) })
  it("recoveryRunMaxKm: 13", () => { expect(result.recoveryRunMaxKm).toBe(13) })
})

describe("computeLongRunTargets — full marathon, high=100 (< 116 bucket)", () => {
  const result = computeLongRunTargets("full", { low: 80, high: 100 })
  it("peakLongRunKm: 38", () => { expect(result.peakLongRunKm).toBe(38) })
  it("recoveryRunMaxKm: 16", () => { expect(result.recoveryRunMaxKm).toBe(16) })
})

describe("computeLongRunTargets — full marathon, high=130 (>= 116 bucket)", () => {
  const result = computeLongRunTargets("full", { low: 110, high: 130 })
  it("peakLongRunKm: 38", () => { expect(result.peakLongRunKm).toBe(38) })
  it("recoveryRunMaxKm: 16", () => { expect(result.recoveryRunMaxKm).toBe(16) })
})

describe("computeLongRunTargets — half marathon, null peakWeeklyKm (mid-range fallback)", () => {
  const result = computeLongRunTargets("half", null)
  it("peakLongRunKm: 22", () => { expect(result.peakLongRunKm).toBe(22) })
  it("recoveryRunMaxKm: 11", () => { expect(result.recoveryRunMaxKm).toBe(11) })
})

describe("computeLongRunTargets — half marathon, high=45 (< 50 bucket)", () => {
  const result = computeLongRunTargets("half", { low: 35, high: 45 })
  it("peakLongRunKm: 19", () => { expect(result.peakLongRunKm).toBe(19) })
  it("recoveryRunMaxKm: 9", () => { expect(result.recoveryRunMaxKm).toBe(9) })
})

describe("computeLongRunTargets — half marathon, high=65 (< 75 bucket)", () => {
  const result = computeLongRunTargets("half", { low: 55, high: 65 })
  it("peakLongRunKm: 22", () => { expect(result.peakLongRunKm).toBe(22) })
  it("recoveryRunMaxKm: 11", () => { expect(result.recoveryRunMaxKm).toBe(11) })
})

describe("computeLongRunTargets — half marathon, high=80 (>= 75 bucket)", () => {
  const result = computeLongRunTargets("half", { low: 65, high: 80 })
  it("peakLongRunKm: 26", () => { expect(result.peakLongRunKm).toBe(26) })
  it("recoveryRunMaxKm: 13", () => { expect(result.recoveryRunMaxKm).toBe(13) })
})

describe("computeLongRunTargets — 5k, null peakWeeklyKm (mid-range fallback)", () => {
  const result = computeLongRunTargets("5k", null)
  it("peakLongRunKm: 13", () => { expect(result.peakLongRunKm).toBe(13) })
  it("recoveryRunMaxKm: 8", () => { expect(result.recoveryRunMaxKm).toBe(8) })
})

describe("computeLongRunTargets — 5k, high=40 (< 45 bucket)", () => {
  const result = computeLongRunTargets("5k", { low: 30, high: 40 })
  it("peakLongRunKm: 11", () => { expect(result.peakLongRunKm).toBe(11) })
  it("recoveryRunMaxKm: 7", () => { expect(result.recoveryRunMaxKm).toBe(7) })
})

describe("computeLongRunTargets — 5k, high=55 (< 65 bucket)", () => {
  const result = computeLongRunTargets("5k", { low: 45, high: 55 })
  it("peakLongRunKm: 13", () => { expect(result.peakLongRunKm).toBe(13) })
  it("recoveryRunMaxKm: 8", () => { expect(result.recoveryRunMaxKm).toBe(8) })
})

describe("computeLongRunTargets — 10k, high=70 (>= 65 bucket)", () => {
  const result = computeLongRunTargets("10k", { low: 60, high: 70 })
  it("peakLongRunKm: 16", () => { expect(result.peakLongRunKm).toBe(16) })
  it("recoveryRunMaxKm: 10", () => { expect(result.recoveryRunMaxKm).toBe(10) })
})

describe("computeLongRunTargets — ultra (fixed values, peakWeeklyKm ignored)", () => {
  const result = computeLongRunTargets("ultra", { low: 50, high: 100 })
  it("peakLongRunKm: 32", () => { expect(result.peakLongRunKm).toBe(32) })
  it("recoveryRunMaxKm: 14", () => { expect(result.recoveryRunMaxKm).toBe(14) })
})

describe("computeLongRunTargets — ultra, null peakWeeklyKm", () => {
  const result = computeLongRunTargets("ultra", null)
  it("peakLongRunKm: 32", () => { expect(result.peakLongRunKm).toBe(32) })
  it("recoveryRunMaxKm: 14", () => { expect(result.recoveryRunMaxKm).toBe(14) })
})

describe("computeLongRunTargets — unknown distance, null peakWeeklyKm (unknown fallback)", () => {
  const result = computeLongRunTargets("obstacle-course", null)
  it("peakLongRunKm: 29", () => { expect(result.peakLongRunKm).toBe(29) })
  it("recoveryRunMaxKm: 11", () => { expect(result.recoveryRunMaxKm).toBe(11) })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/zackdorward/dev/athlos && pnpm --filter @workspace/plan-engine test
```

Expected: `training-parameters.test.ts` fails with `Cannot find module './training-parameters'`. All other tests pass.

- [ ] **Step 3: Create `training-parameters.ts`**

Create `packages/plan-engine/src/training-parameters.ts` with this exact content (moved verbatim from `pace-calculator.ts` lines 182–228 and 254–369):

```ts
/**
 * Return a soft target peak mileage range (km/week) for the given race distance
 * and goal time. The LLM uses this as a guideline, not a hard cap.
 *
 * Returns null for ultra (too variable) and invalid input (goalTotalMinutes <= 0).
 * Bucket boundaries are lower-bound inclusive, upper-bound exclusive.
 */
export function computeGoalPeakMileage(
  distance: "5k" | "10k" | "half" | "full" | "ultra",
  goalTotalMinutes: number,
): { low: number; high: number } | null {
  if (goalTotalMinutes <= 0) return null

  switch (distance) {
    case "full":
      if (goalTotalMinutes < 165) return { low: 110, high: 130 }
      if (goalTotalMinutes < 180) return { low: 95,  high: 115 }
      if (goalTotalMinutes < 210) return { low: 80,  high: 100 }
      if (goalTotalMinutes < 240) return { low: 65,  high: 80  }
      if (goalTotalMinutes < 270) return { low: 55,  high: 70  }
      return { low: 45, high: 60 }

    case "half":
      if (goalTotalMinutes < 80)  return { low: 80, high: 95 }
      if (goalTotalMinutes < 95)  return { low: 65, high: 80 }
      if (goalTotalMinutes < 110) return { low: 55, high: 70 }
      if (goalTotalMinutes < 130) return { low: 45, high: 60 }
      return { low: 35, high: 50 }

    case "10k":
      if (goalTotalMinutes < 35) return { low: 60, high: 75 }
      if (goalTotalMinutes < 40) return { low: 50, high: 65 }
      if (goalTotalMinutes < 50) return { low: 40, high: 55 }
      return { low: 30, high: 45 }

    case "5k":
      if (goalTotalMinutes < 18) return { low: 55, high: 65 }
      if (goalTotalMinutes < 22) return { low: 45, high: 55 }
      if (goalTotalMinutes < 28) return { low: 35, high: 45 }
      return { low: 25, high: 35 }

    default:
      return null  // ultra and unknown distances
  }
}

/**
 * Derive the optimal weekly training structure from goal time, distance,
 * training age, and availability. Used to inject Pfitzinger-based hard
 * constraints into the LLM prompt.
 *
 * The weeklyMileageRange fallback is used when goalMinutes is null (no goal
 * time provided) or when distance is "ultra".
 * Unknown distance values (not full/half/5k/10k/ultra) fall through to the mileage range fallback.
 */
export function computeTrainingStructure(
  goalMinutes: number | null,
  distance: string,
  selectedDaysCount: number,
  weeklyMileageRange: string,
): { runDaysPerWeek: number; restDaysPerWeek: number; maxQualitySessions: number } {
  let run: number
  let rest: number
  let quality: number

  const useMileageFallback =
    goalMinutes === null ||
    distance === "ultra" ||
    (distance !== "full" && distance !== "half" && distance !== "5k" && distance !== "10k")

  if (!useMileageFallback && distance === "full") {
    if (goalMinutes < 150)      { run = 7; rest = 0; quality = 3 }
    else if (goalMinutes < 165) { run = 7; rest = 0; quality = 2 }
    // buckets match spec rows — values may diverge in future tuning
    else if (goalMinutes < 190) { run = 6; rest = 1; quality = 2 }
    else if (goalMinutes < 225) { run = 6; rest = 1; quality = 2 }
    else if (goalMinutes < 270) { run = 5; rest = 2; quality = 1 }
    else                        { run = 4; rest = 3; quality = 1 }
  } else if (!useMileageFallback && distance === "half") {
    if (goalMinutes < 75)       { run = 7; rest = 0; quality = 3 }
    else if (goalMinutes < 82)  { run = 7; rest = 0; quality = 2 }
    // buckets match spec rows — values may diverge in future tuning
    else if (goalMinutes < 95)  { run = 6; rest = 1; quality = 2 }
    else if (goalMinutes < 112) { run = 6; rest = 1; quality = 2 }
    else if (goalMinutes < 135) { run = 5; rest = 2; quality = 1 }
    else                        { run = 5; rest = 2; quality = 1 }
  } else if (!useMileageFallback && (distance === "5k" || distance === "10k")) {
    const gm = goalMinutes as number
    // Use full marathon table as base
    if (gm < 150)      { run = 7; rest = 0; quality = 3 }
    else if (gm < 165) { run = 7; rest = 0; quality = 2 }
    else if (gm < 190) { run = 6; rest = 1; quality = 2 }
    else if (gm < 225) { run = 6; rest = 1; quality = 2 }
    else if (gm < 270) { run = 5; rest = 2; quality = 1 }
    else               { run = 5; rest = 2; quality = 1 }
    // 5k/10k modifier: +1 quality, cap run days at 6
    quality += 1
    if (run > 6) { run = 6; rest += 1 }
  } else {
    // Mileage fallback (ultra, no goal time, unknown distance)
    if (weeklyMileageRange === "under-40")     { run = 5; rest = 2; quality = 1 }
    else if (weeklyMileageRange === "40-60")   { run = 6; rest = 1; quality = 1 }
    else if (weeklyMileageRange === "60-80")   { run = 6; rest = 1; quality = 2 }
    else if (weeklyMileageRange === "80-plus") { run = 7; rest = 0; quality = 2 }
    else                                        { run = 5; rest = 2; quality = 1 }
  }


  // selectedDaysCount clamp — restDaysPerWeek is NOT adjusted
  run = Math.min(run, selectedDaysCount)
  // restDaysPerWeek is intentionally not adjusted: rest placement is the LLM's responsibility given the available day count

  return { runDaysPerWeek: run, restDaysPerWeek: rest, maxQualitySessions: quality }
}

/**
 * Derive Pfitzinger-based long run targets from race distance and peak weekly
 * volume. Used to inject hard constraints into the LLM prompt.
 *
 * peakWeeklyKm is the output of computeGoalPeakMileage (already called in
 * buildPrompt). When null (no goal time), falls back to the mid-range row for
 * each distance. recoveryRunMaxKm is NOT modified by training age.
 */
export function computeLongRunTargets(
  distance: string,
  peakWeeklyKm: { low: number; high: number } | null,
): { peakLongRunKm: number; recoveryRunMaxKm: number } {
  let peakLongRunKm: number
  let recoveryRunMaxKm: number

  const high = peakWeeklyKm?.high ?? null

  if (distance === "full") {
    if (high === null)    { peakLongRunKm = 35; recoveryRunMaxKm = 13 }
    else if (high < 65)  { peakLongRunKm = 29; recoveryRunMaxKm = 11 }
    else if (high < 90)  { peakLongRunKm = 35; recoveryRunMaxKm = 13 }
    // spec has two rows here (< 116 and >= 116) but both share the same targets —
    // the Pfitz 18/70 ceiling (38 km / 16 km) applies at all volumes above 90 km/week
    else                 { peakLongRunKm = 38; recoveryRunMaxKm = 16 }
  } else if (distance === "half") {
    if (high === null)    { peakLongRunKm = 22; recoveryRunMaxKm = 11 }
    else if (high < 50)  { peakLongRunKm = 19; recoveryRunMaxKm = 9  }
    else if (high < 75)  { peakLongRunKm = 22; recoveryRunMaxKm = 11 }
    else                 { peakLongRunKm = 26; recoveryRunMaxKm = 13 }
  } else if (distance === "5k" || distance === "10k") {
    if (high === null)    { peakLongRunKm = 13; recoveryRunMaxKm = 8  }
    else if (high < 45)  { peakLongRunKm = 11; recoveryRunMaxKm = 7  }
    else if (high < 65)  { peakLongRunKm = 13; recoveryRunMaxKm = 8  }
    else                 { peakLongRunKm = 16; recoveryRunMaxKm = 10 }
  } else if (distance === "ultra") {
    peakLongRunKm = 32; recoveryRunMaxKm = 14
  } else {
    // Unknown distance: mid-range full marathon defaults
    peakLongRunKm = 29; recoveryRunMaxKm = 11
  }


  return { peakLongRunKm, recoveryRunMaxKm }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/zackdorward/dev/athlos && pnpm --filter @workspace/plan-engine test
```

Expected: all tests pass, including the new `training-parameters.test.ts` suite.

- [ ] **Step 5: Commit**

```bash
cd /Users/zackdorward/dev/athlos
git add packages/plan-engine/src/training-parameters.ts packages/plan-engine/src/training-parameters.test.ts
git commit -m "refactor: extract training parameters to training-parameters.ts"
```

---

### Task 3: Clean up — trim old file, update index

**Files:**
- Modify: `packages/plan-engine/src/pace-calculator.ts`
- Modify: `packages/plan-engine/src/pace-calculator.test.ts`
- Modify: `packages/plan-engine/src/index.ts`

- [ ] **Step 1: Trim `pace-calculator.ts`**

Replace the entire contents of `packages/plan-engine/src/pace-calculator.ts` with the content below. This is exactly the original file's lines 2–99 (pace math) and lines 237–251 (`calculateRawGoalPace`) — the original line 1 (`import type { PhaseEntry, WeeklyMileageRange } from "./types"`) is dropped because nothing in this file needed it after the move; `PaceInput` and `PaceZones` are defined inline with no imports:

```ts
export interface PaceInput {
  hours: number
  minutes: number
  seconds: number
  distance: "5k" | "10k" | "half" | "full"
  context?: "active" | "short-break" | "long-break"
}

export interface PaceZones {
  easy: string       // e.g. "6:06–6:36/km"
  longRun: string
  mediumLong: string
  mp: string
  threshold: string
  vo2max: string
  source: "recent-race" | "goal-time"
}

const DISTANCE_KM: Record<"5k" | "10k" | "half" | "full", number> = {
  "5k": 5,
  "10k": 10,
  half: 21.0975,
  full: 42.195,
}

const CONTEXT_MULTIPLIER: Record<string, number> = {
  active: 1.0,
  "short-break": 1.05,
  "long-break": 1.12,
}

// Zone [lowerMultiplier, upperMultiplier] of 5K pace.
// Lower multiplier = faster pace (fewer seconds/km) = listed first in the range.
const ZONES = {
  vo2max:     [0.98, 1.02],
  threshold:  [1.06, 1.10],
  mp:         [1.13, 1.20],
  mediumLong: [1.20, 1.25],
  longRun:    [1.25, 1.33],
  easy:       [1.34, 1.45],
} as const

/** Format total seconds as "M:SS" */
function formatPace(secPerKm: number): string {
  const total = Math.round(secPerKm)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

/** Format a zone as "fastPace–slowPace/km" */
function formatZone(lo: number, hi: number, refSecPerKm: number): string {
  return `${formatPace(refSecPerKm * lo)}–${formatPace(refSecPerKm * hi)}/km`
}

/**
 * Calculate pace zones from a race result or goal time.
 *
 * Returns null if input is invalid (zero time or impossibly fast pace).
 * Caller should fall back to goal time with 5% buffer when null is returned.
 */
export function calculatePaceZones(
  input: PaceInput,
  source: "recent-race" | "goal-time"
): PaceZones | null {
  const distKm = DISTANCE_KM[input.distance]
  if (!distKm) return null

  const totalSec = input.hours * 3600 + input.minutes * 60 + input.seconds
  if (totalSec <= 0) return null

  // Apply 5% conservative buffer for goal times (aspirational → realistic)
  const adjustedSec = source === "goal-time" ? totalSec * 1.05 : totalSec

  // Riegel formula: T_5k = T_input × (5 / D_km)^1.06
  const t5kSec = adjustedSec * Math.pow(5 / distKm, 1.06)
  let ref = t5kSec / 5  // seconds per km at 5K equivalent pace

  // Guard: reject impossibly fast paces (< 2:00/km = 120 s/km)
  if (ref < 120) return null

  // Apply fitness context multiplier (recent-race only; goal-time already has the buffer)
  if (source === "recent-race") {
    const ctx = input.context ?? "active"
    ref *= CONTEXT_MULTIPLIER[ctx] ?? 1.0
  }

  return {
    vo2max:     formatZone(...ZONES.vo2max, ref),
    threshold:  formatZone(...ZONES.threshold, ref),
    mp:         formatZone(...ZONES.mp, ref),
    mediumLong: formatZone(...ZONES.mediumLong, ref),
    longRun:    formatZone(...ZONES.longRun, ref),
    easy:       formatZone(...ZONES.easy, ref),
    source,
  }
}

/**
 * Calculate the raw goal race pace (mp zone only) from a goal time.
 * Unlike calculatePaceZones, this does NOT apply the 5% training buffer —
 * it returns the actual target race pace the athlete is training toward.
 *
 * Returns null if input is invalid (zero time or impossibly fast pace).
 */
export function calculateRawGoalPace(input: PaceInput): string | null {
  const distKm = DISTANCE_KM[input.distance]
  if (!distKm) return null

  const totalSec = input.hours * 3600 + input.minutes * 60 + input.seconds
  if (totalSec <= 0) return null

  // Riegel formula — no buffer
  const t5kSec = totalSec * Math.pow(5 / distKm, 1.06)
  const ref = t5kSec / 5

  if (ref < 120) return null

  return formatZone(...ZONES.mp, ref)
}
```

```ts
export interface PaceInput {
  hours: number
  minutes: number
  seconds: number
  distance: "5k" | "10k" | "half" | "full"
  context?: "active" | "short-break" | "long-break"
}

export interface PaceZones {
  easy: string       // e.g. "6:06–6:36/km"
  longRun: string
  mediumLong: string
  mp: string
  threshold: string
  vo2max: string
  source: "recent-race" | "goal-time"
}

const DISTANCE_KM: Record<"5k" | "10k" | "half" | "full", number> = {
  "5k": 5,
  "10k": 10,
  half: 21.0975,
  full: 42.195,
}

const CONTEXT_MULTIPLIER: Record<string, number> = {
  active: 1.0,
  "short-break": 1.05,
  "long-break": 1.12,
}

// Zone [lowerMultiplier, upperMultiplier] of 5K pace.
// Lower multiplier = faster pace (fewer seconds/km) = listed first in the range.
const ZONES = {
  vo2max:     [0.98, 1.02],
  threshold:  [1.06, 1.10],
  mp:         [1.13, 1.20],
  mediumLong: [1.20, 1.25],
  longRun:    [1.25, 1.33],
  easy:       [1.34, 1.45],
} as const

/** Format total seconds as "M:SS" */
function formatPace(secPerKm: number): string {
  const total = Math.round(secPerKm)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

/** Format a zone as "fastPace–slowPace/km" */
function formatZone(lo: number, hi: number, refSecPerKm: number): string {
  return `${formatPace(refSecPerKm * lo)}–${formatPace(refSecPerKm * hi)}/km`
}

/**
 * Calculate pace zones from a race result or goal time.
 *
 * Returns null if input is invalid (zero time or impossibly fast pace).
 * Caller should fall back to goal time with 5% buffer when null is returned.
 */
export function calculatePaceZones(
  input: PaceInput,
  source: "recent-race" | "goal-time"
): PaceZones | null {
  const distKm = DISTANCE_KM[input.distance]
  if (!distKm) return null

  const totalSec = input.hours * 3600 + input.minutes * 60 + input.seconds
  if (totalSec <= 0) return null

  // Apply 5% conservative buffer for goal times (aspirational → realistic)
  const adjustedSec = source === "goal-time" ? totalSec * 1.05 : totalSec

  // Riegel formula: T_5k = T_input × (5 / D_km)^1.06
  const t5kSec = adjustedSec * Math.pow(5 / distKm, 1.06)
  let ref = t5kSec / 5  // seconds per km at 5K equivalent pace

  // Guard: reject impossibly fast paces (< 2:00/km = 120 s/km)
  if (ref < 120) return null

  // Apply fitness context multiplier (recent-race only; goal-time already has the buffer)
  if (source === "recent-race") {
    const ctx = input.context ?? "active"
    ref *= CONTEXT_MULTIPLIER[ctx] ?? 1.0
  }

  return {
    vo2max:     formatZone(...ZONES.vo2max, ref),
    threshold:  formatZone(...ZONES.threshold, ref),
    mp:         formatZone(...ZONES.mp, ref),
    mediumLong: formatZone(...ZONES.mediumLong, ref),
    longRun:    formatZone(...ZONES.longRun, ref),
    easy:       formatZone(...ZONES.easy, ref),
    source,
  }
}

/**
 * Calculate the raw goal race pace (mp zone only) from a goal time.
 * Unlike calculatePaceZones, this does NOT apply the 5% training buffer —
 * it returns the actual target race pace the athlete is training toward.
 *
 * Returns null if input is invalid (zero time or impossibly fast pace).
 */
export function calculateRawGoalPace(input: PaceInput): string | null {
  const distKm = DISTANCE_KM[input.distance]
  if (!distKm) return null

  const totalSec = input.hours * 3600 + input.minutes * 60 + input.seconds
  if (totalSec <= 0) return null

  // Riegel formula — no buffer
  const t5kSec = totalSec * Math.pow(5 / distKm, 1.06)
  const ref = t5kSec / 5

  if (ref < 120) return null

  return formatZone(...ZONES.mp, ref)
}
```

- [ ] **Step 2: Update `pace-calculator.test.ts`**

Replace the import line (line 2) and remove the describe blocks for `computePhases`, `computeGoalPeakMileage`, `computeTrainingStructure`, and `computeLongRunTargets`. The updated import:

```ts
import { calculatePaceZones, calculateRawGoalPace } from "./pace-calculator"
```

Keep all `calculatePaceZones` describe blocks, the `calculateRawGoalPace` describe block, and the `calculatePaceZones — slow runner (no zone overlap)` describe block. Remove everything else. The `loSec` helper at the top stays.

The final `pace-calculator.test.ts` contains exactly these describe blocks (in file order):
1. `calculatePaceZones — recent race, active`
2. `calculatePaceZones — context multipliers`
3. `calculatePaceZones — goal time`
4. `calculatePaceZones — invalid input`
5. `calculateRawGoalPace`
6. `calculatePaceZones — slow runner (no zone overlap)`

- [ ] **Step 3: Update `index.ts`**

Replace the single `from "./pace-calculator"` export block with three import sources:

```ts
export { calculatePaceZones, calculateRawGoalPace, type PaceZones } from "./pace-calculator"
export { computePhases } from "./phase-planner"
export {
  computeGoalPeakMileage,
  computeTrainingStructure,
  computeLongRunTargets,
} from "./training-parameters"
```

The rest of `index.ts` is unchanged.

- [ ] **Step 4: Run the full test suite**

```bash
cd /Users/zackdorward/dev/athlos && pnpm --filter @workspace/plan-engine test
```

Expected: all tests pass. Count should be the same as before the split — no tests were added or removed, only moved.

- [ ] **Step 5: Commit**

```bash
cd /Users/zackdorward/dev/athlos
git add packages/plan-engine/src/pace-calculator.ts \
        packages/plan-engine/src/pace-calculator.test.ts \
        packages/plan-engine/src/index.ts
git commit -m "refactor: remove moved code from pace-calculator.ts, update index imports"
```
