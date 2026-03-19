# Plan Engine First-Timer Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix broken long run caps for low-mileage runners, add first-timer awareness via a PlanConstraints layer, add strength training opt-out, and add two new onboarding steps.

**Architecture:** A new `computeConstraints()` function centralises all plan guardrails (long run fraction, quality session limits, interval permission, strength inclusion, feasibility warnings) into a `PlanConstraints` object that flows through the scheduler pipeline. Two new onboarding steps (`step-first-at-distance`, `step-include-strength`) capture `isFirstAtDistance` and `includeStrength` which are forwarded to the API and consumed by `computeConstraints()`.

**Tech Stack:** TypeScript, Next.js 16 App Router, vitest (plan-engine tests), React 19, Tailwind CSS v4.

---

## File Map

| Action | Path | What changes |
|--------|------|-------------|
| Modify | `packages/plan-engine/src/constants.ts` | Delete `STARTING_VOLUME_KM` |
| Modify | `packages/plan-engine/src/volume-progression.ts` | Export `WEEK1_VOLUME_KM` |
| Modify | `packages/plan-engine/src/bridge-runs.ts` | Import from `volume-progression` instead of `constants` |
| Modify | `packages/plan-engine/src/types.ts` | Add `isFirstAtDistance`, `includeStrength` to `PlanGenerationInput` |
| Create | `packages/plan-engine/src/constraints.ts` | `PlanConstraints` interface + `computeConstraints()` |
| Create | `packages/plan-engine/src/constraints.test.ts` | Tests for `computeConstraints()` |
| Modify | `packages/plan-engine/src/workout-scheduler.ts` | Add `constraints` to `SchedulerInput`; replace hardcoded `0.35`, strength/interval guards |
| Modify | `packages/plan-engine/src/workout-scheduler.test.ts` | Pass `constraints` in test fixtures |
| Create | `packages/plan-engine/src/workout-placement.ts` | Extracted placement helpers (quality, easy, strength) |
| Modify | `packages/plan-engine/src/index.ts` | Export `PlanConstraints`, `computeConstraints` |
| Modify | `apps/web/app/api/generate-plan/route.ts` | Call `computeConstraints()`; pass to scheduler; return `feasibilityWarning` |
| Modify | `apps/web/app/api/generate-plan/route.test.ts` | Update `validInput`; add first-timer test cases |
| Modify | `apps/web/components/onboarding/types.ts` | Add fields to `OnboardingData`; update `getSteps()` |
| Modify | `apps/web/components/onboarding/onboarding-flow.tsx` | Add `STEP_LABELS` entries; update `renderStep()` |
| Create | `apps/web/components/onboarding/steps/step-first-at-distance.tsx` | New onboarding step |
| Create | `apps/web/components/onboarding/steps/step-include-strength.tsx` | New onboarding step |
| Delete | `apps/web/components/onboarding/steps/step-long-run-day.tsx` | Unused |
| Delete | `apps/web/components/onboarding/steps/step-time-goal.tsx` | Unused |
| Modify | `apps/web/app/plan/page.tsx` (or plan display component) | Render `feasibilityWarning` if present |

---

## Task 1: Consolidate the starting volume constant

**Files:**
- Modify: `packages/plan-engine/src/volume-progression.ts`
- Modify: `packages/plan-engine/src/bridge-runs.ts`
- Modify: `packages/plan-engine/src/constants.ts`

`STARTING_VOLUME_KM` in `constants.ts` (30/50/70/90) diverges from `WEEK1_VOLUME_KM` in `volume-progression.ts` (30/40/60/80). `WEEK1_VOLUME_KM` is the operational source used by `computeWeeklyVolumes`. Consolidate to a single export.

- [ ] **Step 1: Export `WEEK1_VOLUME_KM` from `volume-progression.ts`**

In `packages/plan-engine/src/volume-progression.ts`, change the declaration from:
```ts
const WEEK1_VOLUME_KM: Record<WeeklyMileageRange, number> = {
```
to:
```ts
export const WEEK1_VOLUME_KM: Record<WeeklyMileageRange, number> = {
```

- [ ] **Step 2: Update `bridge-runs.ts` to import from `volume-progression` and gate strength on `includeStrength`**

Change the import:
```ts
import { STARTING_VOLUME_KM } from "./constants"
```
to:
```ts
import { WEEK1_VOLUME_KM } from "./volume-progression"
```

Update the single `STARTING_VOLUME_KM` usage on line ~71:
```ts
: Math.round((WEEK1_VOLUME_KM[input.weeklyMileageRange] ?? 50) / input.selectedDays.length)
```

Gate the strength block (lines ~104–118) on `input.includeStrength`. Find:
```ts
// Add strength training on easy-run days (2 per week, furthest from long run, non-consecutive)
const easyEntries = results.filter(r => r.type === "easy")
if (easyEntries.length > 0) {
```
Replace with:
```ts
// Add strength training on easy-run days, only if the plan includes strength
const easyEntries = results.filter(r => r.type === "easy")
if (easyEntries.length > 0 && input.includeStrength) {
```

