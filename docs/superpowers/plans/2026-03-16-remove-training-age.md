# Remove Training Age Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the `trainingAge` onboarding step and all downstream usage across the codebase.

**Architecture:** Two sequential tasks — (1) clean up the `packages/ai` logic layer (functions + types + prompt), (2) clean up the `apps/web` UI layer (onboarding step + plan page parser). Task 1 must complete first since it removes the field from `PlanGenerationInput`; Task 2 then cleans up the consumer side.

**Tech Stack:** TypeScript, Vitest (packages/ai), Next.js 15 / React 19 (apps/web), pnpm monorepo with Turbo.

---

## Task 1: Remove `trainingAge` from packages/ai

**Files:**
- Modify: `packages/ai/src/pace-calculator.ts` (computeTrainingStructure:247–312, computeLongRunTargets:324–365)
- Modify: `packages/ai/src/pace-calculator.test.ts` (delete 4 describe blocks, update all remaining calls)
- Modify: `packages/ai/src/types.ts:61`
- Modify: `packages/ai/src/race-prompt.ts:248–261, 278–283`

- [ ] **Step 1: Delete the four `trainingAge`-specific describe blocks from pace-calculator.test.ts**

  Delete these four describe blocks entirely. They test the `"under-1"` modifier and equivalence behavior that no longer exists after this change.

  **Block 1 — lines 415–420** (`computeTrainingStructure` under-1 caps):
  ```ts
  describe("computeTrainingStructure — full marathon, sub-2:30 (140 min), under-1, 7 days — training age caps run days", () => {
    const result = computeTrainingStructure(140, "full", "under-1", 7, "80-plus")
    it("runDaysPerWeek: 6 (capped by under-1)", () => { expect(result.runDaysPerWeek).toBe(6) })
    it("restDaysPerWeek: 1 (incremented due to cap)", () => { expect(result.restDaysPerWeek).toBe(1) })
    it("maxQualityPerWeek: 2 (reduced by under-1)", () => { expect(result.maxQualityPerWeek).toBe(2) })
  })
  ```

  **Block 2 — lines 467–473** (`computeTrainingStructure` equivalence):
  ```ts
  describe("computeTrainingStructure — undefined trainingAge treated as 1-3 (no modifier)", () => {
    const withUndefined = computeTrainingStructure(200, "full", undefined, 7, "40-60")
    const with1_3 = computeTrainingStructure(200, "full", "1-3", 7, "40-60")
    it("runDaysPerWeek matches 1-3", () => { expect(withUndefined.runDaysPerWeek).toBe(with1_3.runDaysPerWeek) })
    it("restDaysPerWeek matches 1-3", () => { expect(withUndefined.restDaysPerWeek).toBe(with1_3.restDaysPerWeek) })
    it("maxQualityPerWeek matches 1-3", () => { expect(withUndefined.maxQualityPerWeek).toBe(with1_3.maxQualityPerWeek) })
  })
  ```

  **Block 3 — lines 573–590** (`computeLongRunTargets` under-1 modifier):
  ```ts
  describe("computeLongRunTargets — under-1 training age reduces peakLongRunKm by 3", () => {
    it("full, high=80: 35 - 3 = 32", () => { ... })
    it("full, high=60: 29 - 3 = 26", () => { ... })
    it("5k, high=40: 11 - 3 = 8, but Math.max(13, 8) = 13", () => { ... })
  })
  ```

  **Block 4 — lines 592–606** (`computeLongRunTargets` equivalence):
  ```ts
  describe("computeLongRunTargets — 3-or-more and undefined training age: no modifier", () => {
    ...
  })
  ```

- [ ] **Step 2: Update all remaining `computeTrainingStructure` calls in pace-calculator.test.ts**

  Remove the third positional argument from every remaining `computeTrainingStructure(...)` call (eight total):

  | Line | Before | After |
  |------|--------|-------|
  | 402 | `computeTrainingStructure(200, "full", "1-3", 7, "40-60")` | `computeTrainingStructure(200, "full", 7, "40-60")` |
  | 409 | `computeTrainingStructure(140, "full", "3-or-more", 7, "80-plus")` | `computeTrainingStructure(140, "full", 7, "80-plus")` |
  | 423 | `computeTrainingStructure(200, "full", "1-3", 5, "40-60")` | `computeTrainingStructure(200, "full", 5, "40-60")` |
  | 430 | `computeTrainingStructure(70, "half", "1-3", 7, "60-80")` | `computeTrainingStructure(70, "half", 7, "60-80")` |
  | 438 | `computeTrainingStructure(200, "5k", "1-3", 7, "40-60")` | `computeTrainingStructure(200, "5k", 7, "40-60")` |
  | 446 | `computeTrainingStructure(140, "5k", "1-3", 7, "80-plus")` | `computeTrainingStructure(140, "5k", 7, "80-plus")` |
  | 453 | `computeTrainingStructure(200, "ultra", "1-3", 7, "60-80")` | `computeTrainingStructure(200, "ultra", 7, "60-80")` |
  | 461 | `computeTrainingStructure(null, "full", "1-3", 7, "under-40")` | `computeTrainingStructure(null, "full", 7, "under-40")` |

