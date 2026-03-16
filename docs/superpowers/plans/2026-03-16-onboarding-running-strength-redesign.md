# Onboarding Running Days + Strength Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the `whichDays` onboarding step to default to 6 days with preset tabs, and replace the two-step strength flow with a single Pfitzinger-based smart recommendation step.

**Architecture:** New pure functions `recommendStrengthCount` and `recommendStrengthDays` live in `packages/ai/src/strength-recommendation.ts` and are tested in isolation. The step order in `types.ts` is updated, `onboarding-flow.tsx` wired, and two step components deleted in favour of a new merged `StepStrength`. `StepWhichDays` gains preset tabs with smart day defaults.

**Tech Stack:** TypeScript, React 19, Next.js App Router, Tailwind CSS v4, shadcn/ui, Vitest (AI package tests), Playwright (E2E).

---

## Chunk 1: Strength Recommendation Helpers

**Files:**
- Create: `packages/ai/src/strength-recommendation.ts`
- Create: `packages/ai/src/strength-recommendation.test.ts`
- Modify: `packages/ai/src/index.ts`

### Task 1: Write failing tests for `recommendStrengthCount` and `recommendStrengthDays`

- [ ] **Step 1: Create the test file**

```ts
// packages/ai/src/strength-recommendation.test.ts
import { describe, it, expect } from "vitest"
import { recommendStrengthCount, recommendStrengthDays } from "./strength-recommendation"

describe("recommendStrengthCount", () => {
  describe("with peakMileageHigh available", () => {
    it("returns 1 when peakMileageHigh >= 95", () => {
      expect(recommendStrengthCount(95, "40-60")).toBe(1)
    })
    it("returns 1 when peakMileageHigh is above 95", () => {
      expect(recommendStrengthCount(130, "80-plus")).toBe(1)
    })
    it("returns 2 when peakMileageHigh < 95", () => {
      expect(recommendStrengthCount(94, "40-60")).toBe(2)
    })
    it("returns 2 when peakMileageHigh is low", () => {
      expect(recommendStrengthCount(60, "under-40")).toBe(2)
    })
    it("boundary: exactly 95 returns 1", () => {
      expect(recommendStrengthCount(95, "60-80")).toBe(1)
    })
    it("boundary: 94 returns 2", () => {
      expect(recommendStrengthCount(94, "60-80")).toBe(2)
    })
  })

  describe("with peakMileageHigh null (mileage range fallback)", () => {
    it("returns 1 for 80-plus", () => {
      expect(recommendStrengthCount(null, "80-plus")).toBe(1)
    })
    it("returns 2 for 60-80", () => {
      expect(recommendStrengthCount(null, "60-80")).toBe(2)
    })
    it("returns 2 for 40-60", () => {
      expect(recommendStrengthCount(null, "40-60")).toBe(2)
    })
    it("returns 2 for under-40", () => {
      expect(recommendStrengthCount(null, "under-40")).toBe(2)
    })
  })
})

describe("recommendStrengthDays", () => {
  it("Sunday long run, count 1 → wed (highest dist, lower index wins tiebreak)", () => {
    expect(recommendStrengthDays("sun", 1)).toEqual(["wed"])
  })
  it("Sunday long run, count 2 → wed, thu (both dist 3 from Sunday)", () => {
    expect(recommendStrengthDays("sun", 2)).toEqual(["wed", "thu"])
  })
  it("Saturday long run, count 2 → tue, wed (both dist 3 from Saturday)", () => {
    expect(recommendStrengthDays("sat", 2)).toEqual(["tue", "wed"])
  })
  it("Monday long run, count 1 → thu (dist 3; tiebreak: Thu idx=4 < Fri idx=5)", () => {
    // Mon idx=1. Thu: min(|4-1|,7-3)=min(3,4)=3. Fri: min(|5-1|,7-4)=min(4,3)=3.
    expect(recommendStrengthDays("mon", 1)).toEqual(["thu"])
  })
  it("Wednesday long run, count 2 → sun, sat (both dist 3 from Wed)", () => {
    // Wed idx=3. Sun: min(|0-3|,7-3)=min(3,4)=3. Sat: min(|6-3|,7-3)=min(3,4)=3. Sun idx=0 < Sat idx=6
    expect(recommendStrengthDays("wed", 2)).toEqual(["sun", "sat"])
  })
  it("count 0 returns empty array", () => {
    expect(recommendStrengthDays("sun", 0)).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm --filter @workspace/ai test
```

