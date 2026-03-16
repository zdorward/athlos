# Phase-Aware Strength Scheduling Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix a prompt contradiction (LLM told strength is valid but never to emit it) and implement Pfitzinger-based phase-aware strength scheduling (Base/Build = all days, Peak = 1 day furthest from long run, Taper = none).

**Architecture:** Three tasks in dependency order. Task 1 adds `peakStrengthDay` as a pure, testable helper. Task 2 updates the LLM prompt to remove the contradiction and add the phase-specific strength block. Task 3 makes `mergeStrengthDays` phase-aware and updates the call site. Tasks 1 and 2 are independent; Task 3 depends on Task 1 (imports `peakStrengthDay`).

**Tech Stack:** TypeScript, Next.js 16, pnpm monorepo. Test runner: Vitest (in `packages/ai`). Run all commands from `/Users/zackdorward/dev/athlos`.

---

## Task 1: `peakStrengthDay` helper + export

**Files:**
- Modify: `packages/ai/src/race-prompt.ts`
- Create: `packages/ai/src/race-prompt.test.ts`
- Modify: `packages/ai/src/index.ts`

**Context:** `peakStrengthDay` is a pure function that takes a list of strength day keys (e.g. `["wed", "sat"]`) and a long run day key (e.g. `"sun"`) and returns the single strength day that is furthest from the long run using circular day distance. It will be used both by the prompt builder and by `mergeStrengthDays`.

- [ ] **Write failing tests in `packages/ai/src/race-prompt.test.ts`**

```ts
import { describe, it, expect } from "vitest"
import { peakStrengthDay } from "./race-prompt"

describe("peakStrengthDay", () => {
  it("returns null for empty array", () => {
    expect(peakStrengthDay([], "sun")).toBeNull()
  })

  it("returns the only day when array has one element", () => {
    expect(peakStrengthDay(["wed"], "sun")).toBe("wed")
  })

  it("returns the day furthest from the long run day (sun long run)", () => {
    // sun=0. wed: |3-0|=3, min(3,4)=3. sat: |6-0|=6, min(6,1)=1. → wed wins
    expect(peakStrengthDay(["wed", "sat"], "sun")).toBe("wed")
  })

  it("handles circular distance across week boundary", () => {
    // fri long run (5). sun: |0-5|=5, min(5,2)=2. mon: |1-5|=4, min(4,3)=3. → mon wins
    expect(peakStrengthDay(["sun", "mon"], "fri")).toBe("mon")
  })

  it("returns the furthest day from 3 options", () => {
    // sun long run. mon: min(1,6)=1. wed: min(3,4)=3. fri: min(5,2)=2. → wed wins
    expect(peakStrengthDay(["mon", "wed", "fri"], "sun")).toBe("wed")
  })
})
```

- [ ] **Run tests to verify they fail**

```bash
cd /Users/zackdorward/dev/athlos && pnpm --filter @workspace/ai test race-prompt 2>&1 | tail -20
```

Expected: FAIL — `peakStrengthDay` is not exported.

- [ ] **Implement `peakStrengthDay` in `packages/ai/src/race-prompt.ts`**

Add this function near the top of the file, after the `DAY_NAMES` constant (around line 108):

```ts
const DAY_INDEX: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
}

export function peakStrengthDay(strengthDays: string[], longRunDay: string): string | null {
  if (strengthDays.length === 0) return null
  if (strengthDays.length === 1) return strengthDays[0]!

  const longIdx = DAY_INDEX[longRunDay] ?? 0

  function circularDistance(day: string): number {
    const idx = DAY_INDEX[day] ?? 0
    const diff = Math.abs(idx - longIdx)
    return Math.min(diff, 7 - diff)
  }

  return strengthDays.reduce((best, day) =>
    circularDistance(day) >= circularDistance(best) ? day : best
  )
}
```

- [ ] **Run tests to verify they pass**

```bash
cd /Users/zackdorward/dev/athlos && pnpm --filter @workspace/ai test race-prompt 2>&1 | tail -20
```

Expected: 5 tests PASS.

- [ ] **Export from `packages/ai/src/index.ts`**

Add alongside the existing named exports from other files:

```ts
export { peakStrengthDay } from "./race-prompt"
```

- [ ] **Run typecheck**

```bash
cd /Users/zackdorward/dev/athlos && pnpm typecheck
```

Expected: zero errors.

- [ ] **Commit**

```bash
git add packages/ai/src/race-prompt.ts packages/ai/src/race-prompt.test.ts packages/ai/src/index.ts
git commit -m "feat: add peakStrengthDay helper for phase-aware strength scheduling"
```

---

## Task 2: Fix LLM prompt

**Files:**
- Modify: `packages/ai/src/race-prompt.ts`

**Context:** Two things to fix in the system prompt (the `buildSystemPrompt` function), and one thing to fix in the user message (the `buildPrompt` function). All changes are string edits — no logic changes.

### System prompt fixes (inside `buildSystemPrompt`)

- [ ] **Remove `strength` from "Valid Workout Types"**

Find (around line 34):
```
- strength    — no distanceKm
- rest        — full rest, no distanceKm
```

Replace with:
```
- rest        — full rest, no distanceKm
```

- [ ] **Fix the `targetPace` exception line**

Find (around line 38):
```
Every workout except rest and strength MUST have a targetPace matching the zone label exactly as given in the user message.
```

Replace with:
```
Every workout except rest MUST have a targetPace matching the zone label exactly as given in the user message.
```

### User message fix (inside `buildPrompt`)

- [ ] **Replace single-line strength constraint with phase-specific block**

Find (around line 335):
```ts
lines.push(`Strength training days: ${strengthDayNames} — treat these as heavy days; do not schedule quality running sessions (tempo, intervals, race pace) on these days. The strength schedule is already defined and will be merged into the final output separately — do not emit any strength type lines.`)
```

