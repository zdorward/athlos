# Bridge Runs Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically prepend easy bridge runs for each selected running day between today and the plan's Monday start date, so the calendar is populated from the moment a user generates a plan.

**Architecture:** Extract a shared `STARTING_VOLUME_KM` constant, export `firstMondayOnOrAfter` from `race-prompt.ts`, implement a pure `buildBridgeRuns` function with full test coverage, then wire it into the stream's `done` branch in `plan/page.tsx` using a local accumulator array.

**Tech Stack:** TypeScript, Vitest (tests in `packages/ai`), React (Next.js `plan/page.tsx`)

---

## Chunk 1: Constants extraction + `firstMondayOnOrAfter` export

### Task 1: Extract `STARTING_VOLUME_KM` to `packages/ai/src/constants.ts`

**Files:**
- Create: `packages/ai/src/constants.ts`
- Modify: `packages/ai/src/race-prompt.ts` (lines 127–132 — remove the const, add import)

- [ ] **Step 1: Create `packages/ai/src/constants.ts`**

```ts
export const STARTING_VOLUME_KM: Record<string, number> = {
  "under-40": 30,
  "40-60":    50,
  "60-80":    70,
  "80-plus":  90,
}
```

- [ ] **Step 2: Remove the existing `STARTING_VOLUME_KM` declaration from `race-prompt.ts` and add import**

At the top of `packages/ai/src/race-prompt.ts`, add:
```ts
import { STARTING_VOLUME_KM } from "./constants"
```

Then delete lines 127–132 in `race-prompt.ts` (the `const STARTING_VOLUME_KM = { ... }` block).

- [ ] **Step 3: Run typecheck to confirm no breakage**

```bash
pnpm typecheck
```
Expected: no errors

- [ ] **Step 4: Export `firstMondayOnOrAfter` from `race-prompt.ts`**

At line 138 in `race-prompt.ts`, change:
```ts
function firstMondayOnOrAfter(date: Date): Date {
```
to:
```ts
export function firstMondayOnOrAfter(date: Date): Date {
```

- [ ] **Step 5: Typecheck again**

```bash
pnpm typecheck
```
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add packages/ai/src/constants.ts packages/ai/src/race-prompt.ts
git commit -m "refactor: extract STARTING_VOLUME_KM to constants, export firstMondayOnOrAfter"
```

---

## Chunk 2: `buildBridgeRuns` — tests + implementation

### Task 2: Write failing tests for `buildBridgeRuns`

**Files:**
- Create: `packages/ai/src/bridge-runs.test.ts`

The test file uses Vitest. Tests reference `buildBridgeRuns` which doesn't exist yet — they must fail on import.

To make dates predictable: pick a fixed "today" for each test. Use UTC dates. A Wednesday is `new Date("2026-03-18T00:00:00Z")` (2026-03-18 is a Wednesday). The following Monday is `2026-03-23`.

- [ ] **Step 1: Write the test file**

```ts
import { describe, it, expect } from "vitest"
import { buildBridgeRuns } from "./bridge-runs"
import type { PlanGenerationInput, WorkoutDay } from "./types"

const BASE_INPUT: PlanGenerationInput = {
  goal: "race",
  race: { name: "Test Race", date: "2026-10-04", distance: "full", city: "Test City" },
  selectedDays: ["wed", "fri"],
  longRunDay: "sun",
  units: "km",
  strengthTraining: false,
  weeklyMileageRange: "40-60",
}

// 2026-03-23 is a Monday
const NEXT_MONDAY = new Date("2026-03-23T00:00:00Z")

function makeEasyRun(date: string, distanceKm: number, targetPace?: string): WorkoutDay {
  return { date, type: "easy", distanceKm, description: "Easy run.", ...(targetPace && { targetPace }) }
}

