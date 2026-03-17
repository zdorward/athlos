# Scheduler Fixes, Shakeout Type, and Race Day Enhancements

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two confirmed scheduler bugs, investigate a third, add a shakeout workout type scheduled the day before the race, and populate targetHR/targetPace/description on race day entries.

**Architecture:** Changes span the plan-engine package (types, scheduler) and the web app (route, UI utils). All scheduler changes are covered by vitest unit tests before implementation. UI utils changes are covered by TypeScript strict-mode compilation. No database schema changes needed — targetHR and targetPace already exist as optional fields on WorkoutDay.

**Tech Stack:** TypeScript (strict), vitest, Next.js App Router API route, pnpm monorepo with Turbo

---

> **Note — Bug 1 (quality session buffer) deferred:** The originally designed fix (`circularDist > 2`) is mathematically incompatible with having 2 quality sessions per week in any 7-day schedule. In a 7-day week, `circularDist > 2` allows exactly 2 slots — and those 2 slots are always adjacent to each other, so the quality-quality adjacency check prevents placing both. A correct fix requires a directional constraint (block the N days *after* the long run, not circular distance) and a separate spec to get the geometry right. Bug 1 is not included in this plan.

---

## File Map

| File | Role in this plan |
|------|-------------------|
| `packages/plan-engine/src/types.ts` | Add `"shakeout"` to `WorkoutType` union |
| `packages/plan-engine/src/workout-scheduler.ts` | Fix strength-quality adjacency (Bug 2), shakeout scheduling, taper quality investigation |
| `packages/plan-engine/src/workout-scheduler.test.ts` | New tests for all scheduler changes |
| `apps/web/app/api/generate-plan/route.ts` | Add `targetPace` and `targetHR` to race entry |
| `apps/web/app/plan/workout-utils.ts` | Add shakeout to all lookup maps, update race `getWorkoutNote` and `getHRZone` |

---

## Task 1: Bug 2 — Strength sessions adjacent to quality sessions

**Files:**
- Modify: `packages/plan-engine/src/workout-scheduler.test.ts`
- Modify: `packages/plan-engine/src/workout-scheduler.ts`

**Background:** The strength candidate filter (around line 314 in `workout-scheduler.ts`) only excludes days adjacent to the long run. It does not exclude days adjacent to quality sessions. With longRunDay="sat", the quality session lands on Monday (the earliest non-adjacent-to-sat candidate). Wednesday strength is adjacent to Monday tempo — a direct violation of the science doc's "strength never adjacent to quality sessions" rule.

- [ ] **Step 1: Write the failing test**

Add this test to the `"scheduleWorkouts — strength sessions"` describe block in `workout-scheduler.test.ts`, after the existing adjacency tests (around line 348):

```ts
it("no strength session is adjacent to any quality session in the same week", () => {
  // Base phase: 1 tempo per week placed on earliest valid non-adjacent-to-sat day (Mon).
  // After placement, strength must not land on Tue (adjacent to Mon).
  const days = scheduleWorkouts({
    ...baseInput,
    selectedDays: ["mon", "tue", "wed", "thu", "fri", "sat"],
    longRunDay: "sat",
    phases: [{ name: "Base", startWeek: 1, endWeek: 4 }],
    trainingStructure: { runDaysPerWeek: 6, restDaysPerWeek: 1, maxQualitySessions: 1 },
    peakWeeklyKm: 80,
  })
  const strengthDays = days.filter(d => d.type === "strength")
  const qualityDays  = days.filter(d => ["tempo", "intervals", "mp"].includes(d.type))

  strengthDays.forEach(s => {
    const sameWeekQuality = qualityDays.filter(q => {
      const diff = Math.abs(new Date(s.date).getTime() - new Date(q.date).getTime())
      return diff < 7 * 86400000
    })
    sameWeekQuality.forEach(q => {
      expect(isAdjacentTo(dayKeyOf(s.date), dayKeyOf(q.date))).toBe(false)
    })
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
cd /Users/zackdorward/dev/athlos
pnpm --filter @workspace/plan-engine test -- --reporter=verbose 2>&1 | grep -A3 "adjacent to any quality"
```