Replace with:
```ts
const peakDay = peakStrengthDay(input.strengthDays!, input.longRunDay)
const peakDayName = peakDay ? (DAY_NAMES[peakDay] ?? peakDay) : "none"
lines.push(`Strength training (managed externally — do not emit strength type lines):`)
lines.push(`  General Fitness, Base, Build: ${strengthDayNames} — heavy days; no quality sessions (tempo, intervals, mp) on these days`)
lines.push(`  Peak: ${peakDayName} only — heavy day; no quality sessions on this day`)
lines.push(`  Taper: no strength training — all days available for quality sessions`)
```

Note: `peakStrengthDay` is already defined in this file — no import needed.

- [ ] **Run typecheck**

```bash
cd /Users/zackdorward/dev/athlos && pnpm typecheck
```

Expected: zero errors.

- [ ] **Commit**

```bash
git add packages/ai/src/race-prompt.ts
git commit -m "fix: remove strength from LLM valid types and add phase-aware strength prompt"
```

---

## Task 3: Phase-aware `mergeStrengthDays`

**Files:**
- Modify: `apps/web/app/plan/page.tsx`

**Context:** `mergeStrengthDays` currently stamps the same strength days every week. Update it to apply the Pfitzinger schedule: Base/Build = all days, Peak = `peakStrengthDay(...)` only, Taper = none. Also add a `localPhases` accumulator so phases are available synchronously in the `done` branch.

- [ ] **Update `mergeStrengthDays` signature and implementation**

Find the current function (lines 23–44):
```ts
function mergeStrengthDays(
  days: WorkoutDay[],
  strengthDays: string[],
  startDate: Date,
  endDate: Date,
): WorkoutDay[] {
  if (strengthDays.length === 0) return days
  const strengthSet = new Set(strengthDays)
  const result = [...days]
  const d = new Date(startDate.getTime())
  while (d <= endDate) {
    const key = DAY_KEYS[d.getDay()]
    if (key && strengthSet.has(key)) {
      const dateStr = d.toLocaleDateString("en-CA")
      if (!result.some((e) => e.date === dateStr && e.type === "strength")) {
        result.push({ date: dateStr, type: "strength", description: "Strength training" })
      }
    }
    d.setDate(d.getDate() + 1)
  }
  return result
}
```

Replace with:
```ts
function mergeStrengthDays(
  days: WorkoutDay[],
  strengthDays: string[],
  longRunDay: string,
  startDate: Date,
  endDate: Date,
  phases: PhaseEntry[] | undefined,
): WorkoutDay[] {
  if (strengthDays.length === 0) return days

  const msPerWeek = 7 * 24 * 60 * 60 * 1000

  function activeDaysForWeek(weekNum: number): Set<string> {
    const phase = phases?.find(p => weekNum >= p.startWeek && weekNum <= p.endWeek)
    const name = phase?.name?.toLowerCase() ?? ""
    if (name === "taper") return new Set()
    if (name === "peak") {
      const best = peakStrengthDay(strengthDays, longRunDay)
      return best ? new Set([best]) : new Set()
    }
    // General Fitness, Base, Build, or no phases available: all days
    return new Set(strengthDays)
  }

  const result = [...days]
  const d = new Date(startDate.getTime())
  while (d <= endDate) {
    const weekNum = Math.floor((d.getTime() - startDate.getTime()) / msPerWeek) + 1
    const key = DAY_KEYS[d.getDay()]
    if (key && activeDaysForWeek(weekNum).has(key)) {
      const dateStr = d.toLocaleDateString("en-CA")
      if (!result.some((e) => e.date === dateStr && e.type === "strength")) {
        result.push({ date: dateStr, type: "strength", description: "Strength training" })
      }
    }
    d.setDate(d.getDate() + 1)
  }
  return result
}
```

Also add the import for `peakStrengthDay` at the top of the file. The existing import line is:
```ts
import { buildBridgeRuns } from "@workspace/ai"
```

Change to:
```ts
import { buildBridgeRuns, peakStrengthDay } from "@workspace/ai"
```

- [ ] **Add `localPhases` accumulator before the streaming loop**

Find the `localDays` declaration inside the `stream` function (line ~291):
```ts
const localDays: WorkoutDay[] = []
```

Add `localPhases` on the next line:
```ts
const localDays: WorkoutDay[] = []
let localPhases: PhaseEntry[] = []
```

- [ ] **Assign `localPhases` when `_meta` line is parsed**

Find the `setPhases(metaPhases)` call (line ~347):
```ts
setPhases(metaPhases)
```

Add the assignment on the next line:
```ts
setPhases(metaPhases)
localPhases = metaPhases
```

- [ ] **Update the call site to pass `longRunDay` and `localPhases`**

Find the current call (lines ~314–319):
```ts
finalDays = mergeStrengthDays(
  finalDays,
  planInput.strengthDays,
  new Date(localDays[0]!.date + "T00:00:00"),
  new Date(localDays[localDays.length - 1]!.date + "T00:00:00"),
)
```

Replace with:
```ts
finalDays = mergeStrengthDays(
  finalDays,
  planInput.strengthDays,
  planInput.longRunDay,
  new Date(localDays[0]!.date + "T00:00:00"),
  new Date(localDays[localDays.length - 1]!.date + "T00:00:00"),
  localPhases,
)
```

- [ ] **Run typecheck**

```bash
cd /Users/zackdorward/dev/athlos && pnpm typecheck
```

Expected: zero errors.

- [ ] **Commit**

```bash
git add apps/web/app/plan/page.tsx
git commit -m "feat: phase-aware strength scheduling per Pfitzinger (Peak=1 day, Taper=none)"
```
