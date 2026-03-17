# Build Phase Interval Distribution Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the early/late Build split so 16, 18, and 21-week plans produce 2 interval sessions instead of 1, and give interval workouts a concrete rep prescription in the day-detail note.

**Architecture:** Two independent changes — a one-line fix in the scheduler's `getQualityConfig` (changes `Math.floor(buildLength / 2)` to `Math.ceil(buildLength * 0.6)`), and an updated `getWorkoutNote` case for intervals in `workout-utils.ts` that computes rep count from `distanceKm`. Each task is self-contained and commits independently.

**Tech Stack:** TypeScript, Vitest, pnpm monorepo (Turbo)

---

## File Structure

| File | Change |
|------|--------|
| `packages/plan-engine/src/workout-scheduler.ts` | 1-line change to early/late Build boundary |
| `packages/plan-engine/src/workout-scheduler.test.ts` | Update 2 broken tests + stale comments; add 3 new tests for 16/18/21-week plans |
| `apps/web/app/plan/workout-utils.ts` | Update `intervals` case in `getWorkoutNote` |
| `apps/web/app/plan/workout-utils.test.ts` | Create; 4 unit tests for the updated note |

---

## Task 1: Fix early/late Build boundary in workout-scheduler.ts

**Files:**
- Modify: `packages/plan-engine/src/workout-scheduler.ts:112`
- Test: `packages/plan-engine/src/workout-scheduler.test.ts`

### Background for the implementer

`getQualityConfig` in `workout-scheduler.ts` decides whether a Build week is "early" (tempo + intervals) or "late" (tempo + MP). The current boundary is `Math.floor(buildLength / 2)`, which produces only 1 interval session for 16, 18, and 21-week plans because a recovery week consumes the last early-Build slot. Changing to `Math.ceil(buildLength * 0.6)` adds one more early-Build week for those plan lengths.

Recovery weeks are any week where `week % 4 === 0` — they drop to 1 quality session (tempo only). This is unchanged.

The boundary change also shifts what the existing "Build second half" and "late Build gets tempo + mp" tests are checking — those tests will break and need updating to point at the correct week index.

- [ ] **Step 1: Write 3 failing tests for 16, 18, and 21-week plans**

Add to the bottom of the `describe("phase config — quality session types", ...)` block in `packages/plan-engine/src/workout-scheduler.test.ts` (currently ends around line 620):

```ts
it("16-week plan: 2 intervals sessions after early Build boundary fix", () => {
  // Build = W7–10 (4 wks). New early: ceil(4*0.6)=3 → W7–9.
  // W8 is recovery (8%4=0). Non-recovery early: W7, W9 → 2 intervals.
  const phases: PhaseEntry[] = [
    { name: "Base",  startWeek: 1, endWeek: 6 },
    { name: "Build", startWeek: 7, endWeek: 10 },
    { name: "Peak",  startWeek: 11, endWeek: 13 },
    { name: "Taper", startWeek: 14, endWeek: 16 },
  ]
  const days = scheduleWorkouts(makeInput(phases, 16))
  expect(days.filter(d => d.type === "intervals")).toHaveLength(2)
})

it("18-week plan: 2 intervals sessions after early Build boundary fix", () => {
  // Build = W8–12 (5 wks). New early: ceil(5*0.6)=3 → W8–10.
  // W8 is recovery (8%4=0). Non-recovery early: W9, W10 → 2 intervals.
  const phases: PhaseEntry[] = [
    { name: "Base",  startWeek: 1, endWeek: 7 },
    { name: "Build", startWeek: 8, endWeek: 12 },
    { name: "Peak",  startWeek: 13, endWeek: 15 },
    { name: "Taper", startWeek: 16, endWeek: 18 },
  ]
  const days = scheduleWorkouts(makeInput(phases, 18))
  expect(days.filter(d => d.type === "intervals")).toHaveLength(2)
})

it("21-week plan: 2 intervals sessions after early Build boundary fix", () => {
  // Build = W11–15 (5 wks). New early: ceil(5*0.6)=3 → W11–13.
  // W12 is recovery (12%4=0). Non-recovery early: W11, W13 → 2 intervals.
  const phases: PhaseEntry[] = [
    { name: "General Fitness", startWeek: 1, endWeek: 4 },
    { name: "Base",  startWeek: 5, endWeek: 10 },
    { name: "Build", startWeek: 11, endWeek: 15 },
    { name: "Peak",  startWeek: 16, endWeek: 18 },
    { name: "Taper", startWeek: 19, endWeek: 21 },
  ]
  const days = scheduleWorkouts(makeInput(phases, 21))
  expect(days.filter(d => d.type === "intervals")).toHaveLength(2)
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @workspace/plan-engine test -- workout-scheduler
```