Expected: FAIL — strength lands on Wednesday (adjacent to Monday tempo).

- [ ] **Step 3: Fix the strength candidate filter**

In `workout-scheduler.ts`, find the strength section (around line 310). Before the `sCandidates` filter, add a collection of placed quality day keys:

```ts
// Collect quality day keys for adjacency exclusion
const qualityDayKeys = placedQuality.map(q =>
  weekDays.find(w => w.date === q.date)?.dayKey ?? ""
).filter(Boolean)
```

Then in the `sCandidates` filter (around line 314), add the quality adjacency check alongside the existing long run check:

```ts
const sCandidates = weekDays.filter(({ dayKey, date }) => {
  const workouts = assigned.get(date)
  return (
    workouts?.some(w => w.type === "easy") &&
    !isAdjacentTo(dayKey, longRunDay) &&
    qualityDayKeys.every(qDay => !isAdjacentTo(dayKey, qDay))
  )
})
```

- [ ] **Step 4: Run the test and confirm it passes**

```bash
pnpm --filter @workspace/plan-engine test -- --reporter=verbose 2>&1 | grep -A3 "adjacent to any quality"
```

Expected: PASS

- [ ] **Step 5: Run the full scheduler test suite**

```bash
pnpm --filter @workspace/plan-engine test -- --reporter=verbose
```

Expected: All tests pass. Some strength count tests may show reduced counts on tightly-constrained schedules (fewer eligible days after excluding quality-adjacent slots) — this is correct behaviour. If any test asserts an exact strength count that no longer holds, verify the test's selectedDays still allow the expected number of non-adjacent, non-quality-adjacent easy days and update the assertion accordingly.

- [ ] **Step 6: Commit**

```bash
git add packages/plan-engine/src/workout-scheduler.test.ts packages/plan-engine/src/workout-scheduler.ts
git commit -m "fix: exclude strength candidates adjacent to quality session days"
```

---

## Task 2: Investigate taper quality session count

**Files:**
- Modify: `packages/plan-engine/src/workout-scheduler.test.ts`
- Modify: `packages/plan-engine/src/workout-scheduler.ts` (if fix needed)

**Background:** Some generated plans show 2 quality sessions in taper week 1 instead of the 1 allowed by `PHASE_CONFIG["Taper"].first.normal = { sessions: 1, types: ["tempo"] }`. Root cause is unconfirmed. Candidate causes: `computePhases` sets a `startWeek` for Taper that `phaseForWeek` classifies as Peak; or an `isRecovery` edge case at the taper boundary; or an off-by-one in `preTaperWeeks`.

- [ ] **Step 1: Write a diagnostic test with a realistic full-plan phase structure**

Add this test to the `"phase config — quality session types"` describe block, after the existing taper tests:

```ts
it("taper week 1 gets exactly 1 tempo even with Peak immediately prior (full 29-week plan)", () => {
  // Mirrors a real 29-week full marathon plan.
  // startDate 2026-03-23 (Monday). Week 27 starts on 2026-09-21.
  const phases: PhaseEntry[] = [
    { name: "General Fitness", startWeek: 1,  endWeek: 6  },
    { name: "Base",            startWeek: 7,  endWeek: 15 },
    { name: "Build",           startWeek: 16, endWeek: 22 },
    { name: "Peak",            startWeek: 23, endWeek: 26 },
    { name: "Taper",           startWeek: 27, endWeek: 29 },
  ]
  const days = scheduleWorkouts({
    startDate: "2026-03-23",
    selectedDays: ["mon", "tue", "wed", "thu", "fri", "sun"],
    longRunDay: "sun",
    weeklyMileageRange: "60-80" as const,
    phases,
    totalWeeks: 29,
    peakWeeklyKm: 100,
    trainingStructure: { runDaysPerWeek: 6, restDaysPerWeek: 1, maxQualitySessions: 2 },
    longRunTargets: { peakLongRunKm: 35, recoveryRunMaxKm: 13 },
    paceZones,
  })
  // Taper W1 = week 27. startDate + (27-1)*7 = 2026-03-23 + 182 days = 2026-09-21.
  const taperW1Start = "2026-09-21"
  const taperW1End   = "2026-09-27"
  const taperW1Quality = days.filter(d =>
    d.date >= taperW1Start &&
    d.date <= taperW1End &&
    (d.type === "tempo" || d.type === "mp" || d.type === "intervals")
  )
  expect(taperW1Quality).toHaveLength(1)
  expect(taperW1Quality[0]!.type).toBe("tempo")
})
```