- [ ] **Step 3: Update all remaining `computeLongRunTargets` calls in pace-calculator.test.ts**

  Remove the third positional argument from every remaining `computeLongRunTargets(...)` call (sixteen total):

  | Line | Before | After |
  |------|--------|-------|
  | 478 | `computeLongRunTargets("full", null, "1-3")` | `computeLongRunTargets("full", null)` |
  | 484 | `computeLongRunTargets("full", { low: 45, high: 60 }, "1-3")` | `computeLongRunTargets("full", { low: 45, high: 60 })` |
  | 490 | `computeLongRunTargets("full", { low: 65, high: 80 }, "1-3")` | `computeLongRunTargets("full", { low: 65, high: 80 })` |
  | 496 | `computeLongRunTargets("full", { low: 80, high: 100 }, "1-3")` | `computeLongRunTargets("full", { low: 80, high: 100 })` |
  | 502 | `computeLongRunTargets("full", { low: 110, high: 130 }, "1-3")` | `computeLongRunTargets("full", { low: 110, high: 130 })` |
  | 508 | `computeLongRunTargets("half", null, undefined)` | `computeLongRunTargets("half", null)` |
  | 514 | `computeLongRunTargets("half", { low: 35, high: 45 }, "1-3")` | `computeLongRunTargets("half", { low: 35, high: 45 })` |
  | 520 | `computeLongRunTargets("half", { low: 55, high: 65 }, "1-3")` | `computeLongRunTargets("half", { low: 55, high: 65 })` |
  | 526 | `computeLongRunTargets("half", { low: 65, high: 80 }, "1-3")` | `computeLongRunTargets("half", { low: 65, high: 80 })` |
  | 532 | `computeLongRunTargets("5k", null, "1-3")` | `computeLongRunTargets("5k", null)` |
  | 538 | `computeLongRunTargets("5k", { low: 30, high: 40 }, "1-3")` | `computeLongRunTargets("5k", { low: 30, high: 40 })` |
  | 544 | `computeLongRunTargets("5k", { low: 45, high: 55 }, "1-3")` | `computeLongRunTargets("5k", { low: 45, high: 55 })` |
  | 550 | `computeLongRunTargets("10k", { low: 60, high: 70 }, "1-3")` | `computeLongRunTargets("10k", { low: 60, high: 70 })` |
  | 556 | `computeLongRunTargets("ultra", { low: 50, high: 100 }, "1-3")` | `computeLongRunTargets("ultra", { low: 50, high: 100 })` |
  | 562 | `computeLongRunTargets("ultra", null, "1-3")` | `computeLongRunTargets("ultra", null)` |
  | 568 | `computeLongRunTargets("obstacle-course", null, undefined)` | `computeLongRunTargets("obstacle-course", null)` |

- [ ] **Step 4: Remove `trainingAge` parameter from `computeTrainingStructure` in pace-calculator.ts**

  Change the signature at lines 247–253 and delete the `"under-1"` branch at lines 300–305:

  ```ts
  // Before (signature)
  export function computeTrainingStructure(
    goalMinutes: number | null,
    distance: string,
    trainingAge: string | undefined,
    selectedDaysCount: number,
    weeklyMileageRange: string,
  ): { runDaysPerWeek: number; restDaysPerWeek: number; maxQualityPerWeek: number } {

  // After (signature)
  export function computeTrainingStructure(
    goalMinutes: number | null,
    distance: string,
    selectedDaysCount: number,
    weeklyMileageRange: string,
  ): { runDaysPerWeek: number; restDaysPerWeek: number; maxQualityPerWeek: number } {
  ```

  Delete these lines (300–305):
  ```ts
  // Training age modifier — only "under-1" gets a modifier
  if (trainingAge === "under-1") {
    quality = Math.max(1, quality - 1)
    if (run > 6) { run = 6; rest += 1 }
  }
  // "1-3", "3-or-more", undefined: no modifier
  ```

- [ ] **Step 5: Remove `trainingAge` parameter from `computeLongRunTargets` in pace-calculator.ts**

  Change the signature at lines 324–328 and delete the `"under-1"` branch at lines 358–362:

  ```ts
  // Before (signature)
  export function computeLongRunTargets(
    distance: string,
    peakWeeklyKm: { low: number; high: number } | null,
    trainingAge: string | undefined,
  ): { peakLongRunKm: number; recoveryRunMaxKm: number } {

  // After (signature)
  export function computeLongRunTargets(
    distance: string,
    peakWeeklyKm: { low: number; high: number } | null,
  ): { peakLongRunKm: number; recoveryRunMaxKm: number } {
  ```

  Delete these lines (358–362):
  ```ts
  // Training age modifier — applied after distance lookup, before returning.
  // Only "under-1" gets a modifier; recoveryRunMaxKm is intentionally unchanged.
  if (trainingAge === "under-1") {
    peakLongRunKm = Math.max(13, peakLongRunKm - 3)
  }
  ```

