# Bridge Runs Server-Side Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move bridge day generation from the client into the `generate-plan` API route so the response is a complete, self-contained plan including `planStartDate`.

**Architecture:** Add `today?: string` to `PlanGenerationInput`, call `buildBridgeRuns` inside the route after scheduling, prepend bridge days, and return `planStartDate` alongside the days. The client removes its own bridge-run logic and reads `planStartDate` directly from the API response.

**Tech Stack:** TypeScript, Next.js 16 API routes, Vitest (plan-engine + web), pnpm monorepo with Turbo.

---

### Task 1: Add `today` to `PlanGenerationInput`

**Files:**
- Modify: `packages/plan-engine/src/types.ts`

- [ ] **Step 1: Add the field**

In `PlanGenerationInput`, add after `weeklyMileageRange`:

```ts
today?: string  // ISO date sent by client to avoid server-clock/timezone mismatch
```

Full updated interface (only the `today` line is new):

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
}
```

- [ ] **Step 2: Run typecheck to confirm no breakage**

```bash
pnpm typecheck
```

Expected: no errors (field is optional, all existing callers still valid).

- [ ] **Step 3: Commit**

```bash
git add packages/plan-engine/src/types.ts
git commit -m "feat(plan-engine): add optional today field to PlanGenerationInput"
```

---

### Task 2: Update route — bridge runs server-side

**Files:**
- Modify: `apps/web/app/api/generate-plan/route.ts`
- Modify: `apps/web/app/api/generate-plan/route.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `route.test.ts` (after the existing `describe` block):

```ts
describe("POST /api/generate-plan — bridge runs and planStartDate", () => {
  it("returns planStartDate as a valid ISO date string", async () => {
    const res = await POST(makeRequest(validInput))
    const body = await res.json()
    expect(typeof body.planStartDate).toBe("string")
    expect(body.planStartDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it("planStartDate is a Monday", async () => {
    const res = await POST(makeRequest(validInput))
    const body = await res.json()
    const dow = new Date(body.planStartDate + "T00:00:00Z").getUTCDay()
    expect(dow).toBe(1) // 1 = Monday
  })

  it("when today is provided, days before planStartDate are bridge days", async () => {
    // today = 2026-03-18 (Wednesday); plan starts Monday 2026-03-24
    const input = {
      ...validInput,
      today: "2026-03-18",
      selectedDays: ["wed", "sat"],
      longRunDay: "sat",
    }
    const res = await POST(makeRequest(input))
    const body = await res.json()
    const bridgeDays = body.days.filter((d: { date: string }) => d.date < body.planStartDate)
    expect(bridgeDays.length).toBeGreaterThan(0)
    // All dates before planStartDate are in the Wed–Sun gap
    bridgeDays.forEach((d: { date: string }) => {
      expect(d.date >= "2026-03-18").toBe(true)
      expect(d.date < body.planStartDate).toBe(true)
    })
  })

  it("when today equals planStartDate (Monday), no bridge days are prepended", async () => {
    // today = 2026-03-23 (Monday) — plan also starts this Monday → no gap
    const input = { ...validInput, today: "2026-03-23" }
    const res = await POST(makeRequest(input))
    const body = await res.json()
    const bridgeDays = body.days.filter((d: { date: string }) => d.date < body.planStartDate)
    expect(bridgeDays.length).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm --filter web test -- --reporter=verbose route.test
```

Expected: the new `planStartDate` tests fail with `undefined` or missing field.

- [ ] **Step 3: Update the route**

In `apps/web/app/api/generate-plan/route.ts`:

1. Add `buildBridgeRuns` to the import from `@workspace/plan-engine`:

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
} from "@workspace/plan-engine"
```

2. After the existing race-day replacement block (ends at the `days.sort` call), insert:

```ts
// planStartDate = first Monday of the generated plan (before bridge days prepended)
const planStartDate = days[0]?.date ?? startDate.toISOString().slice(0, 10)

// Resolve today from input (client's local date) or fall back to server clock
const todayISO = input.today ?? new Date().toISOString().slice(0, 10)
const bridgeDays = buildBridgeRuns(input, days, new Date(todayISO + "T00:00:00Z"))
const finalDays = bridgeDays.length > 0
  ? [...bridgeDays, ...days].sort((a, b) => a.date.localeCompare(b.date))
  : days
```

3. Update the return statement to use `finalDays` and include `planStartDate`:

```ts
return Response.json({ days: finalDays, planStartDate, totalWeeks, totalKm, peakWeekKm, phases })
```

The full block at the end of the route (replacing `return Response.json({ days, ... })`):

```ts
const planStartDate = days[0]?.date ?? startDate.toISOString().slice(0, 10)
const todayISO = input.today ?? new Date().toISOString().slice(0, 10)
const bridgeDays = buildBridgeRuns(input, days, new Date(todayISO + "T00:00:00Z"))
const finalDays = bridgeDays.length > 0
  ? [...bridgeDays, ...days].sort((a, b) => a.date.localeCompare(b.date))
  : days

return Response.json({ days: finalDays, planStartDate, totalWeeks, totalKm, peakWeekKm, phases })
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm --filter web test -- --reporter=verbose route.test
```

Expected: all tests pass including the new ones.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/api/generate-plan/route.ts apps/web/app/api/generate-plan/route.test.ts
git commit -m "feat(api): move bridge run generation server-side; return planStartDate"
```

