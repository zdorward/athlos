# Race Week Generation & Blank Cell Fixes Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate proper easy shakeout runs for race week and replace blank calendar cells with labeled rest days.

**Architecture:** Four targeted changes across the plan engine and calendar. The scheduler receives the race date and skips its normal long-run/quality logic for the final week, distributing easy runs instead. The route extends `totalWeeks` by 1 so that week is generated at all. Bridge runs emit rest entries for non-selected days. The calendar renders "Rest Day" for any day missing from the data.

**Tech Stack:** TypeScript, Vitest (plan-engine tests), Next.js App Router (route), React (calendar component). Run all commands from repo root with `pnpm`.

---

## File Map

| File | Change |
|------|--------|
| `packages/plan-engine/src/workout-scheduler.ts` | Add `raceDateISO?: string` to `SchedulerInput`; add race week early-exit path in main loop |
| `packages/plan-engine/src/workout-scheduler.test.ts` | New `describe` block: race week behaviour |
| `packages/plan-engine/src/bridge-runs.ts` | Emit `{ type: "rest" }` for non-selected days in bridge period |
| `packages/plan-engine/src/bridge-runs.test.ts` | New tests: rest entries for non-selected bridge days |
| `apps/web/app/api/generate-plan/route.ts` | `totalWeeks + 1` with minimum guard; pass `raceDateISO` |
| `apps/web/app/plan/plan-calendar.tsx` | Replace empty placeholder with "Rest Day" cell |

---

## Task 1: Scheduler — race week logic

**Files:**
- Modify: `packages/plan-engine/src/workout-scheduler.ts`
- Modify: `packages/plan-engine/src/workout-scheduler.test.ts`

### Background

`scheduleWorkouts` loops over weeks 1–`totalWeeks`. The race week will be the last week (`week === totalWeeks`) once the route passes `totalWeeks + 1`. We need the scheduler to skip its normal long-run and quality logic for that week and instead assign easy shakeout runs to selected days, excluding race day and the day immediately before race day (if it falls in the same week).

`addDaysToISO` is already defined in `workout-scheduler.ts` — use it to derive the pre-race date.

---

- [ ] **Step 1: Write failing tests**

Append to `packages/plan-engine/src/workout-scheduler.test.ts`:

```typescript
// ── Race week ────────────────────────────────────────────────────────────────

describe("scheduleWorkouts — race week", () => {
  // 4-week plan, taper throughout, race on Sunday of week 4.
  // startDate 2026-06-01 (Mon) → week 4 = Mon 2026-06-22 – Sun 2026-06-28.
  // selectedDays: mon, wed, fri, sat; longRunDay: sat; race: 2026-06-28 (Sun).
  // pre-race day: 2026-06-27 (Sat) — coincides with longRunDay.
  const raceInput = {
    ...baseInput,
    raceDateISO: "2026-06-28",
    totalWeeks: 4,
    peakWeeklyKm: 100,
    phases: [{ name: "Taper", startWeek: 1, endWeek: 4 }] as PhaseEntry[],
  }

  function week4Days(days: ReturnType<typeof scheduleWorkouts>) {
    return days.filter(d => d.date >= "2026-06-22" && d.date <= "2026-06-28")
  }

  it("race week has no long run", () => {
    const days = week4Days(scheduleWorkouts(raceInput))
    expect(days.some(d => d.type === "long" || d.type === "progression")).toBe(false)
  })

  it("race week has no quality sessions", () => {
    const days = week4Days(scheduleWorkouts(raceInput))
    const qualityTypes = new Set(["tempo", "intervals", "mp"])
    expect(days.some(d => qualityTypes.has(d.type))).toBe(false)
  })

  it("race day (Sun) gets type rest", () => {
    const days = scheduleWorkouts(raceInput)
    const raceDay = days.find(d => d.date === "2026-06-28")
    expect(raceDay?.type).toBe("rest")
  })

  it("pre-race day (Sat) gets type rest", () => {
    const days = scheduleWorkouts(raceInput)
    const praceDay = days.find(d => d.date === "2026-06-27")
    expect(praceDay?.type).toBe("rest")
  })

  it("selected days except race day and pre-race day get easy runs", () => {
    // mon (2026-06-22), wed (2026-06-24), fri (2026-06-26) should be easy
    const days = scheduleWorkouts(raceInput)
    expect(days.find(d => d.date === "2026-06-22")?.type).toBe("easy")
    expect(days.find(d => d.date === "2026-06-24")?.type).toBe("easy")
    expect(days.find(d => d.date === "2026-06-26")?.type).toBe("easy")
  })

  it("non-selected days in race week get type rest", () => {
    // tue (2026-06-23), thu (2026-06-25)
    const days = scheduleWorkouts(raceInput)
    expect(days.find(d => d.date === "2026-06-23")?.type).toBe("rest")
    expect(days.find(d => d.date === "2026-06-25")?.type).toBe("rest")
  })

  it("race week easy run total ≈ peakWeeklyKm * 0.4 (within 2 km)", () => {
    // taper week 4 → 40 % of 100 km = 40 km; distributed across mon/wed/fri
    const days = week4Days(scheduleWorkouts(raceInput))
    const easyKm = days
      .filter(d => d.type === "easy")
      .reduce((s, d) => s + (d.distanceKm ?? 0), 0)
    expect(easyKm).toBeGreaterThan(38)
    expect(easyKm).toBeLessThan(42)
  })

  it("when raceDateISO is absent, normal scheduling applies (no regression)", () => {
    const { raceDateISO: _, ...noRaceInput } = raceInput
    const days = scheduleWorkouts(noRaceInput)
    const w4 = week4Days(days)
    // Normal taper week should still have a long run on longRunDay (sat)
    expect(w4.some(d => d.type === "long" || d.type === "progression")).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd packages/plan-engine && pnpm test -- --reporter=verbose 2>&1 | grep -A2 "race week"
```

Expected: all 8 new tests fail (TypeScript error on `raceDateISO` unknown property, or logic failures).

- [ ] **Step 3: Add `raceDateISO` to `SchedulerInput`**

In `packages/plan-engine/src/workout-scheduler.ts`, add the optional field to the interface:

```typescript
export interface SchedulerInput {
  startDate: string
  selectedDays: string[]
  longRunDay: string
  weeklyMileageRange: WeeklyMileageRange
  phases: PhaseEntry[]
  totalWeeks: number
  peakWeeklyKm: number
  trainingStructure: TrainingStructure
  longRunTargets: LongRunTargets
  paceZones: PaceZones
  raceDateISO?: string   // ← add this line
}
```

- [ ] **Step 4: Add race week early-exit path in the main scheduler loop**

In `scheduleWorkouts`, locate the start of the `for (let week = 1; week <= totalWeeks; week++)` loop body — specifically right after these three lines (they already exist):

```typescript
    const weekDays: { date: string; dayKey: string }[] = DAY_ORDER.map((dayKey, i) => ({
      date: addDaysToISO(startDate, weekOffset + i),
      dayKey,
    }))

    // Assigned slots: date → WorkoutDay[]
    const assigned = new Map<string, WorkoutDay[]>()
```

Insert the race week block immediately after the `assigned` map declaration and before `// ── 1. Long run ──`:

```typescript
    // ── Race week (early exit) ──
    if (input.raceDateISO && week === totalWeeks) {
      const praceDate = addDaysToISO(input.raceDateISO, -1)
      const excludedDates = new Set(
        weekDays.filter(d => d.date === input.raceDateISO || d.date === praceDate).map(d => d.date)
      )
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

Note: `input.raceDateISO` is available because the destructuring at the top of `scheduleWorkouts` doesn't include it — reference `input.raceDateISO` directly (the function already has `input` in scope via the parameter).

- [ ] **Step 5: Run tests — confirm they pass**

```bash
cd packages/plan-engine && pnpm test -- --reporter=verbose 2>&1 | grep -E "(PASS|FAIL|race week)"
```

Expected: all 8 race week tests pass, no existing tests broken.

- [ ] **Step 6: Commit**

```bash
git add packages/plan-engine/src/workout-scheduler.ts packages/plan-engine/src/workout-scheduler.test.ts
git commit -m "feat(scheduler): add race week shakeout run generation"
```

---

## Task 2: Route — extend totalWeeks and pass raceDateISO

**Files:**
- Modify: `apps/web/app/api/generate-plan/route.ts`

No unit tests for the route — verify by regenerating a plan and inspecting the response.

- [ ] **Step 1: Update `totalWeeks` calculation**

Find line 63 in `route.ts`:
```typescript
  const totalWeeks = Math.max(1, weeksBetween(startDate, raceDate))
