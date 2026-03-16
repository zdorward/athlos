# Goal Time Change Clears Running Days — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clear `selectedDays` and `longRunDay` from `formData` when the user changes their goal time, so `StepWhichDays` recomputes the default from scratch.

**Architecture:** A single helper function `goalTimeChanged` is added to `onboarding-flow.tsx` and called inside the existing `handleNext`. When the current step is `goalTime` and the goal time value has actually changed, the merged form data is returned without `selectedDays` and `longRunDay`. No other files are touched.

**Tech Stack:** Next.js 15, React 19, TypeScript. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-03-16-goal-time-change-clears-days.md`

---

## Chunk 1: Implementation and smoke test

### Task 1: Clear days in handleNext when goal time changes

**Files:**
- Modify: `apps/web/components/onboarding/onboarding-flow.tsx:291–295`

This is a UI component with no automated test suite. The test for this task is a browser smoke test described in Step 3.

**Background:**

`handleNext` currently merges incoming step data into `formData` unconditionally:

```ts
function handleNext(data: Partial<OnboardingData>) {
  const merged = { ...formData, ...data }
  setFormData(merged)
  advance()
}
```

`OnboardingData` (from `apps/web/components/onboarding/types.ts`) is:
```ts
interface OnboardingData {
  timeGoal?: boolean
  goalTime?: { hours: number; minutes: number }
  selectedDays?: Day[]
  longRunDay?: Day
  // ... other fields
}
```

The steps array (from `getSteps()` in `types.ts`) is:
```
["findRace", "goalTime", "whichDays", "weeklyMileage", "strength"]
```

So `steps[currentStep] === "goalTime"` identifies when we're leaving the goal time step.

- [ ] **Step 1: Add `goalTimeChanged` helper and update `handleNext`**

  In `apps/web/components/onboarding/onboarding-flow.tsx`, find the `handleNext` function (line 291):

  ```ts
  function handleNext(data: Partial<OnboardingData>) {
    const merged = { ...formData, ...data }
    setFormData(merged)
    advance()
  }
  ```

  Replace it with:

  ```ts
  function goalTimeChanged(prev: OnboardingData, next: Partial<OnboardingData>): boolean {
    if (prev.timeGoal !== next.timeGoal) return true
    if (next.timeGoal === true) {
      return (
        prev.goalTime?.hours !== next.goalTime?.hours ||
        prev.goalTime?.minutes !== next.goalTime?.minutes
      )
    }
    return false
  }

  function handleNext(data: Partial<OnboardingData>) {
    let merged: OnboardingData = { ...formData, ...data }
    if (steps[currentStep] === "goalTime" && goalTimeChanged(formData, data)) {
      merged = { ...merged, selectedDays: undefined, longRunDay: undefined }
    }
    setFormData(merged)
    advance()
  }
  ```

  **Why this works:**
  - `goalTimeChanged` compares `timeGoal` (boolean flag) first. If it changed in either direction (true→false or false→true), that's a change.
  - If both sides have `timeGoal: true`, compares `hours` and `minutes` individually (value-based, not reference-based — the objects are always different instances).
  - If `prev.goalTime` is `undefined` and `next.goalTime` is defined with `timeGoal: true`, the `?.hours` access returns `undefined`, which differs from the incoming number — correctly detected as a change.
  - If neither `timeGoal` nor the time values changed, returns `false` and days are preserved.
  - `{ ...merged, selectedDays: undefined, longRunDay: undefined }` produces a new `OnboardingData` object where those two optional fields are absent, causing `StepWhichDays` to see `isFirstVisit = true` on the next render.

- [ ] **Step 2: Typecheck**

  ```bash
  pnpm typecheck
  ```

  Expected: no new errors.

- [ ] **Step 3: Smoke test in browser**

  Run `pnpm dev` and navigate to `/new-plan`. Walk through each scenario:

  **Scenario A — Goal time changes, days reset:**
  1. Select a full marathon race.
  2. Enter goal time `3:00` → advance. On which-days step, confirm 6-day preset is active.
  3. Go back to goal time. Change to `4:45`.
  4. Click Next. Confirm which-days step now shows 4-day preset active (not the old 6-day selection).
  5. Confirm recommendation message says "Based on your goal of 4:45, we recommend a 4-day running schedule."

  **Scenario B — Same goal time, days preserved:**
  1. Select a full marathon race.
  2. Enter goal time `3:00` → advance. Manually toggle to a custom 5-day selection on which-days.
  3. Go back to goal time. Leave `3:00` unchanged. Click Next.
  4. Confirm which-days step still shows the custom 5-day selection — days were not reset.

  **Scenario C — Goal time → no goal time, days reset:**
  1. Enter goal time `3:00` → advance. Confirm 6-day preset active.
  2. Go back to goal time. Click "I don't have a goal time".
  3. Confirm which-days step resets to 4-day preset with message "We've started you with a 4-day schedule — easy to adjust from here."

  **Scenario D — No goal time → goal time, days reset:**
  1. Click "I don't have a goal time" → advance. Confirm 4-day preset active.
  2. Go back to goal time. Enter `3:00` and click Next.
  3. Confirm which-days step shows 6-day preset.

- [ ] **Step 4: Commit**

  ```bash
  git add apps/web/components/onboarding/onboarding-flow.tsx
  git commit -m "fix: clear selected days when goal time changes during onboarding"
  ```