---

### Task 3: Update `plan/page.tsx` — remove client-side bridge logic

**Files:**
- Modify: `apps/web/app/plan/page.tsx`

No unit tests exist for this file (client-side React). TypeScript will catch type errors.

- [ ] **Step 1: Remove `buildBridgeRuns` from the import**

Change:
```ts
import { buildBridgeRuns } from "@workspace/plan-engine"
```
to (delete the import entirely — it's the only thing imported from plan-engine on this line):
```ts
// (remove this line)
```

The file already imports `type PhaseEntry` and other types from `@workspace/plan-engine` in the `import type` line — that stays untouched.

- [ ] **Step 2: Pass `today` in the generate request and update the result type**

In the `generate()` async function inside the `useEffect`, find:

```ts
let result: { days: WorkoutDay[]; totalWeeks: number; totalKm: number; peakWeekKm: number; phases: PhaseEntry[] }
```

Replace with:

```ts
let result: { days: WorkoutDay[]; totalWeeks: number; totalKm: number; peakWeekKm: number; phases: PhaseEntry[]; planStartDate: string }
```

Find the fetch call:
```ts
response = await fetch("/api/generate-plan", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(mapped),
})
```

Replace with:
```ts
response = await fetch("/api/generate-plan", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ...mapped, today: new Date().toLocaleDateString("en-CA") }),
})
```

- [ ] **Step 3: Remove the client-side bridge run block and update state setters**

Find and delete this block entirely:

```ts
const bridgeDays = buildBridgeRuns(mapped!, result.days, new Date())
const finalDays = bridgeDays.length > 0
  ? [...bridgeDays, ...result.days].sort((a, b) => a.date.localeCompare(b.date))
  : result.days
```

Update the state setters below it. Find:

```ts
totalWeeksRef.current = result.totalWeeks
setPhases(result.phases ?? [])
setPlanStartDate(result.days[0]?.date ?? null)
setPlan({
  days: finalDays,
  totalWeeks: result.totalWeeks,
  totalKm: result.totalKm,
  peakWeekKm: result.peakWeekKm,
  phases: result.phases,
})
```

Replace with:

```ts
totalWeeksRef.current = result.totalWeeks
setPhases(result.phases ?? [])
setPlanStartDate(result.planStartDate)
setPlan({
  days: result.days,
  totalWeeks: result.totalWeeks,
  totalKm: result.totalKm,
  peakWeekKm: result.peakWeekKm,
  phases: result.phases,
})
```

- [ ] **Step 4: Update `SavedPlanSnapshot` to include `planStartDate`**

Find:
```ts
interface SavedPlanSnapshot {
  input: PlanGenerationInput
  days: WorkoutDay[]
  totalWeeks: number
  totalKm: number
  peakWeekKm: number
  phases?: PhaseEntry[]  // optional for backward compatibility with snapshots saved before this change
  savedAt: number  // Date.now() timestamp for staleness check
}
```

Replace with:
```ts
interface SavedPlanSnapshot {
  input: PlanGenerationInput
  days: WorkoutDay[]
  totalWeeks: number
  totalKm: number
  peakWeekKm: number
  phases?: PhaseEntry[]
  planStartDate?: string  // optional for backward compat with snapshots saved before this change
  savedAt: number
}
```

- [ ] **Step 5: Save `planStartDate` in `handleBeforeSignIn`**

Find in `handleBeforeSignIn`:
```ts
const snapshot: SavedPlanSnapshot = {
  input,
  days:       current.days       ?? [],
  totalWeeks: current.totalWeeks ?? 0,
  totalKm:    current.totalKm    ?? 0,
  peakWeekKm: current.peakWeekKm ?? 0,
  phases:     current.phases     ?? [],
  savedAt:    Date.now(),
}
```

Replace with:
```ts
const snapshot: SavedPlanSnapshot = {
  input,
  days:           current.days       ?? [],
  totalWeeks:     current.totalWeeks ?? 0,
  totalKm:        current.totalKm    ?? 0,
  peakWeekKm:     current.peakWeekKm ?? 0,
  phases:         current.phases     ?? [],
  planStartDate:  planStartDate ?? undefined,
  savedAt:        Date.now(),
}
```

- [ ] **Step 6: Restore `planStartDate` in the snapshot restore path**

In the auto-save-after-OAuth `useEffect`, find the block that sets state from snapshot (around line 154–168). After `setPhases(snapshot.phases ?? [])`, add:

```ts
const restoredPlanStartDate = snapshot.planStartDate
  ?? snapshot.days.find(d => new Date(d.date + "T00:00:00Z").getUTCDay() === 1)?.date
  ?? null
setPlanStartDate(restoredPlanStartDate)
```

- [ ] **Step 7: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/plan/page.tsx
git commit -m "refactor(plan): remove client-side bridge run logic; read planStartDate from API"
```

---

### Task 4: Final verification

- [ ] **Step 1: Run all tests**

```bash
pnpm --filter web test
pnpm --filter @workspace/plan-engine test
```

Expected: all tests pass.

- [ ] **Step 2: Run full typecheck**

```bash
pnpm typecheck
```

Expected: no errors.