describe("buildBridgeRuns", () => {
  it("returns [] when today is Monday", () => {
    const monday = new Date("2026-03-23T00:00:00Z")
    const result = buildBridgeRuns(BASE_INPUT, [], monday)
    expect(result).toEqual([])
  })

  it("returns [] when selected day is not in the gap", () => {
    // gap is Wed 18 – Sun 22; "mon" is not in that range
    const input = { ...BASE_INPUT, selectedDays: ["mon"] }
    const wednesday = new Date("2026-03-18T00:00:00Z")
    const result = buildBridgeRuns(input, [], wednesday)
    expect(result).toEqual([])
  })

  it("returns one bridge run when one selected day falls in the gap", () => {
    // today = Wed 18, selectedDays = ["wed"] → one run on 2026-03-18
    const input = { ...BASE_INPUT, selectedDays: ["wed"] }
    const wednesday = new Date("2026-03-18T00:00:00Z")
    const result = buildBridgeRuns(input, [], wednesday)
    expect(result).toHaveLength(1)
    expect(result[0]!.date).toBe("2026-03-18")
    expect(result[0]!.type).toBe("easy")
  })

  it("returns multiple bridge runs for multiple selected days in the gap", () => {
    // today = Wed 18, selectedDays = ["wed", "fri"] → runs on Wed 18 and Fri 20
    const wednesday = new Date("2026-03-18T00:00:00Z")
    const result = buildBridgeRuns(BASE_INPUT, [], wednesday)
    expect(result).toHaveLength(2)
    expect(result[0]!.date).toBe("2026-03-18")
    expect(result[1]!.date).toBe("2026-03-20")
  })

  it("computes distanceKm as average of week-1 easy runs", () => {
    const wednesday = new Date("2026-03-18T00:00:00Z")
    const planDays: WorkoutDay[] = [
      makeEasyRun("2026-03-23", 10),  // week 1 easy
      makeEasyRun("2026-03-25", 12),  // week 1 easy
    ]
    const result = buildBridgeRuns(BASE_INPUT, planDays, wednesday)
    expect(result[0]!.distanceKm).toBe(11.0)
  })

  it("uses fallback distance when no week-1 easy runs exist", () => {
    // "40-60" = 50 km/week, 2 selected days → 50/2 = 25.0
    const wednesday = new Date("2026-03-18T00:00:00Z")
    const input = { ...BASE_INPUT, selectedDays: ["wed", "fri"], weeklyMileageRange: "40-60" as const }
    const result = buildBridgeRuns(input, [], wednesday)
    expect(result[0]!.distanceKm).toBe(25.0)
  })

  it("uses fallback with 3 selected days: 50/3 = 16.7", () => {
    const wednesday = new Date("2026-03-18T00:00:00Z")
    const input = { ...BASE_INPUT, selectedDays: ["wed", "fri", "sat"], weeklyMileageRange: "40-60" as const }
    const result = buildBridgeRuns(input, [], wednesday)
    expect(result[0]!.distanceKm).toBe(16.7)
  })

  it("copies targetPace from week-1 easy run", () => {
    const wednesday = new Date("2026-03-18T00:00:00Z")
    const planDays: WorkoutDay[] = [
      makeEasyRun("2026-03-23", 10, "5:30–6:00/km"),
    ]
    const result = buildBridgeRuns(BASE_INPUT, planDays, wednesday)
    expect(result[0]!.targetPace).toBe("5:30–6:00/km")
  })

  it("omits targetPace key when no week-1 easy run has a pace", () => {
    const wednesday = new Date("2026-03-18T00:00:00Z")
    const result = buildBridgeRuns(BASE_INPUT, [], wednesday)
    expect("targetPace" in result[0]!).toBe(false)
  })

  it("adds bridge run on Sunday when Sunday is selected", () => {
    const sunday = new Date("2026-03-22T00:00:00Z")  // Sun before Mon 23
    const input = { ...BASE_INPUT, selectedDays: ["sun"] }
    const result = buildBridgeRuns(input, [], sunday)
    expect(result).toHaveLength(1)
    expect(result[0]!.date).toBe("2026-03-22")
  })

  it("returns [] on Sunday when Sunday is not selected", () => {
    const sunday = new Date("2026-03-22T00:00:00Z")
    const input = { ...BASE_INPUT, selectedDays: ["mon", "wed"] }
    const result = buildBridgeRuns(input, [], sunday)
    expect(result).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests — expect import failure**

```bash
cd packages/ai && pnpm vitest run src/bridge-runs.test.ts
```
Expected: error like `Cannot find module './bridge-runs'`

---

### Task 3: Implement `buildBridgeRuns`

**Files:**
- Create: `packages/ai/src/bridge-runs.ts`

- [ ] **Step 1: Create `packages/ai/src/bridge-runs.ts`**

```ts
import { firstMondayOnOrAfter } from "./race-prompt"
import { STARTING_VOLUME_KM } from "./constants"
import type { PlanGenerationInput, WorkoutDay } from "./types"

function toISO(date: Date): string {
  return date.toISOString().slice(0, 10)
}

const DAY_KEY_TO_UTC: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
}

export function buildBridgeRuns(
  input: PlanGenerationInput,
  planDays: WorkoutDay[],
  today: Date,
): WorkoutDay[] {
  // UTC-normalize today — do not mutate the original
  const todayUTC = new Date(today)
  todayUTC.setUTCHours(0, 0, 0, 0)

  // Find plan start (first Monday on or after today)
  const planStart = firstMondayOnOrAfter(todayUTC)

  // No gap if today is already at or past plan start
  if (planStart.getTime() - todayUTC.getTime() <= 0) return []

  // Build set of selected UTC day-of-week values
  const selectedUTCDays = new Set(
    input.selectedDays.map(d => DAY_KEY_TO_UTC[d]).filter((n): n is number => n !== undefined)
  )

  // Compute week-1 date range strings for ISO comparison
  // planDays always starts on planStart, so d.date >= planStartISO is always true —
  // kept for clarity; d.date <= planEndWeek1ISO does the meaningful filtering.
  const planStartISO = toISO(planStart)
  const planEndWeek1 = new Date(planStart)
  planEndWeek1.setUTCDate(planStart.getUTCDate() + 6)
  const planEndWeek1ISO = toISO(planEndWeek1)

  // Find week-1 easy runs
  const week1EasyRuns = planDays.filter(
    d =>
      d.type === "easy" &&
      d.date >= planStartISO &&
      d.date <= planEndWeek1ISO &&
      d.distanceKm !== undefined,
  )

  // Compute distance per bridge run
  // Fallback denominator = input.selectedDays.length = running days per week (not gap days)
  const distanceKm =
    week1EasyRuns.length > 0
      ? Math.round(
          (week1EasyRuns.reduce((sum, d) => sum + d.distanceKm!, 0) / week1EasyRuns.length) * 10,
        ) / 10
      : Math.round(
          ((STARTING_VOLUME_KM[input.weeklyMileageRange] ?? 50) / input.selectedDays.length) * 10,
        ) / 10

  // Target pace: copy from first week-1 easy run that has one; omit key if none
  const targetPace = week1EasyRuns.find(d => d.targetPace != null)?.targetPace

  // Iterate gap — todayUTC is fixed; cursor is a separate mutable copy
  const results: WorkoutDay[] = []
  const cursor = new Date(todayUTC)
  while (cursor.getTime() < planStart.getTime()) {
    if (selectedUTCDays.has(cursor.getUTCDay())) {
      results.push({
        date: toISO(cursor),
        type: "easy",
        distanceKm,
        ...(targetPace !== undefined && { targetPace }),
        description: "Easy run — pre-plan bridge day.",
      })
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return results
}
```

- [ ] **Step 2: Run tests — expect all pass**

```bash
cd packages/ai && pnpm vitest run src/bridge-runs.test.ts
```
Expected: all 10 tests pass

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add packages/ai/src/bridge-runs.ts packages/ai/src/bridge-runs.test.ts
git commit -m "feat: implement buildBridgeRuns with full test coverage"
```

---

### Task 4: Export `buildBridgeRuns` from `packages/ai/src/index.ts`

**Files:**
- Modify: `packages/ai/src/index.ts`

- [ ] **Step 1: Add export to `index.ts`**

Add after the existing exports:
```ts
export { buildBridgeRuns } from "./bridge-runs"
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add packages/ai/src/index.ts
git commit -m "feat: export buildBridgeRuns from @workspace/ai"
```

---

## Chunk 3: Wire into `plan/page.tsx`

### Task 5: Integrate bridge runs into the stream's `done` branch

**Files:**
- Modify: `apps/web/app/plan/page.tsx`

The `stream()` async function starts at line 243. The `while (true)` loop is at line 265. The `done` branch is at line 275.

- [ ] **Step 1: Add import to `plan/page.tsx`**

At the top of `apps/web/app/plan/page.tsx`, the existing import from `@workspace/ai` is:
```ts
import type { PlanGenerationInput, TrainingPlan, WorkoutDay, WorkoutType, PhaseEntry } from "@workspace/ai"
```

Change it to also import `buildBridgeRuns`:
```ts
import { buildBridgeRuns } from "@workspace/ai"
import type { PlanGenerationInput, TrainingPlan, WorkoutDay, WorkoutType, PhaseEntry } from "@workspace/ai"
```

- [ ] **Step 2: Add `localDays` accumulator inside `stream()`**

Inside `async function stream()`, immediately before the `while (true) {` loop, add:
```ts
const localDays: WorkoutDay[] = []
```

This must be **inside** `stream()`, not at component scope, so it is fresh for every stream invocation.

- [ ] **Step 3: Push each parsed day to `localDays`**

In the line-parsing section of the loop, find the existing code that calls `setPlan` when a `WorkoutDay` is parsed. It looks like:
```ts
const day = parsed as unknown as WorkoutDay
if (typeof day.date !== "string" || !VALID_WORKOUT_TYPES.has(day.type)) continue
dayCountRef.current += 1
// ... weekNum calculation ...
setPlan((p) => { ... })
```

After the `if` guard and before `dayCountRef.current += 1`, add:
```ts
localDays.push(day)
```

The updated block (keep all existing lines — only `localDays.push(day)` is new):
```ts
const day = parsed as unknown as WorkoutDay
if (typeof day.date !== "string" || !VALID_WORKOUT_TYPES.has(day.type)) continue
localDays.push(day)                          // ← new line
dayCountRef.current += 1
if (!startDateRef.current) startDateRef.current = day.date
const weekNum =
  Math.floor(
    (new Date(day.date).getTime() - new Date(startDateRef.current).getTime()) /
      (7 * 24 * 60 * 60 * 1000)
  ) + 1
setGeneratingWeek(weekNum)
setPlan((p) => {
  const existing = p.days ?? []
  const idx = existing.findIndex((d) => d.date === day.date && d.type === day.type)
  const days = idx >= 0
    ? existing.map((d, i) => (i === idx ? day : d))
    : [...existing, day]
  return { ...p, days }
})
```

- [ ] **Step 4: Add bridge run merging in the `done` branch**

Find the `done` branch:
```ts
if (done) {
  if (totalWeeksRef.current === 0 || dayCountRef.current === 0) {
    setStatus("error")
  } else {
    setStatus("complete")
  }
  break
}
```

Replace it with:
```ts
if (done) {
  if (totalWeeksRef.current === 0 || dayCountRef.current === 0) {
    setStatus("error")
  } else {
    const bridgeDays = buildBridgeRuns(mapped, localDays, new Date())
    if (bridgeDays.length > 0) {
      const mergedDays = [...bridgeDays, ...localDays].sort(
        (a, b) => a.date.localeCompare(b.date),
      )
      // Recompute totalKm from scratch — replaces the running total from streaming
      const newTotalKm = mergedDays.reduce((sum, d) => sum + (d.distanceKm ?? 0), 0)
      setPlan((p) => ({ ...p, days: mergedDays, totalKm: newTotalKm }))
    }
    setStatus("complete")
  }
  break
}
```

- [ ] **Step 5: Typecheck**

```bash
pnpm typecheck
```
Expected: no errors

- [ ] **Step 6: Run all AI package tests to confirm nothing is broken**

```bash
cd packages/ai && pnpm vitest run
```
Expected: all tests pass

- [ ] **Step 7: Start dev server and manually verify**

```bash
pnpm dev
```

1. Go through onboarding as a user (any day that is not Monday)
2. Observe the calendar — days between today and next Monday that match your selected running days should appear as easy runs with description "Easy run — pre-plan bridge day."
3. If today is Monday, verify the plan starts today with no bridge runs.

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/plan/page.tsx
git commit -m "feat: auto-prepend bridge runs from today to plan start"
```

- [ ] **Step 9: Push**

```bash
git push origin develop
```