- [ ] **Step 3: Empty `constants.ts`**

Replace the entire contents of `packages/plan-engine/src/constants.ts` with an empty file (just a blank line). The file stays so import paths don't break if anything references it externally, but `STARTING_VOLUME_KM` is gone.

- [ ] **Step 4: Run tests to confirm nothing broke**

```bash
cd packages/plan-engine && pnpm test
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/plan-engine/src/volume-progression.ts \
        packages/plan-engine/src/bridge-runs.ts \
        packages/plan-engine/src/constants.ts
git commit -m "refactor: consolidate STARTING_VOLUME_KM into WEEK1_VOLUME_KM"
```

---

## Task 2: Add `isFirstAtDistance` and `includeStrength` to plan engine types

**Files:**
- Modify: `packages/plan-engine/src/types.ts`

- [ ] **Step 1: Add fields to `PlanGenerationInput`**

In `packages/plan-engine/src/types.ts`, add two required fields to `PlanGenerationInput`:

```ts
export interface PlanGenerationInput {
  goal: "race"
  race: {
    name: string
    date: string
    distance: "half" | "full"
    city: string
  }
  goalTime?: { hours: number; minutes: number; seconds?: number }
  selectedDays: string[]
  longRunDay: string
  units: "km" | "miles"
  startDate?: string
  weeklyMileageRange: WeeklyMileageRange
  today?: string
  isFirstAtDistance: boolean   // ← new
  includeStrength: boolean     // ← new
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```
Expected: errors only at the API route call sites that don't yet pass the new fields. Note the error locations — they'll be fixed in Task 5.

- [ ] **Step 3: Commit**

```bash
git add packages/plan-engine/src/types.ts
git commit -m "feat(types): add isFirstAtDistance and includeStrength to PlanGenerationInput"
```

---

## Task 3: Create `constraints.ts` — the PlanConstraints layer

**Files:**
- Create: `packages/plan-engine/src/constraints.test.ts`
- Create: `packages/plan-engine/src/constraints.ts`
- Modify: `packages/plan-engine/src/index.ts`

### Step 1–4: Write the tests first (TDD)

- [ ] **Step 1: Write `constraints.test.ts`**