Expected: multiple FAIL errors about missing exports from `"./strength-recommendation"`.

---

### Task 2: Implement `strength-recommendation.ts`

- [ ] **Step 1: Create the implementation**

`Day` is defined locally as a string union — do NOT import it from `apps/web`. The AI package is a dependency of `apps/web`, not the reverse. Importing from the web app would invert that dependency and break isolated package tests.

```ts
// packages/ai/src/strength-recommendation.ts

// Day is defined locally to avoid importing from apps/web (which would invert
// the package dependency). This mirrors the pattern in race-prompt.ts.
type Day = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat"

// DAY_INDEX mirrors the convention in race-prompt.ts: Sun=0, Mon=1 … Sat=6
const DAY_INDEX: Record<Day, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
}

const ALL_DAYS: Day[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]

/**
 * Recommend how many strength sessions per week to schedule during Base and Build.
 *
 * When peakMileageHigh is available (derived from computeGoalPeakMileage), it
 * takes precedence. When null (no goal time provided), falls back to the
 * current weekly mileage range.
 *
 * During Peak the plan auto-reduces to 1 day; during Taper it drops to 0.
 * This function only determines the Base/Build recommendation.
 */
export function recommendStrengthCount(
  peakMileageHigh: number | null,
  weeklyMileageRange: "under-40" | "40-60" | "60-80" | "80-plus",
): 1 | 2 {
  if (peakMileageHigh !== null) {
    return peakMileageHigh >= 95 ? 1 : 2
  }
  return weeklyMileageRange === "80-plus" ? 1 : 2
}

/**
 * Recommend which days to lift, ranked by circular distance from the long run day.
 *
 * Algorithm:
 * 1. Compute circular distance for each day: min(|idx - longIdx|, 7 - |idx - longIdx|)
 * 2. Sort descending by distance; break ties by ascending DAY_INDEX (Sun=0 wins over Mon=1, etc.)
 * 3. Return the first `count` days.
 */
export function recommendStrengthDays(longRunDay: Day, count: number): Day[] {
  if (count <= 0) return []
  const longIdx = DAY_INDEX[longRunDay]

  const sorted = [...ALL_DAYS].sort((a, b) => {
    const da = circularDist(DAY_INDEX[a], longIdx)
    const db = circularDist(DAY_INDEX[b], longIdx)
    if (db !== da) return db - da          // descending distance
    return DAY_INDEX[a] - DAY_INDEX[b]    // ascending index tiebreak
  })

  return sorted.slice(0, count)
}

function circularDist(a: number, b: number): number {
  const diff = Math.abs(a - b)
  return Math.min(diff, 7 - diff)
}
```

- [ ] **Step 2: Run tests to confirm they pass**

```bash
pnpm --filter @workspace/ai test
```

Expected: all `recommendStrengthCount` and `recommendStrengthDays` tests PASS.

---

### Task 3: Export new helpers and `computeGoalPeakMileage` from `packages/ai/src/index.ts`

`computeGoalPeakMileage` is not currently re-exported from `index.ts` — `StepStrength` (Chunk 4) needs it via `@workspace/ai`. Add it here alongside the new helpers.

- [ ] **Step 1: Add export lines**

In `packages/ai/src/index.ts`, add after the existing exports:

```ts
export { recommendStrengthCount, recommendStrengthDays } from "./strength-recommendation"
export { computeGoalPeakMileage } from "./pace-calculator"
```

