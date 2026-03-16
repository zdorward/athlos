# Goal-Time-Driven Default Running Days Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Derive the default running day count from the user's marathon goal time during onboarding, add a 4-day preset, show a contextual recommendation message, fix mobile vertical centering, and update copy.

**Architecture:** All changes are in three files: `onboarding-flow.tsx` (one-line layout fix), `step-goal-time.tsx` (one-line copy change), and `step-which-days.tsx` (preset expansion, goal-time default logic, recommendation message, day bubble layout). `computeTrainingStructure` from `packages/ai` must also be exported before use.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS v4, TypeScript. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-03-16-goal-time-driven-default-running-days-design.md`

---

## Chunk 1: Simple changes

### Task 1: Mobile vertical centering

**Files:**
- Modify: `apps/web/components/onboarding/onboarding-flow.tsx:377`

- [ ] **Step 1: Make the change**

  In `onboarding-flow.tsx`, find the content wrapper on line 377:
  ```
  className="flex-1 flex items-start md:items-center justify-center px-6 md:px-16 lg:px-24 pb-10 md:pb-0"
  ```
  Replace `items-start md:items-center` with `items-center`:
  ```
  className="flex-1 flex items-center justify-center px-6 md:px-16 lg:px-24 pb-10 md:pb-0"
  ```

- [ ] **Step 2: Typecheck**

  ```bash
  pnpm typecheck
  ```
  Expected: no new errors.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/components/onboarding/onboarding-flow.tsx
  git commit -m "fix: vertically center onboarding step content on mobile"
  ```

---

### Task 2: Goal time step copy change

**Files:**
- Modify: `apps/web/components/onboarding/steps/step-goal-time.tsx:110`

- [ ] **Step 1: Make the change**

  In `step-goal-time.tsx`, find:
  ```tsx
  I just want to finish
  ```
  Replace with:
  ```tsx
  I don&apos;t have a goal time
  ```