Create `packages/plan-engine/src/constraints.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { computeConstraints } from "./constraints"

const base = {
  distance: "full" as const,
  weeklyMileageRange: "40-60" as const,
  totalWeeks: 20,
  goalMinutes: 210,       // 3:30 marathon
  selectedDaysCount: 5,
  isFirstAtDistance: false,
  includeStrength: true,
}

describe("computeConstraints", () => {
  describe("longRunMaxFraction", () => {
    it("is 0.40 for full marathon", () => {
      const c = computeConstraints({ ...base, distance: "full" })
      expect(c.longRunMaxFraction).toBe(0.40)
    })

    it("is 0.38 for half marathon", () => {
      const c = computeConstraints({ ...base, distance: "half" })
      expect(c.longRunMaxFraction).toBe(0.38)
    })
  })

  describe("first-timer constraints", () => {
    it("sets maxQualitySessions to 1 regardless of goal time", () => {
      const c = computeConstraints({ ...base, isFirstAtDistance: true, goalMinutes: 150 })
      expect(c.maxQualitySessions).toBe(1)
    })

    it("sets allowIntervals to false", () => {
      const c = computeConstraints({ ...base, isFirstAtDistance: true })
      expect(c.allowIntervals).toBe(false)
    })

    it("sets allowIntervals to true for experienced runner", () => {
      const c = computeConstraints({ ...base, isFirstAtDistance: false })
      expect(c.allowIntervals).toBe(true)
    })

    it("uses slower ramp rate (0.08) for first-timers", () => {
      const c = computeConstraints({ ...base, isFirstAtDistance: true })
      expect(c.rampRatePerWeek).toBe(0.08)
    })

    it("uses standard ramp rate (0.10) for experienced runners", () => {
      const c = computeConstraints({ ...base, isFirstAtDistance: false })
      expect(c.rampRatePerWeek).toBe(0.10)
    })
  })

  describe("minimumPlanWeeks", () => {
    it("is 16 for first-timer full marathon", () => {
      const c = computeConstraints({ ...base, isFirstAtDistance: true, distance: "full" })
      expect(c.minimumPlanWeeks).toBe(16)
    })

    it("is 12 for first-timer half marathon", () => {
      const c = computeConstraints({ ...base, isFirstAtDistance: true, distance: "half" })
      expect(c.minimumPlanWeeks).toBe(12)
    })

    it("is 8 for experienced runner", () => {
      const c = computeConstraints({ ...base, isFirstAtDistance: false })
      expect(c.minimumPlanWeeks).toBe(8)
    })
  })

  describe("peakWeeklyKm — achievable clamping", () => {
    it("clamps to achievable peak when ramp cannot reach aspirational", () => {
      // under-40 bracket starts at 30 km/week, 0.10 ramp, 5 pre-taper weeks
      // achievable = 30 * 1.1^5 ≈ 48.3 km — far below goal-time-derived ~80 km
      const c = computeConstraints({
        ...base,
        weeklyMileageRange: "under-40",
        totalWeeks: 8,
        goalMinutes: 210,         // would prescribe 80–100 km peak
        isFirstAtDistance: false,
      })
      const achievable = 30 * Math.pow(1.10, 5)
      expect(c.peakWeeklyKm).toBeCloseTo(achievable, 0)
    })

    it("does not clamp when plan is long enough to reach goal peak", () => {
      // 40-60 bracket starts 40 km, 0.10 ramp, 17 pre-taper weeks (20 - 3)
      // achievable = 40 * 1.1^17 ≈ 194 — above aspirational 100 km, so no clamp
      // computeGoalPeakMileage("full", 210) = { low: 80, high: 100 }
      const c = computeConstraints({
        ...base,
        weeklyMileageRange: "40-60",
        totalWeeks: 20,
        goalMinutes: 210,
      })
      expect(c.peakWeeklyKm).toBe(100)   // aspirational high, not clamped
    })
  })

  describe("includeStrength", () => {
    it("passes through false", () => {
      const c = computeConstraints({ ...base, includeStrength: false })
      expect(c.includeStrength).toBe(false)
    })

    it("passes through true", () => {
      const c = computeConstraints({ ...base, includeStrength: true })
      expect(c.includeStrength).toBe(true)
    })
  })

  describe("feasibilityWarning", () => {
    it("warns when totalWeeks < minimumPlanWeeks for first-timer full marathon", () => {
      const c = computeConstraints({
        ...base,
        isFirstAtDistance: true,
        totalWeeks: 10,   // below 16
      })
      expect(c.feasibilityWarning).toMatch(/16 weeks/)
    })

    it("warns when achievable long run is below 26 km for full marathon", () => {
      // under-40 starts 30 km, 0.08 first-timer ramp, 5 pre-taper weeks
      // achievable = 30 * 1.08^5 ≈ 44 km; long run = 44 * 0.40 ≈ 17.6 km < 26
      const c = computeConstraints({
        ...base,
        isFirstAtDistance: true,
        weeklyMileageRange: "under-40",
        totalWeeks: 8,
      })
      expect(c.feasibilityWarning).toMatch(/Long run/)
    })

    it("returns null for a sound plan", () => {
      // 40-60 bracket, experienced, 20 weeks — easily achievable
      const c = computeConstraints({ ...base })
      expect(c.feasibilityWarning).toBeNull()
    })

    it("can produce both warnings simultaneously", () => {
      const c = computeConstraints({
        ...base,
        isFirstAtDistance: true,
        weeklyMileageRange: "under-40",
        totalWeeks: 6,  // below 16 AND too short for long runs
      })
      expect(c.feasibilityWarning).toContain("weeks")
      expect(c.feasibilityWarning).toContain("Long run")
    })
  })
})
```

- [ ] **Step 2: Run tests — expect them to fail (module not found)**

```bash
cd packages/plan-engine && pnpm test
```
Expected: FAIL — `constraints.ts` does not exist yet.

- [ ] **Step 3: Implement `constraints.ts`**

Create `packages/plan-engine/src/constraints.ts`:

```ts
import { computeGoalPeakMileage, computeTrainingStructure, computeLongRunTargets } from "./training-parameters"
import { WEEK1_VOLUME_KM } from "./volume-progression"
import type { WeeklyMileageRange } from "./types"

const MILEAGE_RANGE_HIGH: Record<WeeklyMileageRange, number> = {
  "under-40": 40,
  "40-60":    60,
  "60-80":    80,
  "80-plus":  120,
}

export interface ConstraintsInput {
  distance: "half" | "full"
  weeklyMileageRange: WeeklyMileageRange
  totalWeeks: number
  goalMinutes: number | null
  selectedDaysCount: number         // needed for computeTrainingStructure — do NOT hardcode 7
  isFirstAtDistance: boolean
  includeStrength: boolean
}

export interface PlanConstraints {
  // Volume
  startingVolumeKm: number
  peakWeeklyKm: number
  rampRatePerWeek: number
  // Long run
  peakLongRunKm: number
  longRunMaxFraction: number
  // Quality
  maxQualitySessions: number
  allowIntervals: boolean
  // Strength
  includeStrength: boolean
  // Guardrails
  minimumPlanWeeks: number
  feasibilityWarning: string | null
}

export function computeConstraints(input: ConstraintsInput): PlanConstraints {
  const { distance, weeklyMileageRange, totalWeeks, goalMinutes, selectedDaysCount, isFirstAtDistance, includeStrength } = input

  const startingVolumeKm = WEEK1_VOLUME_KM[weeklyMileageRange]
  const rampRatePerWeek = isFirstAtDistance ? 0.08 : 0.10

  // Aspirational peak from goal time, or mileage bracket high as fallback
  const goalPeakMileage = goalMinutes ? computeGoalPeakMileage(distance, goalMinutes) : null
  const aspirationalPeakKm = goalPeakMileage?.high ?? MILEAGE_RANGE_HIGH[weeklyMileageRange]

  // Achievable peak: compound growth from starting volume over pre-taper weeks
  const preTaperWeeks = Math.max(1, totalWeeks - 3)
  const achievablePeakKm = startingVolumeKm * Math.pow(1 + rampRatePerWeek, preTaperWeeks)
  const peakWeeklyKm = Math.min(aspirationalPeakKm, achievablePeakKm)

  // Long run targets from achievable peak
  const longRunTargets = computeLongRunTargets(distance, { low: peakWeeklyKm * 0.85, high: peakWeeklyKm })
  const peakLongRunKm = longRunTargets.peakLongRunKm
  const longRunMaxFraction = distance === "half" ? 0.38 : 0.40   // "full" is the only other valid value

  // Quality session limits — use selectedDaysCount so the cap reflects available days
  const trainingStructure = computeTrainingStructure(goalMinutes, distance, selectedDaysCount, weeklyMileageRange)
  const maxQualitySessions = isFirstAtDistance ? 1 : trainingStructure.maxQualitySessions
  const allowIntervals = !isFirstAtDistance

  // Minimum plan length guardrail
  const minimumPlanWeeks = isFirstAtDistance
    ? (distance === "full" ? 16 : 12)
    : 8

  // Feasibility warnings
  const achievableLongRunKm = achievablePeakKm * longRunMaxFraction
  const warnings: string[] = []

  if (totalWeeks < minimumPlanWeeks) {
    const label = distance === "full" ? "marathon" : "half marathon"
    warnings.push(
      `Not enough weeks — ${label} preparation requires at least ${minimumPlanWeeks} weeks`
    )
  }

  if (distance === "full" && achievableLongRunKm < 26) {
    warnings.push(
      `Long run will only reach ~${Math.round(achievableLongRunKm)} km — consider a later race or higher starting mileage`
    )
  } else if (distance === "half" && achievableLongRunKm < 16) {
    warnings.push(
      `Long run will only reach ~${Math.round(achievableLongRunKm)} km — consider a later race or higher starting mileage`
    )
  }

  return {
    startingVolumeKm,
    peakWeeklyKm,
    rampRatePerWeek,
    peakLongRunKm,
    longRunMaxFraction,
    maxQualitySessions,
    allowIntervals,
    includeStrength,
    minimumPlanWeeks,
    feasibilityWarning: warnings.length > 0 ? warnings.join(". ") : null,
  }
}
```

- [ ] **Step 4: Run tests — expect all to pass**

```bash
cd packages/plan-engine && pnpm test
```
Expected: all tests in `constraints.test.ts` pass.

- [ ] **Step 5: Export from `index.ts`**

Add to `packages/plan-engine/src/index.ts`:
```ts
export { computeConstraints, type PlanConstraints, type ConstraintsInput } from "./constraints"
```

- [ ] **Step 6: Run typecheck**

```bash
pnpm typecheck
```
Expected: passes.

- [ ] **Step 7: Commit**

```bash
git add packages/plan-engine/src/constraints.ts \
        packages/plan-engine/src/constraints.test.ts \
        packages/plan-engine/src/index.ts
git commit -m "feat(plan-engine): add PlanConstraints layer with computeConstraints()"
```

---

## Task 4: Wire `PlanConstraints` into `workout-scheduler`

**Files:**
- Modify: `packages/plan-engine/src/workout-scheduler.ts`
- Modify: `packages/plan-engine/src/workout-scheduler.test.ts`

`SchedulerInput` gains `constraints: PlanConstraints`. The hardcoded `0.35` long run fraction is replaced. Quality, strength, and interval placement read from `constraints`.

- [ ] **Step 1: Add `constraints` to `SchedulerInput` and update type**

In `packages/plan-engine/src/workout-scheduler.ts`, add to the imports at top:
```ts
import type { PlanConstraints } from "./constraints"
```

Update `SchedulerInput`:
```ts
export interface SchedulerInput {
  startDate: string
  selectedDays: string[]
  longRunDay: string
  weeklyMileageRange: WeeklyMileageRange
  phases: PhaseEntry[]
  totalWeeks: number
  peakWeeklyKm: number
  trainingStructure: TrainingStructure
  longRunTargets: LongRunTargets        // keep for now — peakLongRunKm sourced from constraints below
  paceZones: PaceZones
  raceDateISO?: string
  constraints: PlanConstraints         // ← new
}
```

- [ ] **Step 2: Replace hardcoded `0.35` with `constraints.longRunMaxFraction`**

Find line ~251:
```ts
const longRunKm = round05(Math.min(rawLongKm, weeklyKm * 0.35))
```
Replace with:
```ts
const longRunKm = round05(Math.min(rawLongKm, weeklyKm * constraints.longRunMaxFraction))
```