- [ ] **Step 2: Verify typecheck passes**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/ai/src/strength-recommendation.ts packages/ai/src/strength-recommendation.test.ts packages/ai/src/index.ts
git commit -m "feat: add recommendStrengthCount, recommendStrengthDays, export computeGoalPeakMileage"
```

---

## Chunk 2: Step Order + Onboarding Flow Wiring

**Files:**
- Modify: `apps/web/components/onboarding/types.ts`
- Modify: `apps/web/components/onboarding/onboarding-flow.tsx`

### Task 4: Update step order in `types.ts`

- [ ] **Step 1: Update `getSteps()`**

In `apps/web/components/onboarding/types.ts`, replace:

```ts
export function getSteps(): readonly string[] {
  return [
    "findRace",
    "goalTime",
    "trainingAge",
    "whichDays",
    "strengthTraining",
    "strengthDays",
    "weeklyMileage",
  ]
}
```

With:

```ts
export function getSteps(): readonly string[] {
  return [
    "findRace",
    "goalTime",
    "trainingAge",
    "whichDays",
    "weeklyMileage",
    "strength",
  ]
}
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm typecheck
```

Expected: no errors (the new step key is a string; render switch handles unknown keys by returning null).

---

### Task 5: Update `onboarding-flow.tsx`

- [ ] **Step 1: Update `STEP_LABELS`**

In `apps/web/components/onboarding/onboarding-flow.tsx`, replace:

```ts
const STEP_LABELS: Record<string, string> = {
  findRace: "Your race",
  goalTime: "Goal time",
  trainingAge: "Experience",
  whichDays: "Running days",
  strengthTraining: "Strength training",
  strengthDays: "Lifting days",
  weeklyMileage: "Weekly mileage",
}
```

With:

```ts
const STEP_LABELS: Record<string, string> = {
  findRace: "Your race",
  goalTime: "Goal time",
  trainingAge: "Experience",
  whichDays: "Running days",
  weeklyMileage: "Weekly mileage",
  strength: "Strength training",
}
```

- [ ] **Step 2: Remove skip-over logic in `advance`**

Replace the `advance` function:

```ts
function advance(merged: OnboardingData) {
  setDirection(1)
  setCurrentStep((s) => {
    // Skip strengthDays if user opted out of strength training
    const next = steps[s + 1]
    if (next === "strengthDays" && merged.strengthTraining === false) return s + 2
    return s + 1
  })
}
```

With:

```ts
function advance(merged: OnboardingData) {
  setDirection(1)
  setCurrentStep((s) => s + 1)
}
```

- [ ] **Step 3: Remove skip-over logic in `goBack`**

Replace the `goBack` function:

```ts
function goBack() {
  if (currentStep === 0) {
    setShowExitConfirm(true)
    return
  }
  setDirection(-1)
  setCurrentStep((s) => {
    // Skip back over strengthDays if user opted out of strength training
    const prev = steps[s - 1]
    if (prev === "strengthDays" && formData.strengthTraining === false) return s - 2
    return s - 1
  })
}
```

With:

```ts
function goBack() {
  if (currentStep === 0) {
    setShowExitConfirm(true)
    return
  }
  setDirection(-1)
  setCurrentStep((s) => s - 1)
}
```

- [ ] **Step 4: Update imports and render switch**

Remove the two old imports at the top of the file:

```ts
import { StepStrengthTraining } from "./steps/step-strength-training"
import { StepStrengthDays } from "./steps/step-strength-days"
```

Add:

```ts
import { StepStrength } from "./steps/step-strength"
```

In `renderStep()`, replace:

```ts
case "strengthTraining":   return <StepStrengthTraining {...stepProps} />
case "strengthDays":       return <StepStrengthDays {...stepProps} />
```

With:

```ts
case "strength":           return <StepStrength {...stepProps} />
```

- [ ] **Step 5: Verify typecheck and lint**

```bash
pnpm typecheck && pnpm lint
```

Expected: **typecheck will fail** with a missing module error on `"./steps/step-strength"` — this is expected because `step-strength.tsx` is created in Chunk 4 (Task 7). The purpose of this step is to confirm no other errors exist. Proceed to the commit if the only error is the missing `step-strength` module.

- [ ] **Step 6: Commit**

Note: this commit introduces a broken import (`StepStrength` not yet created). This is an accepted intermediate state — the build is fixed in Chunk 4 Task 7. If your CI runs typecheck on every commit, squash with the Task 7 commit instead.

```bash
git add apps/web/components/onboarding/types.ts apps/web/components/onboarding/onboarding-flow.tsx
git commit -m "feat: update step order and wire strength step in onboarding flow"
```

---

## Chunk 3: `StepWhichDays` Redesign

**Files:**
- Modify: `apps/web/components/onboarding/steps/step-which-days.tsx`

### Task 6: Redesign `StepWhichDays` with preset tabs

The step gains a preset row (`5 days | 6 days | 7 days`) that auto-populates the day toggles and resets the long run to Sunday. Default preset is 6 days.

`longRunDay` is typed as `Day | undefined`. When the current long run day is deselected from the running days picker, it resets to `undefined` (no long run selected) rather than snapping to a potentially unavailable day. `canAdvance` correctly blocks submission until a long run day is explicitly chosen.

- [ ] **Step 1: Replace the entire component**

```tsx
// apps/web/components/onboarding/steps/step-which-days.tsx
"use client"