- [ ] **Step 6: Remove `trainingAge` from `PlanGenerationInput` in packages/ai/src/types.ts**

  Delete line 61:
  ```ts
  // DELETE:
  trainingAge?: "under-1" | "1-3" | "3-or-more"
  ```

- [ ] **Step 7: Remove `trainingAge` from race-prompt.ts**

  At the `computeTrainingStructure` call (lines 248–254), remove `input.trainingAge`:

  ```ts
  // Before
  const trainingStructure = computeTrainingStructure(
    goalMinutes,
    distance,
    input.trainingAge,
    input.selectedDays.length,
    input.weeklyMileageRange,
  )

  // After
  const trainingStructure = computeTrainingStructure(
    goalMinutes,
    distance,
    input.selectedDays.length,
    input.weeklyMileageRange,
  )
  ```

  At the `computeLongRunTargets` call (lines 257–261), remove `input.trainingAge`:

  ```ts
  // Before
  const longRunTargets = computeLongRunTargets(
    distance,
    peakMileage,
    input.trainingAge,
  )

  // After
  const longRunTargets = computeLongRunTargets(
    distance,
    peakMileage,
  )
  ```

  Delete the `trainingAgeLabel` lookup and the `Training age:` line (lines 278–283):
  ```ts
  // DELETE:
  const trainingAgeLabel: Record<string, string> = {
    "under-1": "under 1 year of consistent running",
    "1-3": "1–3 years of consistent running",
    "3-or-more": "3 or more years of consistent running",
  }
  lines.push(`  Training age: ${trainingAgeLabel[input.trainingAge ?? "1-3"] ?? "1–3 years of consistent running"}`)
  ```

- [ ] **Step 8: Run tests and typecheck**

  ```bash
  pnpm --filter @workspace/ai exec vitest run
  ```

  Expected: all tests pass.

  ```bash
  pnpm typecheck
  ```

  Expected: no errors in `packages/ai`.

- [ ] **Step 9: Commit**

  ```bash
  git add packages/ai/src/pace-calculator.ts packages/ai/src/pace-calculator.test.ts packages/ai/src/types.ts packages/ai/src/race-prompt.ts
  git commit -m "refactor: remove trainingAge from packages/ai — dead code for advanced runners"
  ```

---

## Task 2: Remove `trainingAge` from apps/web

**Files:**
- Modify: `apps/web/components/onboarding/types.ts:34,52`
- Modify: `apps/web/components/onboarding/onboarding-flow.tsx:15,31,308`
- Delete: `apps/web/components/onboarding/steps/step-training-age.tsx`
- Modify: `apps/web/app/plan/page.tsx:117–121`

No unit tests to write — verification is TypeScript typecheck passing.

- [ ] **Step 1: Remove `trainingAge` from `OnboardingData` in types.ts**

  Delete line 34:
  ```ts
  // DELETE:
  trainingAge?: "under-1" | "1-3" | "3-or-more"
  ```

- [ ] **Step 2: Remove `"trainingAge"` from `getSteps()` in types.ts**

  ```ts
  // Before
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

  // After
  export function getSteps(): readonly string[] {
    return [
      "findRace",
      "goalTime",
      "whichDays",
      "weeklyMileage",
      "strength",
    ]
  }
  ```

- [ ] **Step 3: Update onboarding-flow.tsx**

  Remove the import (line 15):
  ```ts
  // DELETE:
  import { StepTrainingAge } from "./steps/step-training-age"
  ```

  Remove from `STEP_LABELS` (line 31):
  ```ts
  // DELETE:
  trainingAge: "Experience",
  ```

  Remove from `renderStep` switch (line 308):
  ```ts
  // DELETE:
  case "trainingAge":        return <StepTrainingAge {...stepProps} />
  ```

- [ ] **Step 4: Delete the step file**

  ```bash
  git rm apps/web/components/onboarding/steps/step-training-age.tsx
  ```

- [ ] **Step 5: Remove rawTrainingAge block from apps/web/app/plan/page.tsx**

  Delete lines 117–121:
  ```ts
  // DELETE:
  const rawTrainingAge = raw["trainingAge"] as string | undefined
  const validTrainingAges = ["under-1", "1-3", "3-or-more"]
  if (rawTrainingAge && validTrainingAges.includes(rawTrainingAge)) {
    input.trainingAge = rawTrainingAge as PlanGenerationInput["trainingAge"]
  }
  ```

- [ ] **Step 6: Run typecheck**

  ```bash
  pnpm typecheck
  ```

  Expected: no errors across all packages and apps.

- [ ] **Step 7: Commit**

  The `git rm` in Step 4 already stages the file deletion. Stage the modified files and commit:

  ```bash
  git add apps/web/components/onboarding/types.ts apps/web/components/onboarding/onboarding-flow.tsx apps/web/app/plan/page.tsx
  git commit -m "refactor: remove trainingAge step from onboarding UI and plan parser"
  ```

  The staged deletion of `step-training-age.tsx` will be included in this commit automatically.