Expected: the 3 new tests fail with `expected 1 to equal 2`. All other tests pass.

- [ ] **Step 3: Apply the one-line fix**

In `packages/plan-engine/src/workout-scheduler.ts`, find line 112 (inside `getQualityConfig`, the Build branch):

```ts
// Before
const slot = localIndex < Math.floor(buildLength / 2)
```

Change to:

```ts
// After
const slot = localIndex < Math.ceil(buildLength * 0.6)
```

- [ ] **Step 4: Run tests to check new tests pass and find broken existing tests**

```bash
pnpm --filter @workspace/plan-engine test -- workout-scheduler
```

Expected: the 3 new tests now pass. Two existing tests now fail:
- `"Build second half: 2 sessions — tempo first, then mp"` — was checking Build W3 (localIndex 2), which is now early Build under the new formula
- `"late Build gets tempo + mp"` — was checking W5 of an 8-week Build (localIndex 4), which is now early Build under the new formula

- [ ] **Step 5: Fix "Build second half" test**

This test uses a 6-week plan with `Build: W3–W6` (4 weeks, `buildLength = 4`). New early boundary: `ceil(4 * 0.6) = 3`, so localIndex 0–2 are early, localIndex 3 is the first late week.

Build W4 = localIndex 3 = plan week 6 = **July 6–12** (plan starts June 1; W3=June 15, W4=June 22, W5=June 29, W6=July 6).

Update in `packages/plan-engine/src/workout-scheduler.test.ts` around line 190–207:

```ts
it("Build second half: 2 sessions — tempo first, then mp", () => {
  const days = scheduleWorkouts({
    ...baseInput,
    totalWeeks: 6,
    trainingStructure: { runDaysPerWeek: 4, restDaysPerWeek: 3, maxQualitySessions: 2 },
    phases: [
      { name: "Base",  startWeek: 1, endWeek: 2 },
      { name: "Build", startWeek: 3, endWeek: 6 },
    ],
    peakWeeklyKm: 80,
  })
  // Build W4 (local index 3 >= ceil(4*0.6)=3) = late half = tempo + mp
  const buildW4 = days.filter(d => d.date >= "2026-07-06" && d.date <= "2026-07-12" && ["tempo","mp","intervals"].includes(d.type))
  expect(buildW4).toHaveLength(2)
  const types = buildW4.map(d => d.type)
  expect(types).toContain("tempo")
  expect(types).toContain("mp")
})
```

Also update the stale comment on the early half test (around line 182):
```ts
// Before
// Build week 1 (startWeek=3, local index 0 < floor(4/2)=2) = early half = tempo + intervals
// After
// Build week 1 (startWeek=3, local index 0 < ceil(4*0.6)=3) = early half = tempo + intervals
```

- [ ] **Step 6: Fix "late Build gets tempo + mp" test**

This test uses an 8-week Build (`buildLength = 8`). New early boundary: `ceil(8 * 0.6) = 5`, so localIndex 0–4 are early, localIndex 5+ are late. W6 of Build = localIndex 5 = dayDiff 35–41.

Update in `packages/plan-engine/src/workout-scheduler.test.ts` around line 503–520:

```ts
it("late Build gets tempo + mp", () => {
  // 8-week Build; weeks 6-8 are late (localIndex 5-7 >= ceil(8*0.6)=5)
  const phases: PhaseEntry[] = [
    { name: "Build", startWeek: 1, endWeek: 8 },
  ]
  const days = scheduleWorkouts(makeInput(phases, 8))
  // Week 6 (localIndex 5 >= 5 → late) should have both tempo and mp, no intervals
  const week6 = days.filter(d => {
    const d0 = new Date("2026-06-01T00:00:00Z")
    const dDate = new Date(d.date + "T00:00:00Z")
    const dayDiff = Math.floor((dDate.getTime() - d0.getTime()) / 86400000)
    return dayDiff >= 35 && dayDiff < 42
  })
  const types = week6.map(d => d.type)
  expect(types).toContain("tempo")
  expect(types).toContain("mp")
  expect(types).not.toContain("intervals")
})
```