- [ ] **Step 2: Run the test**

```bash
pnpm --filter @workspace/plan-engine test -- --reporter=verbose 2>&1 | grep -A5 "taper week 1 gets exactly"
```

- If it **passes**: the taper quality issue does not reproduce in unit tests — the bug may be a display artifact or related to the strength-adjacency fix in Task 1 (which changes available easy days). No scheduler fix needed here. Proceed to Task 3.
- If it **fails**: continue to Step 3.

- [ ] **Step 3 (if test fails): Trace the root cause**

Add a temporary `console.log` before the quality session loop in `workout-scheduler.ts` to inspect classification for week 27:

```ts
// Temporary diagnostic — remove before committing
if (week === 27) {
  console.log(`Week ${week}: phase=${phase}, isRecovery=${isRecovery}, sessions=${sessions}, types=${JSON.stringify(types)}`)
}
```

Run the test and inspect the output. Look for `phase` being "Peak" when it should be "Taper", or `sessions` being 2 when it should be 1.

Fix the misclassification at its source (in `phaseForWeek`, `getQualityConfig`, or `computePhases`). Remove the console.log before committing.

- [ ] **Step 4: Run the full test suite**

```bash
pnpm --filter @workspace/plan-engine test -- --reporter=verbose
```

Expected: All tests pass including the new taper test.

- [ ] **Step 5: Commit**

```bash
git add packages/plan-engine/src/workout-scheduler.test.ts packages/plan-engine/src/workout-scheduler.ts
git commit -m "fix: ensure taper week 1 produces exactly 1 tempo quality session"
```

---

## Task 3: Add shakeout type to plan-engine

**Files:**
- Modify: `packages/plan-engine/src/types.ts`
- Modify: `packages/plan-engine/src/workout-scheduler.ts`
- Modify: `packages/plan-engine/src/workout-scheduler.test.ts`

**Background:** A shakeout is a short 5 km easy run the day before the race. Currently forced to rest. The spec requires it always be scheduled regardless of the user's selected training days.

- [ ] **Step 1: Add `"shakeout"` to WorkoutType**

In `packages/plan-engine/src/types.ts`, add `"shakeout"` to the union (after `"race"`):

```ts
export type WorkoutType =
  | "easy"
  | "long"
  | "progression"
  | "medium-long"
  | "mp"
  | "tempo"
  | "intervals"
  | "rest"
  | "race"
  | "strength"
  | "shakeout"
```

- [ ] **Step 2: Write the failing tests for shakeout scheduling**

In `workout-scheduler.test.ts`, find the `"scheduleWorkouts — race week"` describe block. The existing `raceInput` fixture has `raceDateISO: "2026-06-28"` (Sunday) and `longRunDay: "sat"`, so the pre-race day is Saturday June 27.

**Replace** the existing test `"pre-race day (Sat) gets type rest"` (around line 638) with the following — delete the old `it()` block entirely, do not leave both in the file:

```ts
it("pre-race day gets a shakeout run, not rest", () => {
  const days = scheduleWorkouts(raceInput)
  const preRaceDay = days.find(d => d.date === "2026-06-27")
  expect(preRaceDay?.type).toBe("shakeout")
  expect(preRaceDay?.distanceKm).toBe(5)
  expect(preRaceDay?.targetPace).toBe(paceZones.easy)
})
```