```

Replace with:
```typescript
  const totalWeeks = Math.max(5, weeksBetween(startDate, raceDate) + 1)
```

The `+1` includes the race week. `Math.max(5, ...)` guards against very short plans where `computePhases` cannot allocate valid phase lengths. (Real protection is upstream — the onboarding must require a minimum lead time before race day.)

- [ ] **Step 2: Pass `raceDateISO` to `scheduleWorkouts`**

Find the `scheduleWorkouts` call (around line 119). Add `raceDateISO` to the object:

```typescript
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
    raceDateISO: input.race.date,   // ← add this line
  })
```

- [ ] **Step 3: Verify by running the dev server and generating a plan**

```bash
pnpm dev
```

In the browser, generate a plan for any race at least 6 weeks out. In the calendar, scroll to the last week before race day. Confirm:
- Mon–Fri of race week have easy runs (~6–8 km each)
- Race day shows a rest entry (will be replaced by the race star icon)
- The day before race day shows "Rest Day"

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/generate-plan/route.ts
git commit -m "feat(route): include race week in plan; pass raceDateISO to scheduler"
```

---

## Task 3: Bridge runs — rest entries for non-selected days

**Files:**
- Modify: `packages/plan-engine/src/bridge-runs.ts`
- Modify: `packages/plan-engine/src/bridge-runs.test.ts`

### Background

`buildBridgeRuns` loops over each day in the gap between today and the plan start. Currently it only pushes an easy run when the day is in `selectedDays`. Days not in `selectedDays` produce no entry at all, leaving gaps in `days[]` that the calendar renders as blank boxes.

---

- [ ] **Step 1: Write failing tests**

Append to `packages/plan-engine/src/bridge-runs.test.ts`:

```typescript
describe("buildBridgeRuns — rest days for non-selected days", () => {
  it("emits rest entries for non-selected days in the gap", () => {
    // today = Thu 2026-03-19, selectedDays = ["wed"] only
    // gap: Thu 19, Fri 20, Sat 21, Sun 22 → Wed is not in gap, so no easy runs
    // All 4 days should be rest
    const input = { ...BASE_INPUT, selectedDays: ["wed"] }
    const thursday = new Date("2026-03-19T00:00:00Z")
    const result = buildBridgeRuns(input, [], thursday)
    expect(result.length).toBe(4) // Thu–Sun
    expect(result.every(d => d.type === "rest")).toBe(true)
  })

  it("emits rest for non-selected days and easy for selected days in the same gap", () => {
    // today = Wed 2026-03-18, selectedDays = ["wed", "fri"]
    // gap: Wed 18, Thu 19, Fri 20, Sat 21, Sun 22
    // Wed 18 → easy, Thu 19 → rest, Fri 20 → easy, Sat 21 → rest, Sun 22 → rest
    const input = { ...BASE_INPUT, selectedDays: ["wed", "fri"] }
    const wednesday = new Date("2026-03-18T00:00:00Z")
    const result = buildBridgeRuns(input, [], wednesday)
    expect(result.length).toBe(5)
    expect(result.find(d => d.date === "2026-03-18")?.type).toBe("easy")
    expect(result.find(d => d.date === "2026-03-19")?.type).toBe("rest")
    expect(result.find(d => d.date === "2026-03-20")?.type).toBe("easy")
    expect(result.find(d => d.date === "2026-03-21")?.type).toBe("rest")
    expect(result.find(d => d.date === "2026-03-22")?.type).toBe("rest")
  })

  it("rest entries have no distanceKm", () => {
    const input = { ...BASE_INPUT, selectedDays: ["wed"] }
    const thursday = new Date("2026-03-19T00:00:00Z")
    const result = buildBridgeRuns(input, [], thursday)
    result.forEach(d => {
      if (d.type === "rest") expect(d.distanceKm).toBeUndefined()
    })
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd packages/plan-engine && pnpm test -- --reporter=verbose 2>&1 | grep -A2 "rest days for non-selected"
```