Also update the stale comment on the early Build test (around line 485–486):
```ts
// Before
// 8-week Build; weeks 1-3 are early (localIndex 0-2 < floor(8/2)=4)
// After
// 8-week Build; weeks 1-4 are early (localIndex 0-3 < ceil(8*0.6)=5)
```

And the now-stale inline comment around line 491:
```ts
// Before
// Week 1 (localIndex 0 < 4 → early) should have both tempo and intervals
// After
// Week 1 (localIndex 0 < 5 → early) should have both tempo and intervals
```

And the late Build test comment around line 504 and 509:
```ts
// Before (line 504)
// 8-week Build; weeks 5-8 are late (localIndex 4-7 >= 4)
// After
// 8-week Build; weeks 6-8 are late (localIndex 5-7 >= ceil(8*0.6)=5)

// Before (line 509)
// Week 5 (localIndex 4 >= 4 → late) should have both tempo and mp, no intervals
// After
// Week 6 (localIndex 5 >= 5 → late) should have both tempo and mp, no intervals
```

- [ ] **Step 7: Run all tests to verify everything passes**

```bash
pnpm --filter @workspace/plan-engine test -- workout-scheduler
```

Expected: all tests pass, no failures.

- [ ] **Step 8: Commit**

```bash
git add packages/plan-engine/src/workout-scheduler.ts packages/plan-engine/src/workout-scheduler.test.ts
git commit -m "fix: widen early Build window from 50% to 60% for more interval sessions

16, 18, and 21-week plans previously produced only 1 interval session
because a recovery week fell at the 50% early/late Build boundary,
consuming the only non-recovery early-Build slot. Changing to
Math.ceil(buildLength * 0.6) adds one more early-Build week for those
plan lengths, yielding 2 interval sessions as the science doc requires."
```

---

## Task 2: Prescribe rep count and pace in intervals workout note

**Files:**
- Modify: `apps/web/app/plan/workout-utils.ts:120-121`
- Create: `apps/web/app/plan/workout-utils.test.ts`

### Background for the implementer

`getWorkoutNote(day: WorkoutDay, units: "km" | "miles")` in `workout-utils.ts` returns a static coaching note for each workout type. The intervals case currently returns `"Hard efforts with full recovery between reps."` — no rep count, no pace.

The new note computes rep count from `day.distanceKm`: `Math.max(3, Math.round(distanceKm - 2))` (subtracts ~2km overhead for warmup/cooldown). Includes `day.targetPace` inline if present. Falls back gracefully when fields are absent.

- [ ] **Step 1: Create test file with 4 failing tests**

Create `apps/web/app/plan/workout-utils.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter web test
```

Expected: 4 tests fail — the current note is `"Hard efforts with full recovery between reps."` which matches none of the expected strings.

- [ ] **Step 3: Update the intervals case in getWorkoutNote**

In `apps/web/app/plan/workout-utils.ts`, replace lines 120–121:

```ts
// Before
case "intervals":
  return "Hard efforts with full recovery between reps."
```

With:

```ts
// After
case "intervals": {
  if (day.distanceKm == null) {
    return "800m–1km repeats at VO2max pace with 2–3 min jog recovery."
  }
  const reps = Math.max(3, Math.round(day.distanceKm - 2))
  const paceStr = day.targetPace != null
    ? ` at ${day.targetPace}`
    : " at VO2max pace"
  return `${reps}×1km${paceStr} with 2–3 min jog recovery. Stop the session if your pace slips — quality over quantity.`
}
```

- [ ] **Step 4: Run tests to verify they all pass**

```bash
pnpm --filter web test
```

Expected: all 4 tests pass.

- [ ] **Step 5: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/plan/workout-utils.ts apps/web/app/plan/workout-utils.test.ts
git commit -m "feat: prescribe rep count and pace in intervals workout note

Replaces the generic 'Hard efforts with full recovery between reps.'
with a concrete prescription: NxN1km at [pace] with 2-3 min jog recovery.
Rep count is derived from distanceKm minus ~2km warmup/cooldown overhead,
floored at 3. Falls back gracefully when distanceKm or targetPace are absent."
```