Add a new test confirming shakeout appears even when the pre-race day is not in selectedDays:

```ts
it("shakeout appears on pre-race day even if that day is not in selectedDays", () => {
  // raceInput selectedDays: ["mon","wed","fri","sat"]. Use a race on Monday so
  // the pre-race day (Sunday) is not in selectedDays.
  const days = scheduleWorkouts({
    ...raceInput,
    selectedDays: ["mon", "wed", "fri", "sat"],
    longRunDay: "sat",
    raceDateISO: "2026-06-29", // Monday — pre-race day = Sunday June 28
  })
  const preRaceDay = days.find(d => d.date === "2026-06-28")
  expect(preRaceDay?.type).toBe("shakeout")
  expect(preRaceDay?.distanceKm).toBe(5)
})
```

- [ ] **Step 3: Run the tests and confirm they fail**

```bash
pnpm --filter @workspace/plan-engine test -- --reporter=verbose 2>&1 | grep -E "(shakeout|pre-race)"
```

Expected: FAIL — pre-race day currently returns rest.

- [ ] **Step 4: Implement shakeout scheduling**

In `workout-scheduler.ts`, find the race week block (starting around line 203 with `if (input.raceDateISO && week === totalWeeks)`).

Replace the block with this updated version that assigns the shakeout before the easy run distribution:

```ts
// ── Race week (early exit) ──
if (input.raceDateISO && week === totalWeeks) {
  const preRaceDate = addDaysToISO(input.raceDateISO, -1)
  const excludedDates = new Set(
    weekDays
      .filter(d => d.date === input.raceDateISO || d.date === preRaceDate)
      .map(d => d.date)
  )

  // Shakeout on pre-race day — always, regardless of selectedDays
  const preRaceEntry = weekDays.find(d => d.date === preRaceDate)
  if (preRaceEntry) {
    assigned.set(preRaceDate, [{
      date: preRaceDate,
      type: "shakeout",
      distanceKm: 5,
      targetPace: paceZones.easy,
    }])
  }

  // Easy runs on selected days (excluding race and pre-race)
  const eligibleDays = weekDays.filter(
    d => selectedDays.includes(d.dayKey) && !excludedDates.has(d.date)
  )
  if (eligibleDays.length > 0 && weeklyKm > 0) {
    const perDay = round05(weeklyKm / eligibleDays.length)
    for (const ed of eligibleDays) {
      assigned.set(ed.date, [{
        date: ed.date, type: "easy", distanceKm: perDay, targetPace: paceZones.easy,
      }])
    }
  }
  for (const { date } of weekDays) {
    if (!assigned.has(date)) assigned.set(date, [{ date, type: "rest" }])
  }
  for (const { date } of weekDays) {
    result.push(...(assigned.get(date) ?? [{ date, type: "rest" as const }]))
  }
  continue
}
```

The shakeout is set into `assigned` before the `eligibleDays` loop. `preRaceDate` is in `excludedDates`, so the easy run loop skips it. The rest-day fallback also skips it because `assigned.has(preRaceDate)` is true.

- [ ] **Step 5: Run the shakeout tests and confirm they pass**

```bash
pnpm --filter @workspace/plan-engine test -- --reporter=verbose 2>&1 | grep -E "(shakeout|pre-race)"
```

Expected: PASS

- [ ] **Step 6: Run the full scheduler test suite**

```bash
pnpm --filter @workspace/plan-engine test -- --reporter=verbose
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/plan-engine/src/types.ts packages/plan-engine/src/workout-scheduler.ts packages/plan-engine/src/workout-scheduler.test.ts
git commit -m "feat: add shakeout workout type, scheduled day before race"
```

---

## Task 4: Add shakeout to workout-utils.ts

**Files:**
- Modify: `apps/web/app/plan/workout-utils.ts`