Also update the destructure at the top of `scheduleWorkouts` to include `constraints`:
```ts
const {
  startDate, selectedDays, longRunDay, phases, totalWeeks,
  peakWeeklyKm, trainingStructure, longRunTargets, paceZones, constraints,
} = input
```

- [ ] **Step 3: Cap quality sessions from `constraints.maxQualitySessions`**

Find line ~263:
```ts
const count = Math.min(sessions, trainingStructure.maxQualitySessions)
```
Replace with:
```ts
const count = Math.min(sessions, constraints.maxQualitySessions)
```

- [ ] **Step 4: Filter intervals when `constraints.allowIntervals === false`**

The quality type loop (lines ~266–301) picks session types from `types[i]`. Add a filter before the loop:

```ts
const allowedTypes = types.filter(t => t !== "intervals" || constraints.allowIntervals)
const count = Math.min(allowedTypes.length > 0 ? sessions : 0, constraints.maxQualitySessions)
```

Then use `allowedTypes[i]` instead of `types[i]` inside the loop:
```ts
const type = allowedTypes[i]!
```

- [ ] **Step 5: Skip strength placement when `constraints.includeStrength === false`**

Find the strength placement block (step 4, ~line 331):
```ts
if (sCount > 0) {
```
Replace with:
```ts
if (sCount > 0 && constraints.includeStrength) {
```

- [ ] **Step 6: Update `workout-scheduler.test.ts` to supply `constraints`**

In the `baseInput` fixture, add a minimal `constraints` field:
```ts
import type { PlanConstraints } from "./constraints"

const baseConstraints: PlanConstraints = {
  startingVolumeKm: 40,
  peakWeeklyKm: 60,
  rampRatePerWeek: 0.10,
  peakLongRunKm: 30,
  longRunMaxFraction: 0.40,
  maxQualitySessions: 1,
  allowIntervals: true,
  includeStrength: true,
  minimumPlanWeeks: 8,
  feasibilityWarning: null,
}

const baseInput = {
  // ... existing fields ...
  constraints: baseConstraints,
}
```

- [ ] **Step 7: Run tests**

```bash
cd packages/plan-engine && pnpm test
```
Expected: all tests pass, including the long run tests (long run distances should now be higher for marathon since fraction is 0.40 not 0.35).

- [ ] **Step 8: Commit**

```bash
git add packages/plan-engine/src/workout-scheduler.ts \
        packages/plan-engine/src/workout-scheduler.test.ts
git commit -m "feat(scheduler): consume PlanConstraints for long run cap, quality, strength, intervals"
```

---

## Task 5: Wire constraints into `route.ts` and return `feasibilityWarning`

**Files:**
- Modify: `apps/web/app/api/generate-plan/route.ts`
- Modify: `apps/web/app/api/generate-plan/route.test.ts`

- [ ] **Step 1: Import `computeConstraints` and update the import from `@workspace/plan-engine`**

In `route.ts`, update the import:
```ts
import {
  type PlanGenerationInput,
  calculatePaceZones,
  computePhases,
  computeGoalPeakMileage,
  computeTrainingStructure,
  computeLongRunTargets,
  computeWeeklyVolumes,
  scheduleWorkouts,
  buildBridgeRuns,
  firstMondayOnOrAfter,
  computeConstraints,           // ← new
} from "@workspace/plan-engine"
```

Remove the local `MILEAGE_RANGE_HIGH` constant (it now lives inside `constraints.ts`). The `MILEAGE_RANGE_LOW` constant stays — it's used for the starting volume guard.

- [ ] **Step 2: Call `computeConstraints()` early in the handler, after `goalMinutes` is derived**

After the `goalMinutes` derivation (line ~67), add:

```ts
const constraints = computeConstraints({
  distance: input.race.distance,
  weeklyMileageRange: input.weeklyMileageRange,
  totalWeeks,
  goalMinutes,
  selectedDaysCount: input.selectedDays.length,
  isFirstAtDistance: input.isFirstAtDistance,
  includeStrength: input.includeStrength,
})

// Use achievable peak from constraints (may be clamped below aspirational)
const peakWeeklyKm = constraints.peakWeeklyKm
```

Remove the old `peakWeeklyKm` derivation lines (~70–73):
```ts
// DELETE these lines:
const peakMileage = goalMinutes ? computeGoalPeakMileage(input.race.distance, goalMinutes) : null
const peakWeeklyKm = peakMileage?.high ?? MILEAGE_RANGE_HIGH[input.weeklyMileageRange] ?? 60
```

Keep the starting volume guard but update it to use `constraints.startingVolumeKm`:
```ts
if (constraints.startingVolumeKm > peakWeeklyKm) {
  return Response.json({ error: "Starting volume exceeds peak weekly km" }, { status: 400 })
}
```

- [ ] **Step 3: Pass `constraints` to `scheduleWorkouts`**