- [ ] **Step 2: Typecheck**

  ```bash
  pnpm typecheck
  ```
  Expected: no new errors.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/components/onboarding/steps/step-goal-time.tsx
  git commit -m "fix: update goal time skip copy to 'I don't have a goal time'"
  ```

---

## Chunk 2: Export computeTrainingStructure + 4-day preset

### Task 3: Export computeTrainingStructure from @workspace/ai

**Files:**
- Modify: `packages/ai/src/index.ts:14`

`computeTrainingStructure` is defined in `packages/ai/src/pace-calculator.ts` but not exported from the package's public index. It lives in the same file as `computeGoalPeakMileage`, so extend that existing export line — do not add a new line pointing to a different file.

- [ ] **Step 1: Add the export**

  In `packages/ai/src/index.ts`, find line 14:
  ```ts
  export { computeGoalPeakMileage } from "./pace-calculator"
  ```
  Replace with:
  ```ts
  export { computeGoalPeakMileage, computeTrainingStructure } from "./pace-calculator"
  ```

- [ ] **Step 2: Typecheck**

  ```bash
  pnpm typecheck
  ```
  Expected: no new errors.

- [ ] **Step 3: Commit**

  ```bash
  git add packages/ai/src/index.ts
  git commit -m "feat: export computeTrainingStructure from @workspace/ai"
  ```

---

### Task 4: Add 4-day preset, update UI and day bubble layout

**Files:**
- Modify: `apps/web/components/onboarding/steps/step-which-days.tsx`

This task updates the `Preset` type, `PRESET_DEFAULTS`, `detectPreset`, the preset tab row (3 → 4 tabs), and the day bubble layout (centered → `justify-between`).

Note: `applyPreset` signature does **not** change — it is only ever called with a concrete `Preset` value from the tab button array `[4, 5, 6, 7]`, never with the `preset` state variable (which can be `null`). `null` preset state only affects which tab is highlighted.

- [ ] **Step 1: Update `Preset` type and `PRESET_DEFAULTS`**

  Replace lines 10–16:
  ```ts
  type Preset = 5 | 6 | 7

  const PRESET_DEFAULTS: Record<Preset, Day[]> = {
    5: ["mon", "tue", "thu", "fri", "sun"],
    6: ["mon", "tue", "wed", "thu", "fri", "sun"],
    7: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
  }
  ```
  With:
  ```ts
  type Preset = 4 | 5 | 6 | 7

  const PRESET_DEFAULTS: Record<Preset, Day[]> = {
    4: ["mon", "wed", "fri", "sun"],
    5: ["mon", "tue", "thu", "fri", "sun"],
    6: ["mon", "tue", "wed", "thu", "fri", "sun"],
    7: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
  }
  ```

- [ ] **Step 2: Update `detectPreset`**

  Replace lines 20–24:
  ```ts
  function detectPreset(days: Day[]): Preset {
    if (days.length <= 5) return 5
    if (days.length === 6) return 6
    return 7
  }
  ```
  With:
  ```ts
  function detectPreset(days: Day[]): Preset | null {
    if (days.length === 7) return 7
    if (days.length === 6) return 6
    if (days.length === 5) return 5
    if (days.length === 4) return 4
    return null
  }
  ```

- [ ] **Step 3: Update `preset` state type**

  On line 31, update the `useState` type annotation:
  ```ts
  const [preset, setPreset] = useState<Preset | null>(() => detectPreset(initialDays))
  ```

- [ ] **Step 4: Update preset tab row (3 tabs → 4 tabs)**

  Replace lines 71–86:
  ```tsx
  {/* Preset tabs */}
  <div className="flex gap-2">
    {([5, 6, 7] as Preset[]).map((p) => (
      <button
        key={p}
        onClick={() => applyPreset(p)}
        className={cn(
          "flex-1 cursor-pointer rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
          preset === p
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border hover:bg-muted"
        )}
      >
        {p} days
      </button>
    ))}
  </div>
  ```
  With:
  ```tsx
  {/* Preset tabs */}
  <div className="flex gap-2">
    {([4, 5, 6, 7] as Preset[]).map((p) => (
      <button
        key={p}
        onClick={() => applyPreset(p)}
        className={cn(
          "flex-1 cursor-pointer rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
          preset === p
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border hover:bg-muted"
        )}
      >
        {p} days
      </button>
    ))}
  </div>
  ```

- [ ] **Step 5: Update day bubble rows to `justify-between`**

  There are two day bubble rows (Running days and Long run day). Both currently use `"flex w-full justify-center gap-2"`.

  Replace both instances with `"flex w-full justify-between gap-2"` — change `justify-center` to `justify-between`, keep `gap-2` as the minimum spacing guarantee. The switch to `justify-between` distributes available space evenly between the 7 bubbles so they span edge-to-edge, giving each bubble more breathing room than the current centered layout.

  The first instance is on line 93, the second on line 116.

- [ ] **Step 6: Typecheck**

  ```bash
  pnpm typecheck
  ```
  Expected: no errors. If TypeScript complains about `Preset | null` being passed to `setPreset` in `toggleDay`, that's expected — `detectPreset` now returns `Preset | null` and `setPreset` accepts `Preset | null`.

- [ ] **Step 7: Commit**

  ```bash
  git add apps/web/components/onboarding/steps/step-which-days.tsx
  git commit -m "feat: add 4-day preset, 4-tab row, justify-between day bubbles"
  ```

---

## Chunk 3: Goal-time default + recommendation message

### Task 5: Compute default days from goal time and show recommendation message

**Files:**
- Modify: `apps/web/components/onboarding/steps/step-which-days.tsx`

**Prerequisite:** Chunk 2 must be applied before this task. `PRESET_DEFAULTS` must have a `4` key and `Preset` must be `4 | 5 | 6 | 7` before this code runs.

This task adds the import, computes the goal-time-driven default on first visit, and replaces the hardcoded subtitle with a contextual recommendation message.

- [ ] **Step 1: Add import**

  Add `computeTrainingStructure` to the imports at the top of the file. After the existing imports, add:
  ```ts
  import { computeTrainingStructure } from "@workspace/ai"
  ```

- [ ] **Step 2: Compute `defaultDays` and recommendation message**

  Inside `StepWhichDays`, before the `useState` calls, add the following block. This runs once at render time and is used to initialize state and derive the message.

  ```ts
  // Compute goal-time-driven default — only on first visit (selectedDays not yet set)
  const isFirstVisit = formData.selectedDays === undefined

  const defaultDays: Preset = (() => {
    if (!isFirstVisit) return 6 // unused on back-nav, but satisfies type
    if (!formData.race) return 6
    const { distance } = formData.race
    if (formData.timeGoal === true && formData.goalTime) {
      const goalMinutes = formData.goalTime.hours * 60 + formData.goalTime.minutes
      if (goalMinutes > 0) {
        const days = computeTrainingStructure(goalMinutes, distance, 7, "40-60").runDaysPerWeek
        // Guard: clamp to valid Preset range in case of unexpected output
        return (days in PRESET_DEFAULTS ? days : 5) as Preset
      }
    }
    return 4
  })()

  const recommendationMessage: string | null = (() => {
    if (!isFirstVisit) return null
    if (!formData.race) return null // no race = no contextual recommendation
    if (formData.timeGoal === true && formData.goalTime) {
      const { hours, minutes } = formData.goalTime
      const formatted = `${hours}:${String(minutes).padStart(2, "0")}`
      return `Based on your goal of ${formatted}, we recommend a ${defaultDays}-day running schedule.`
    }
    return `We've started you with a ${defaultDays}-day schedule — easy to adjust from here.`
  })()
  ```

- [ ] **Step 3: Update `initialDays` to use `defaultDays`**

  Replace line 30:
  ```ts
  const initialDays = formData.selectedDays ?? PRESET_DEFAULTS[6]
  ```
  With:
  ```ts
  const initialDays = formData.selectedDays ?? PRESET_DEFAULTS[defaultDays]
  ```

- [ ] **Step 4: Update `preset` initialization to use `defaultDays`**

  The `preset` state initialization currently calls `detectPreset(initialDays)`. On first visit this will correctly return `defaultDays` (since `initialDays` is `PRESET_DEFAULTS[defaultDays]`). No change needed here — `detectPreset` handles it.

- [ ] **Step 5: Replace subtitle with recommendation message**

  Replace lines 60–68 (the heading + old subtitle block):
  ```tsx
  <div className="space-y-2">
    <h2 className="text-2xl font-semibold tracking-tight">
      Set up your running week.
    </h2>
    <p className="text-sm text-muted-foreground">
      Most advanced runners train 6 days a week. Adjust to fit your
      schedule.
    </p>
  </div>
  ```
  With:
  ```tsx
  <div className="space-y-2">
    <h2 className="text-2xl font-semibold tracking-tight">
      Set up your running week.
    </h2>
    {recommendationMessage && (
      <p className="text-sm text-muted-foreground">{recommendationMessage}</p>
    )}
  </div>
  ```

- [ ] **Step 6: Typecheck**

  ```bash
  pnpm typecheck
  ```
  Expected: no errors. Double-check that `computeTrainingStructure` returns a `number` and the `as Preset` cast is accepted.

- [ ] **Step 7: Lint**

  ```bash
  pnpm lint
  ```
  Expected: no new errors.

- [ ] **Step 8: Smoke test in browser**

  Run `pnpm dev` and navigate to `/new-plan`. Walk through:
  1. Pick a full marathon race
  2. Enter goal time `3:00` → advance to which-days step. Expect: 6-day preset active, message "Based on your goal of 3:00, we recommend a 6-day running schedule."
  3. Go back, enter `4:30` → expect 5-day preset active, message says 5 days.
  4. Go back, click "I don't have a goal time" → expect 4-day preset active, message says "We've started you with a 4-day schedule..."
  5. Confirm all 4 preset tabs render in a single row and the active one is highlighted.
  6. Confirm day bubbles span edge-to-edge with even spacing between them.
  7. On mobile viewport (or DevTools mobile emulation), confirm content is vertically centered on the goal time step and which-days step.

- [ ] **Step 9: Commit**

  ```bash
  git add apps/web/components/onboarding/steps/step-which-days.tsx
  git commit -m "feat: goal-time-driven default days and recommendation message in onboarding"
  ```