Expected: the new tests fail (rest entries not emitted).

- [ ] **Step 3: Update `buildBridgeRuns` to emit rest for non-selected days**

In `packages/plan-engine/src/bridge-runs.ts`, find the inner `while` loop (around line 76):

```typescript
  while (cursor.getTime() < planStart.getTime()) {
    if (selectedUTCDays.has(cursor.getUTCDay())) {
      results.push({
        date: toISO(cursor),
        type: "easy",
        distanceKm,
        ...(targetPace !== undefined && { targetPace }),
      })
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
```

Replace with:

```typescript
  while (cursor.getTime() < planStart.getTime()) {
    if (selectedUTCDays.has(cursor.getUTCDay())) {
      results.push({
        date: toISO(cursor),
        type: "easy",
        distanceKm,
        ...(targetPace !== undefined && { targetPace }),
      })
    } else {
      results.push({ date: toISO(cursor), type: "rest" })
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
cd packages/plan-engine && pnpm test -- --reporter=verbose
```

Expected: all tests pass including the new bridge run tests.

- [ ] **Step 5: Commit**

```bash
git add packages/plan-engine/src/bridge-runs.ts packages/plan-engine/src/bridge-runs.test.ts
git commit -m "fix(bridge-runs): emit rest entries for non-selected days in bridge period"
```

---

## Task 4: Calendar — render "Rest Day" for missing days

**Files:**
- Modify: `apps/web/app/plan/plan-calendar.tsx`

No unit tests — visual verification via the dev server.

### Background

In `plan-calendar.tsx`, when `dayMap[dow]` has no entries, the calendar renders a bare `<div>` — an empty box with no label. After Tasks 1–3, this case should no longer occur in practice, but we retain the branch as a defensive fallback and make it show "Rest Day" instead of nothing.

---

- [ ] **Step 1: Replace the empty placeholder with a styled rest day cell**

In `plan-calendar.tsx`, find the empty-placeholder block (around lines 200–208):

```typescript
                if (!entries?.length) {
                  // Day not in plan yet (still streaming) — empty placeholder
                  return (
                    <div
                      key={dow}
                      className="min-h-[88px] rounded-md border border-border bg-card opacity-20"
                    />
                  )
                }
```

Replace with:

```typescript
                if (!entries?.length) {
                  // Defensive fallback: day missing from plan data
                  return (
                    <div
                      key={dow}
                      className="min-h-[88px] rounded-md border border-border bg-card p-2 opacity-40"
                    >
                      <p className="text-[10px] text-subtle-foreground">—</p>
                      <p className="text-[10px] text-subtle-foreground mt-0.5">Rest Day</p>
                    </div>
                  )
                }
```

- [ ] **Step 2: Verify visually**

```bash
pnpm dev
```

Regenerate a plan. Confirm:
- No blank cells remain in the bridge week (days before plan start that aren't run days show "Rest Day")
- Race week shows easy runs on eligible days and "Rest Day" on the day before race and on race day itself (before the race star replaces it)
- All other weeks are unaffected

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/plan/plan-calendar.tsx
git commit -m "fix(calendar): show Rest Day for days missing from plan data"
```

---

## Task 5: Final verification

- [ ] **Step 1: Run full test suite**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: no type errors.

- [ ] **Step 3: Run lint**

```bash
pnpm lint
```

Expected: no lint errors.
