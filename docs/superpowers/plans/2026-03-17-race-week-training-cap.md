# Race Week Training Cap Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cap pre-race easy run volume in race week at 20% of `peakWeeklyKm` so runners aren't accumulating 40+ km of fatigue in the week before their marathon.

**Architecture:** One constant (`RACE_WEEK_TRAINING_RATIO = 0.20`) added near the top of `workout-scheduler.ts`, one `Math.min` call in the race week handler. Two existing tests updated, one new test added.

**Tech Stack:** TypeScript, Vitest, pnpm monorepo (Turbo)

---

## File Structure

| File | Change |
|------|--------|
| `packages/plan-engine/src/workout-scheduler.ts` | Add `RACE_WEEK_TRAINING_RATIO = 0.20` constant; cap easy run distribution at `peakWeeklyKm * RACE_WEEK_TRAINING_RATIO` in race week handler |
| `packages/plan-engine/src/workout-scheduler.test.ts` | Update "race week easy run total" test bounds; add per-day distance test |

---

## Background for the implementer

In `scheduleWorkouts` in `workout-scheduler.ts`, the race week early-exit path (around line 202) handles the final week of a plan when `raceDateISO` is set. It:
1. Assigns a shakeout (5 km) on the pre-race day
2. Distributes `weeklyKm` across remaining selected easy run days
3. Fills everything else with rest

`weeklyKm` for the last taper week comes from `computeWeeklyVolumes`, which returns `peakWeeklyKm * 0.4` for taper week 3. For a 100 km peak plan this is 40 km — too much pre-race running. The fix: cap it at 20 km using `Math.min`.

The test file has a `describe("scheduleWorkouts — race week", ...)` block (around line 704). The test named `"race week easy run total ≈ peakWeeklyKm * 0.4 (within 2 km)"` (around line 775) currently asserts `easyKm > 38 && easyKm < 42` — this will break after the fix and must be updated.

---

## Task 1: Cap race week pre-race training at 20 km

**Files:**
- Modify: `packages/plan-engine/src/workout-scheduler.ts` (add constant after line 36; update race week handler around line 226)
- Test: `packages/plan-engine/src/workout-scheduler.test.ts`

### Step 1: Write 2 failing tests (one updated, one new)

In `packages/plan-engine/src/workout-scheduler.test.ts`, find the test `"race week easy run total ≈ peakWeeklyKm * 0.4 (within 2 km)"` (around line 775) and replace it entirely with:

```ts
it("race week easy run total is capped at 20 km", () => {
  // peakWeeklyKm=100; taper week 4 → 40% = 40 km, but cap = 100 * 0.20 = 20 km
  // eligible days: mon/wed/fri (3 days); round05(20/3) = 6.5 km each → 19.5 km total
  const days = week4Days(scheduleWorkouts(raceInput))
  const easyKm = days
    .filter(d => d.type === "easy")
    .reduce((s, d) => s + (d.distanceKm ?? 0), 0)
  expect(easyKm).toBeGreaterThan(18)
  expect(easyKm).toBeLessThanOrEqual(20)
})
```

Then add this new test immediately after it:

```ts
it("race week easy runs are short jogs (≤ 7 km each)", () => {
  // With cap=20 km and 3 eligible days, each easy run should be round05(20/3)=6.5 km
  const days = week4Days(scheduleWorkouts(raceInput))
  const easyDays = days.filter(d => d.type === "easy")
  easyDays.forEach(d => {
    expect(d.distanceKm).toBeDefined()
    expect(d.distanceKm!).toBeLessThanOrEqual(7)
  })
})
```

### Step 2: Run tests to verify they fail

```bash
pnpm --filter @workspace/plan-engine test -- workout-scheduler
```

Expected: the 2 new/updated race week tests fail. All other tests pass.

### Step 3: Add the constant and apply the fix

In `packages/plan-engine/src/workout-scheduler.ts`, add the constant after the `round05` function (after line 39):

```ts
const RACE_WEEK_TRAINING_RATIO = 0.20
```

Then in the race week handler (around line 226), replace:

```ts
// Before
const perDay = round05(weeklyKm / eligibleDays.length)
```

With:

```ts
// After
const raceWeekTrainingKm = Math.min(weeklyKm, peakWeeklyKm * RACE_WEEK_TRAINING_RATIO)
const perDay = round05(raceWeekTrainingKm / eligibleDays.length)
```

`peakWeeklyKm` is already in scope — it is destructured from `input` at the top of `scheduleWorkouts` (around line 171).

### Step 4: Run tests to verify everything passes

```bash
pnpm --filter @workspace/plan-engine test -- workout-scheduler
```

Expected: all tests pass, no failures.

### Step 5: Commit

```bash
git add packages/plan-engine/src/workout-scheduler.ts packages/plan-engine/src/workout-scheduler.test.ts
git commit -m "fix: cap race week pre-race training at 20% of peak

Running 40+ km in the 6 days before a marathon accumulates fatigue
when the runner needs to arrive fresh. The race week handler previously
distributed the full taper volume (peakWeeklyKm * 0.4) across easy run
days, ignoring that the marathon itself is the week's primary event.
RACE_WEEK_TRAINING_RATIO = 0.20 caps the easy run budget to short
maintenance jogs that scale with the runner's mileage level."
```