import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { DayToggle } from "../day-toggle"
import { cn } from "@workspace/ui/lib/utils"
import { ORDERED_DAYS, DAY_LABELS, type Day, type StepProps } from "../types"

type Preset = 5 | 6 | 7

const PRESET_DEFAULTS: Record<Preset, Day[]> = {
  5: ["mon", "tue", "thu", "fri", "sun"],
  6: ["mon", "tue", "wed", "thu", "fri", "sun"],
  7: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
}

const LONG_RUN_DEFAULT: Day = "sun"

function detectPreset(days: Day[]): Preset {
  if (days.length <= 5) return 5
  if (days.length === 6) return 6
  return 7
}

export function StepWhichDays({ formData, onNext }: Pick<StepProps, "formData" | "onNext">) {
  const initialDays = formData.selectedDays ?? PRESET_DEFAULTS[6]
  const [preset, setPreset] = useState<Preset>(() => detectPreset(initialDays))
  const [selectedDays, setSelectedDays] = useState<Day[]>(initialDays)
  const [longRunDay, setLongRunDay] = useState<Day | undefined>(
    formData.longRunDay ?? LONG_RUN_DEFAULT
  )

  function applyPreset(p: Preset) {
    setPreset(p)
    setSelectedDays(PRESET_DEFAULTS[p])
    setLongRunDay(LONG_RUN_DEFAULT)
  }

  function toggleDay(day: Day) {
    setSelectedDays((prev) => {
      const next = prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
      // Clear long run day if it's no longer in the selected days
      if (longRunDay && !next.includes(longRunDay)) setLongRunDay(undefined)
      return next
    })
  }

  const canAdvance = selectedDays.length > 0 && longRunDay !== undefined

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Set up your running week.</h2>
        <p className="text-sm text-muted-foreground">
          Most serious runners train 6 days a week. Adjust to fit your schedule.
        </p>
      </div>

      {/* Preset tabs */}
      <div className="flex gap-2">
        {([5, 6, 7] as Preset[]).map((p) => (
          <button
            key={p}
            onClick={() => applyPreset(p)}
            className={cn(
              "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors cursor-pointer",
              preset === p
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:bg-muted"
            )}
          >
            {p} days
          </button>
        ))}
      </div>

      <div className="space-y-6">
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Running days</p>
          <div className="flex w-full justify-center gap-2">
            {ORDERED_DAYS.map((day) => (
              <DayToggle
                key={day}
                day={day}
                label={DAY_LABELS[day].short}
                selected={selectedDays.includes(day)}
                onClick={() => toggleDay(day)}
              />
            ))}
          </div>
        </div>

        <div
          className="space-y-3 transition-opacity duration-300"
          style={{ opacity: selectedDays.length > 0 ? 1 : 0.25, pointerEvents: selectedDays.length > 0 ? "auto" : "none" }}
        >
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Long run day</p>
          <div className="flex w-full justify-center gap-2">
            {ORDERED_DAYS.map((day) => {
              const available = selectedDays.includes(day)
              return (
                <DayToggle
                  key={day}
                  day={day}
                  label={DAY_LABELS[day].short}
                  selected={longRunDay === day}
                  disabled={!available}
                  onClick={() => available && setLongRunDay(day)}
                />
              )
            })}
          </div>
        </div>
      </div>

      <Button
        onClick={() => canAdvance && onNext({ selectedDays, longRunDay })}
        disabled={!canAdvance}
        className="w-full"
      >
        Next
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck and lint**

```bash
pnpm typecheck && pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/onboarding/steps/step-which-days.tsx
git commit -m "feat: redesign whichDays step with preset tabs and 6-day default"
```

---

## Chunk 4: Merged Strength Step + Cleanup

**Files:**
- Create: `apps/web/components/onboarding/steps/step-strength.tsx`
- Delete: `apps/web/components/onboarding/steps/step-strength-training.tsx`
- Delete: `apps/web/components/onboarding/steps/step-strength-days.tsx`
- Modify: `apps/web/e2e/onboarding.spec.ts` (if needed)

### Task 7: Create `StepStrength`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/components/onboarding/steps/step-strength.tsx
"use client"

import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { DayToggle } from "../day-toggle"
import { ORDERED_DAYS, DAY_LABELS, type Day, type StepProps } from "../types"
import {
  recommendStrengthCount,
  recommendStrengthDays,
  computeGoalPeakMileage,
} from "@workspace/ai"

export function StepStrength({ formData, onNext }: Pick<StepProps, "formData" | "onNext">) {
  const longRunDay = formData.longRunDay ?? "sun"
  const weeklyMileageRange = formData.weeklyMileageRange ?? "40-60"

  // Derive peakMileageHigh from goal time + race distance
  const goalMinutes = formData.goalTime
    ? formData.goalTime.hours * 60 + formData.goalTime.minutes
    : null
  const peakMileageHigh =
    goalMinutes !== null && formData.race?.distance
      ? (computeGoalPeakMileage(formData.race.distance, goalMinutes)?.high ?? null)
      : null

  const recommendedCount = recommendStrengthCount(peakMileageHigh, weeklyMileageRange)
  const defaultDays = recommendStrengthDays(longRunDay, recommendedCount)

  // Use restored draft days if present (including empty array from a prior skip),
  // otherwise fall back to the Pfitzinger-recommended defaults.
  const [selected, setSelected] = useState<Day[]>(
    formData.strengthDays !== undefined ? formData.strengthDays : defaultDays
  )

  function toggle(day: Day) {
    setSelected((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  const bannerText =
    recommendedCount === 1
      ? "Your goal implies a high-volume peak — we suggest 1 lifting day to protect recovery. This stops in Taper."
      : "Based on your goal and training volume, we suggest 2 lifting days during Base and Build. This drops to 1 in Peak and stops in Taper."

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Strength training</h2>
        <p className="text-sm text-muted-foreground">{bannerText}</p>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Lifting days</p>
        <div className="flex w-full justify-center gap-2">
          {ORDERED_DAYS.map((day) => (
            <DayToggle
              key={day}
              day={day}
              label={DAY_LABELS[day].short}
              selected={selected.includes(day)}
              onClick={() => toggle(day)}
            />
          ))}
        </div>
        {selected.length === 0 && (
          <p className="text-xs text-muted-foreground text-center">
            Select at least one day, or skip strength training below.
          </p>
        )}
      </div>

      <div className="space-y-3">
        <Button
          onClick={() => onNext({ strengthTraining: true, strengthDays: selected })}
          disabled={selected.length === 0}
          className="w-full"
        >
          Continue
        </Button>
        <button
          onClick={() => onNext({ strengthTraining: false, strengthDays: [] })}
          className="w-full cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors text-center"
        >
          Skip strength training →
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck and lint pass cleanly**

```bash
pnpm typecheck && pnpm lint
```

Expected: no errors. This is the step that resolves the broken import introduced in Chunk 2 Task 5.

---

### Task 8: Delete old strength step files

- [ ] **Step 1: Delete the two obsolete files**

```bash
rm apps/web/components/onboarding/steps/step-strength-training.tsx
rm apps/web/components/onboarding/steps/step-strength-days.tsx
```

- [ ] **Step 2: Verify typecheck (confirm no remaining imports)**

```bash
pnpm typecheck
```

Expected: no errors. If any import errors appear, search for remaining references:

```bash
grep -r "step-strength-training\|step-strength-days\|StepStrengthTraining\|StepStrengthDays" apps/web
```

Expected: no matches.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/onboarding/steps/step-strength.tsx
git add -u apps/web/components/onboarding/steps/step-strength-training.tsx
git add -u apps/web/components/onboarding/steps/step-strength-days.tsx
git commit -m "feat: add merged StepStrength component, remove old two-step strength flow"
```

---

### Task 9: Verify E2E tests

- [ ] **Step 1: Confirm no step-label assertions in E2E tests**

```bash
grep -n "strength\|Strength\|strengthDays\|strengthTraining\|Lifting" apps/web/e2e/onboarding.spec.ts
```

Expected: no matches. The existing E2E tests only assert on redirect behavior and onboarding launch — neither is affected by the step changes.

If any matches are found, update the relevant assertions to use `"Strength training"` (the new unified label) and remove any reference to `"Lifting days"`.

- [ ] **Step 2: Run final typecheck and lint**

```bash
pnpm typecheck && pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Commit only if E2E file was changed**

Only run this step if Step 1 found matches and you updated the file:

```bash
git add apps/web/e2e/onboarding.spec.ts
git commit -m "fix: update E2E test assertions for renamed strength step"
```

If Step 1 found no matches, skip this step — the file has not changed and there is nothing to commit.