**Background:** `workout-utils.ts` has five places that cover `WorkoutType`: `WORKOUT_NAMES`, `WORKOUT_TEXT_CLASS`, `getWorkoutNote`, `getHRZone`, and the partial `getWorkoutColor`. TypeScript strict mode will catch missed cases in switch statements.

- [ ] **Step 1: Add shakeout to all lookup locations**

Edit `apps/web/app/plan/workout-utils.ts`. Make these four additions:

**`WORKOUT_NAMES`** — add after `race`:
```ts
shakeout: "Shakeout",
```

**`WORKOUT_TEXT_CLASS`** — add after `race`:
```ts
shakeout: "text-muted-foreground",
```

**`getWorkoutNote` switch** — add after the `race` case:
```ts
case "shakeout":
  return "Short shakeout to activate your legs. Keep it easy — you're not training today."
```

**`getHRZone` switch** — `race`, `rest`, and `strength` currently share a case returning `"—"`. Split them and add `shakeout`:
```ts
case "strength":
case "rest":      return "—"
case "race":      return "Zone 3"
case "shakeout":  return "Zone 1"
```

No entry is needed in `getWorkoutColor` — shakeout uses the Tailwind class (`"text-muted-foreground"`) and `getWorkoutColor` only handles types with empty Tailwind classes.

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: No errors. TypeScript will flag any missed exhaustive case.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/plan/workout-utils.ts
git commit -m "feat: add shakeout workout type to UI lookup tables"
```

---

## Task 5: Race day enhancements

**Files:**
- Modify: `apps/web/app/api/generate-plan/route.ts`
- Modify: `apps/web/app/plan/workout-utils.ts`

**Background:** The race `WorkoutDay` is built in `route.ts` around line 136. Currently only `date`, `type`, and `distanceKm` are set. `paceZones.mp` is already computed in the route and represents the runner's actual goal race pace. The detail view already renders `targetHR` and `targetPace` when present on a `WorkoutDay`.

- [ ] **Step 1: Add targetPace and targetHR to the race entry**

In `apps/web/app/api/generate-plan/route.ts`, find the `raceEntry` construction (around line 136):

```ts
const raceEntry = { date: raceDateISO, type: "race" as const, distanceKm: raceDistanceKm }
```

Replace with:

```ts
const raceEntry = {
  date: raceDateISO,
  type: "race" as const,
  distanceKm: raceDistanceKm,
  targetPace: paceZones.mp,
  targetHR: "Zone 3",
}
```

`paceZones` is already in scope at this point.

- [ ] **Step 2: Update race note and HR zone in workout-utils.ts**

In `apps/web/app/plan/workout-utils.ts`:

Find the `race` case in `getWorkoutNote` (around line 125):
```ts
case "race":
  return "Race day — execute your plan."
```
Replace with:
```ts
case "race":
  return "Race day. Start conservative — first half at goal pace, finish strong if you have it."
```

The `getHRZone` change was already made in Task 4 (splitting the shared case). Confirm `race` now returns `"Zone 3"`.

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/generate-plan/route.ts apps/web/app/plan/workout-utils.ts
git commit -m "feat: add targetPace, targetHR, and updated description to race day entries"
```

---

## Task 6: Final verification

- [ ] **Step 1: Run the full test suite**

```bash
pnpm test
```

Expected: All tests pass.

- [ ] **Step 2: Run typecheck across all packages**

```bash
pnpm typecheck
```

Expected: Zero errors.

- [ ] **Step 3: Start the dev server and generate a test plan**

```bash
pnpm dev
```

Open the app, generate a full marathon plan with a 6-day schedule. Verify:
- Strength sessions are not adjacent to quality session days
- Taper week 1 has exactly 1 tempo session
- The day before the race shows "Shakeout" at 5 km with easy pace target
- Race day shows target pace (marathon pace zone), Zone 3 HR, and the updated note

- [ ] **Step 4: Commit any final fixups if needed**