Update the `scheduleWorkouts` call to include `constraints`:
```ts
const days = scheduleWorkouts({
  startDate: startDate.toISOString().slice(0, 10),
  selectedDays: input.selectedDays,
  longRunDay: input.longRunDay,
  weeklyMileageRange: input.weeklyMileageRange,
  phases,
  totalWeeks,
  peakWeeklyKm,
  trainingStructure,
  longRunTargets,
  paceZones,
  raceDateISO: input.race.date,
  constraints,                    // ← new
})
```

- [ ] **Step 4: Include `feasibilityWarning` in the response**

Change the final return:
```ts
return Response.json({
  days: finalDays,
  planStartDate,
  totalWeeks,
  totalKm,
  peakWeekKm,
  phases,
  feasibilityWarning: constraints.feasibilityWarning,   // ← new
})
```

- [ ] **Step 5: Update `route.test.ts` — add `isFirstAtDistance` and `includeStrength` to `validInput`**

```ts
const validInput = {
  goal: "race",
  race: { name: "Test Marathon", date: "2027-04-01", distance: "full", city: "Test City" },
  goalTime: { hours: 3, minutes: 30, seconds: 0 },
  selectedDays: ["mon", "wed", "fri", "sat"],
  longRunDay: "sat",
  units: "km",
  weeklyMileageRange: "40-60",
  isFirstAtDistance: false,     // ← new
  includeStrength: true,        // ← new
}
```

- [ ] **Step 6: Add a test for first-timer plan shape**

In `route.test.ts`, add:
```ts
it("includes feasibilityWarning in response", async () => {
  const res = await POST(makeRequest(validInput))
  const body = await res.json()
  expect("feasibilityWarning" in body).toBe(true)
  // validInput is an experienced runner with 54 weeks — warning should be null
  expect(body.feasibilityWarning).toBeNull()
})

it("returns feasibilityWarning for first-timer with insufficient weeks", async () => {
  const firstTimerInput = {
    ...validInput,
    race: { ...validInput.race, date: "2026-07-01" }, // ~14 weeks away
    isFirstAtDistance: true,
    weeklyMileageRange: "under-40",
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
```

- [ ] **Step 7: Run all tests**

```bash
pnpm test
```
Expected: all tests pass.

- [ ] **Step 8: Run typecheck**

```bash
pnpm typecheck
```
Expected: passes.

- [ ] **Step 9: Commit**

```bash
git add apps/web/app/api/generate-plan/route.ts \
        apps/web/app/api/generate-plan/route.test.ts
git commit -m "feat(api): integrate PlanConstraints, fix long run cap, return feasibilityWarning"
```

---

## Task 6: Split `workout-scheduler.ts` into orchestration + placement

**Files:**
- Create: `packages/plan-engine/src/workout-placement.ts`
- Modify: `packages/plan-engine/src/workout-scheduler.ts`
- Modify: `packages/plan-engine/src/index.ts`

This is a pure refactor — no behaviour change. All tests must still pass after.

- [ ] **Step 1: Create `workout-placement.ts` with extracted helpers**

Create `packages/plan-engine/src/workout-placement.ts` containing:
- The `DAY_ORDER`, `DAY_INDEX`, `circularDist`, `isAdjacentTo`, `round05` helpers (move from scheduler)
- `qualityDistance()` function
- `placeQualitySessions()` — extracted from the quality block (lines ~260–301 in scheduler)
- `placeEasyRuns()` — extracted from the easy run block (lines ~303–328)
- `placeStrengthSessions()` — extracted from the strength block (lines ~330–368)

Each function signature:
```ts
export function placeQualitySessions(
  weekDays: { date: string; dayKey: string }[],
  assigned: Map<string, WorkoutDay[]>,
  longRunDay: string,
  qualityConfig: PhaseSlot,
  constraints: PlanConstraints,
  weeklyKm: number,
  paceZones: PaceZones,
): WorkoutDay[]

export function placeEasyRuns(
  weekDays: { date: string; dayKey: string }[],
  assigned: Map<string, WorkoutDay[]>,
  longRunKm: number,
  weeklyKm: number,
  paceZones: PaceZones,
): void

export function placeStrengthSessions(
  weekDays: { date: string; dayKey: string }[],
  assigned: Map<string, WorkoutDay[]>,
  longRunDay: string,
  placedQuality: WorkoutDay[],
  sCount: number,
): void
```

- [ ] **Step 2: Update `workout-scheduler.ts` to call placement functions**

Replace the inline quality/easy/strength blocks with calls to the extracted functions. The main loop skeleton becomes:

```ts
// 1. Long run
// 2. Quality sessions
const placedQuality = placeQualitySessions(...)
// 3. Easy runs
placeEasyRuns(...)
// 4. Strength
if (constraints.includeStrength) placeStrengthSessions(...)
// 5. Rest days
```

- [ ] **Step 3: Run all tests — no failures expected**

```bash
cd packages/plan-engine && pnpm test
```
Expected: all existing tests still pass.

- [ ] **Step 4: Verify scheduler is now under 200 lines**

```bash
wc -l packages/plan-engine/src/workout-scheduler.ts
```
Expected: < 200 lines.

- [ ] **Step 5: Do NOT export placement functions from `index.ts`**

`placeQualitySessions`, `placeEasyRuns`, and `placeStrengthSessions` are internal implementation details of the plan-engine package. Do not add them to `index.ts`. The existing scheduler tests provide sufficient coverage via integration. No changes to `index.ts` are needed in this task.

- [ ] **Step 6: Commit**

```bash
git add packages/plan-engine/src/workout-placement.ts \
        packages/plan-engine/src/workout-scheduler.ts \
        packages/plan-engine/src/index.ts
git commit -m "refactor(scheduler): extract placement logic into workout-placement.ts"
```

---

## Task 7: Create `step-first-at-distance.tsx`

**Files:**
- Modify: `apps/web/components/onboarding/types.ts`
- Create: `apps/web/components/onboarding/steps/step-first-at-distance.tsx`

- [ ] **Step 1: Add `isFirstAtDistance` and `includeStrength` to `OnboardingData` in `apps/web/components/onboarding/types.ts`**

This must come before creating the component, since the component reads these fields from `formData`.

```ts
export interface OnboardingData {
  goal?: Goal
  race?: RaceData
  isFirstAtDistance?: boolean    // ← new
  timeGoal?: boolean
  goalTime?: { hours: number; minutes: number }
  selectedDays?: Day[]
  longRunDay?: Day
  weeklyMileageRange?: "under-40" | "40-60" | "60-80" | "80-plus"
  includeStrength?: boolean      // ← new
  units?: "km" | "miles"
}
```

- [ ] **Step 2: Create the component**

```tsx
"use client"

import { useState } from "react"
import { OnboardingCard } from "../onboarding-card"
import type { StepProps } from "../types"

export function StepFirstAtDistance({ formData, onNext }: Pick<StepProps, "formData" | "onNext">) {
  const [selected, setSelected] = useState<boolean | undefined>(formData.isFirstAtDistance)
  const distance = formData.race?.distance
  const heading = distance === "half"
    ? "Is this your first half marathon?"
    : "Is this your first marathon?"

  function handleSelect(value: boolean) {
    setSelected(value)
    setTimeout(() => onNext({ isFirstAtDistance: value }), 150)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">{heading}</h2>
        <p className="text-sm text-muted-foreground">
          This helps us set the right training load and safeguards for your plan.
        </p>
      </div>
      <div className="space-y-3">
        <OnboardingCard
          label="Yes, it's my first"
          selected={selected === true}
          onClick={() => handleSelect(true)}
        />
        <OnboardingCard
          label="No, I've done one before"
          selected={selected === false}
          onClick={() => handleSelect(false)}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/onboarding/steps/step-first-at-distance.tsx \
        apps/web/components/onboarding/types.ts
git commit -m "feat(onboarding): add StepFirstAtDistance component and OnboardingData fields"
```

---

## Task 8: Create `step-include-strength.tsx`

**Files:**
- Create: `apps/web/components/onboarding/steps/step-include-strength.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client"

import { useState } from "react"
import { OnboardingCard } from "../onboarding-card"
import type { StepProps } from "../types"

export function StepIncludeStrength({ formData, onNext }: Pick<StepProps, "formData" | "onNext">) {
  const [selected, setSelected] = useState<boolean | undefined>(formData.includeStrength)

  function handleSelect(value: boolean) {
    setSelected(value)
    setTimeout(() => onNext({ includeStrength: value }), 150)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          Do you want to include strength training?
        </h2>
        <p className="text-sm text-muted-foreground">
          You can change this later.
        </p>
      </div>
      <div className="space-y-3">
        <OnboardingCard
          label="Yes, include it"
          description="2×/week resistance + core — shown to improve running economy"
          selected={selected === true}
          onClick={() => handleSelect(true)}
        />
        <OnboardingCard
          label="No, running only"
          description="Running sessions only"
          selected={selected === false}
          onClick={() => handleSelect(false)}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/onboarding/steps/step-include-strength.tsx
git commit -m "feat(onboarding): add StepIncludeStrength component"
```

---

## Task 9: Wire onboarding flow — reorder steps, add new steps, delete dead files

**Files:**
- Modify: `apps/web/components/onboarding/types.ts`
- Modify: `apps/web/components/onboarding/onboarding-flow.tsx`
- Delete: `apps/web/components/onboarding/steps/step-long-run-day.tsx`
- Delete: `apps/web/components/onboarding/steps/step-time-goal.tsx`

- [ ] **Step 1: Update `getSteps()` in `types.ts`**

```ts
export function getSteps(): readonly string[] {
  return [
    "findRace",
    "firstAtDistance",
    "weeklyMileage",
    "goalTime",
    "whichDays",
    "includeStrength",
  ]
}
```

- [ ] **Step 2: Update `STEP_LABELS` in `onboarding-flow.tsx`**

```ts
const STEP_LABELS: Record<string, string> = {
  findRace:        "Your race",
  firstAtDistance: "Experience",
  weeklyMileage:   "Weekly mileage",
  goalTime:        "Goal time",
  whichDays:       "Running days",
  includeStrength: "Strength training",
}
```

- [ ] **Step 3: Add imports for new step components**

At the top of `onboarding-flow.tsx`, add:
```ts
import { StepFirstAtDistance } from "./steps/step-first-at-distance"
import { StepIncludeStrength } from "./steps/step-include-strength"
```

- [ ] **Step 4: Add new cases to `renderStep()`**

```ts
function renderStep() {
  if (isComplete) return <FinalScreen formData={formData} />
  const stepName = steps[currentStep]
  switch (stepName) {
    case "findRace":        return <StepFindRace {...stepProps} />
    case "firstAtDistance": return <StepFirstAtDistance {...stepProps} />
    case "weeklyMileage":   return <StepWeeklyMileage {...stepProps} />
    case "goalTime":        return <StepGoalTime {...stepProps} />
    case "whichDays":       return <StepWhichDays {...stepProps} />
    case "includeStrength": return <StepIncludeStrength {...stepProps} />
    default:                return null
  }
}
```

- [ ] **Step 5: Update `mapToInput()` in `apps/web/app/plan/page.tsx` to read `isFirstAtDistance` and `includeStrength`**

`final-screen.tsx` serializes `formData` via `{ ...formData, race: ... }` into sessionStorage — the new fields are carried automatically since they're in `OnboardingData`. No change needed to `final-screen.tsx`.

However, `mapToInput()` in `plan/page.tsx` (lines 28–70) manually builds `PlanGenerationInput` and does not currently read these fields. Since `PlanGenerationInput.isFirstAtDistance` and `includeStrength` are now required, `mapToInput()` must be updated.

After the `weeklyMileageRange` block (line ~67), add:
```ts
// isFirstAtDistance — default false if missing (legacy session data)
input.isFirstAtDistance = raw["isFirstAtDistance"] === true

// includeStrength — default true if missing (legacy session data)
input.includeStrength = raw["includeStrength"] !== false
```

Also update the inline `result` type in the `generate()` function (~line 242) to include the new field:
```ts
let result: {
  days: WorkoutDay[]
  totalWeeks: number
  totalKm: number
  peakWeekKm: number
  phases: PhaseEntry[]
  planStartDate: string
  feasibilityWarning: string | null   // ← new
}
```

And add `feasibilityWarning` state:
```ts
const [feasibilityWarning, setFeasibilityWarning] = useState<string | null>(null)
```

Set it after a successful response in `generate()`:
```ts
setFeasibilityWarning(result.feasibilityWarning ?? null)
```

- [ ] **Step 6: Delete unused step files**

```bash
rm apps/web/components/onboarding/steps/step-long-run-day.tsx
rm apps/web/components/onboarding/steps/step-time-goal.tsx
```

- [ ] **Step 7: Run typecheck**

```bash
pnpm typecheck
```
Expected: passes.

- [ ] **Step 8: Commit**

```bash
git add apps/web/components/onboarding/types.ts \
        apps/web/components/onboarding/onboarding-flow.tsx \
        apps/web/components/onboarding/final-screen.tsx
git rm apps/web/components/onboarding/steps/step-long-run-day.tsx \
       apps/web/components/onboarding/steps/step-time-goal.tsx
git commit -m "feat(onboarding): reorder steps, add firstAtDistance + includeStrength, delete dead files"
```

---

## Task 10: Display `feasibilityWarning` on the plan page

**Files:**
- Modify: plan display page/component (find where the API response is consumed after navigating to `/plan`)

- [ ] **Step 1: Find where the plan API response is consumed**

Run:
```bash
grep -r "feasibilityWarning\|generate-plan\|planStartDate" apps/web/app/plan --include="*.tsx" -l
```
Identify the component that receives the plan response.

- [ ] **Step 2: Add `feasibilityWarning` to the local state/type**

In the plan display component, add `feasibilityWarning: string | null` to the plan response type (or inline type), then read it from the API response.

- [ ] **Step 3: Render the warning inline above the plan calendar**

Add a conditional callout. Use existing Tailwind/shadcn patterns from the codebase. Example:
```tsx
{feasibilityWarning && (
  <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
    {feasibilityWarning}
  </div>
)}
```
Place it above the plan calendar, below the plan summary stats.

- [ ] **Step 4: Run typecheck and dev server smoke test**

```bash
pnpm typecheck
pnpm dev
```
Navigate through onboarding with a first-timer profile and a short race window — confirm the warning appears on the plan page.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/plan/
git commit -m "feat(plan): display feasibilityWarning from plan generation API"
```

---

## Done

Run a final check before marking complete:

```bash
pnpm test && pnpm typecheck && pnpm build
```

Expected: all pass, build succeeds.
