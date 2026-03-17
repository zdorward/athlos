# Scheduler Science Alignment Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the training plan scheduler with modern marathon science — declarative phase config for quality sessions, progression long run type for MP-specific fatigue adaptation, and onboarding mileage consistency awareness with inline gap warning.

**Architecture:** Three coordinated changes: (1) Replace imperative `qualityCountAndTypes` switch in `workout-scheduler.ts` with a declarative `PHASE_CONFIG` that correctly encodes threshold-first → VO2max-sharpener → MP-dominant periodization with recovery-week awareness. (2) Add `"progression"` WorkoutType to `types.ts` and schedule it in Build/Peak at phase-local intervals. (3) Add a new `StepMileageConsistency` onboarding step and an inline gap warning in `StepWeeklyMileage` when goal time implies ambitious volume ramp.

**Tech Stack:** TypeScript (strict), Vitest, React 19, Next.js 16 App Router, Tailwind CSS v4, pnpm monorepo with Turbo.

---

## File Map

| File | Role |
|------|------|
| `packages/plan-engine/src/types.ts` | Add `"progression"` to `WorkoutType` union |
| `packages/plan-engine/src/workout-scheduler.ts` | Replace `qualityCountAndTypes` with `PHASE_CONFIG`; add progression long run scheduling |
| `packages/plan-engine/src/workout-scheduler.test.ts` | Extend existing tests for PHASE_CONFIG behavior and progression long runs |
| `apps/web/app/plan/workout-utils.ts` | Add `"progression"` entry to `WORKOUT_NAMES`, `WORKOUT_TEXT_CLASS`, `getWorkoutColor` |
| `apps/web/app/plan/plan-calendar.tsx` | Add `"progression"` to `RUN_TYPES` set |
| `apps/web/components/onboarding/types.ts` | Add `mileageConsistency` to `OnboardingData`; add `"mileageConsistency"` to `getSteps()` |
| `apps/web/components/onboarding/steps/step-mileage-consistency.tsx` | New step component |
| `apps/web/components/onboarding/steps/step-weekly-mileage.tsx` | Add gap warning with conditional auto-advance suppression |
| `apps/web/components/onboarding/onboarding-flow.tsx` | Wire new step into `STEP_LABELS` and `renderStep()` |

---

## Task 1: Add `"progression"` WorkoutType

**Files:**
- Modify: `packages/plan-engine/src/types.ts`

- [ ] **Step 1: Write the failing type test**

In `packages/plan-engine/src/workout-scheduler.test.ts`, add at the top of the file (after existing imports):

```ts
import type { WorkoutType } from "./types"

// Type-level test: "progression" must be a valid WorkoutType
const _progressionTypeCheck: WorkoutType = "progression"
void _progressionTypeCheck
```

- [ ] **Step 2: Run typecheck to verify it fails**

```bash
cd /path/to/repo && pnpm typecheck 2>&1 | grep "progression"
```
Expected: type error — `"progression"` not assignable to `WorkoutType`.

- [ ] **Step 3: Add `"progression"` to the `WorkoutType` union in `packages/plan-engine/src/types.ts`**

Modify the union:
```ts
export type WorkoutType =
  | "easy"
  | "long"
  | "progression"   // ← add this line
  | "medium-long"
  | "mp"
  | "tempo"
  | "intervals"
  | "rest"
  | "race"
  | "strength"
```

- [ ] **Step 4: Run typecheck to verify it passes**

```bash
pnpm typecheck
```
Expected: no errors related to `"progression"`. (Other errors from `workout-utils.ts`'s `WORKOUT_NAMES` record will appear — fix those in Task 2.)

---

## Task 2: Add `"progression"` to workout display utilities

**Files:**
- Modify: `apps/web/app/plan/workout-utils.ts`
- Modify: `apps/web/app/plan/plan-calendar.tsx`

Note: `plan-feed.tsx` does NOT need a border color change — `getWorkoutColor("progression")` returns a non-empty oklch string, so `color` is truthy and the `color ? { borderLeftColor: color }` branch handles it automatically. The `day.type === "long"` branch is only reached when `color` is empty string.

- [ ] **Step 1: Update `workout-utils.ts`**

Add `"progression"` entries to all three records and the color map:

```ts
export const WORKOUT_NAMES: Record<WorkoutType, string> = {
  easy:          "Easy Run",
  long:          "Long Run",
  progression:   "Progression Run",   // ← add
  "medium-long": "Medium-Long",
  mp:            "Race Pace",
  tempo:         "Tempo Run",
  intervals:     "Intervals",
  strength:      "Strength",
  rest:          "Rest Day",
  race:          "Race Day",
}

export const WORKOUT_TEXT_CLASS: Record<WorkoutType, string> = {
  easy:          "text-muted-foreground",
  long:          "text-primary",
  progression:   "text-primary/70",   // ← add (similar to long but slightly muted)
  "medium-long": "text-primary/70",
  mp:            "",
  tempo:         "",
  intervals:     "",
  strength:      "",
  rest:          "text-subtle-foreground",
  race:          "text-primary",
}
```

In `getWorkoutColor`, add `"progression"`:
```ts
export function getWorkoutColor(type: WorkoutType): string {
  const map: Partial<Record<WorkoutType, string>> = {
    mp:            "oklch(0.78 0.15 55)",
    tempo:         "oklch(0.78 0.15 80)",
    intervals:     "oklch(0.75 0.18 30)",
    strength:      "oklch(0.65 0.15 300)",
    progression:   "oklch(0.72 0.12 220)",  // ← add: cool blue — signals MP work
  }
  return map[type] ?? ""
}
```

- [ ] **Step 2: Update `plan-calendar.tsx` — add `"progression"` to run types**

Find the line:
```ts
const RUN_TYPES = new Set(["easy", "long", "medium-long", "mp", "tempo", "intervals", "race"])
```
Change to:
```ts
const RUN_TYPES = new Set(["easy", "long", "progression", "medium-long", "mp", "tempo", "intervals", "race"])
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```
Expected: no errors from `WorkoutType` exhaustive records.

- [ ] **Step 5: Commit**

```bash
git add packages/plan-engine/src/types.ts apps/web/app/plan/workout-utils.ts apps/web/app/plan/plan-calendar.tsx
git commit -m "feat: add progression workout type with display support"
```

---

## Task 3: Replace `qualityCountAndTypes` with declarative `PHASE_CONFIG`

**Files:**
- Modify: `packages/plan-engine/src/workout-scheduler.ts`
- Modify: `packages/plan-engine/src/workout-scheduler.test.ts`

### Background

The current `qualityCountAndTypes` function uses an imperative switch with these problems:
- Base alternates intervals/tempo (`localIndex % 2 === 0`) — should be tempo only
- Early Build assigns tempo only — should be tempo + intervals
- No recovery week awareness — recovery weeks should get 1 short tempo in Base/Build/Peak, 0 in Taper
- Peak recovery weeks get 0 quality (wrong) — should get 1 short tempo

### New `PHASE_CONFIG` structure

```ts
type QualityType = "tempo" | "intervals" | "mp"

interface PhaseSlot {
  sessions: number
  types: QualityType[]
}

const PHASE_CONFIG: Record<string, {
  normal?: PhaseSlot
  recovery?: PhaseSlot
  early?: { normal: PhaseSlot; recovery: PhaseSlot }
  late?:  { normal: PhaseSlot; recovery: PhaseSlot }
  first?: { normal: PhaseSlot; recovery: PhaseSlot }
  rest?:  { normal: PhaseSlot; recovery: PhaseSlot }
}> = {
  "General Fitness": {
    normal:   { sessions: 0, types: [] },
    recovery: { sessions: 0, types: [] },
  },
  "Base": {
    normal:   { sessions: 1, types: ["tempo"] },
    recovery: { sessions: 1, types: ["tempo"] },
  },
  "Build": {
    early: {
      normal:   { sessions: 2, types: ["tempo", "intervals"] },
      recovery: { sessions: 1, types: ["tempo"] },
    },
    late: {
      normal:   { sessions: 2, types: ["tempo", "mp"] },
      recovery: { sessions: 1, types: ["tempo"] },
    },
  },
  "Peak": {
    normal:   { sessions: 2, types: ["mp", "tempo"] },
    recovery: { sessions: 1, types: ["tempo"] },
  },
  "Taper": {
    first: {
      normal:   { sessions: 1, types: ["tempo"] },
      recovery: { sessions: 0, types: [] },
    },
    rest: {
      normal:   { sessions: 0, types: [] },
      recovery: { sessions: 0, types: [] },
    },
  },
}
```

### Recovery week detection

```ts
// In scheduleWorkouts, before the week loop:
const taperPhase = phases.find(p => p.name === "Taper")
const preTaperWeeks = taperPhase ? taperPhase.startWeek - 1 : totalWeeks
// preTaperWeeks is both the COUNT of pre-taper weeks and the NUMBER of the last pre-taper week.

// Inside the week loop:
const isRecovery = week % 4 === 0 && week !== preTaperWeeks
```

### New lookup function replacing `qualityCountAndTypes`

```ts
function getQualityConfig(
  weekNumber: number,
  phase: string,
  phases: PhaseEntry[],
  isRecovery: boolean,
): PhaseSlot {
  const phaseEntry = phases.find(p => p.name === phase)
  const localIndex = phaseEntry ? weekNumber - phaseEntry.startWeek : 0

  if (phase === "Build") {
    const buildEntry = phases.find(p => p.name === "Build")
    const buildLength = buildEntry ? buildEntry.endWeek - buildEntry.startWeek + 1 : 0
    // localIndex < Math.floor(buildLength/2) → early; else → late
    // For buildLength=1: Math.floor(1/2)=0, so localIndex(0) < 0 is false → late
    const slot = localIndex < Math.floor(buildLength / 2)
      ? PHASE_CONFIG["Build"].early!
      : PHASE_CONFIG["Build"].late!
    return isRecovery ? slot.recovery : slot.normal
  }

  if (phase === "Taper") {
    const slot = phaseEntry && weekNumber === phaseEntry.startWeek
      ? PHASE_CONFIG["Taper"].first!
      : PHASE_CONFIG["Taper"].rest!
    return isRecovery ? slot.recovery : slot.normal
  }

  const config = PHASE_CONFIG[phase] ?? PHASE_CONFIG["Base"]!
  return isRecovery
    ? (config.recovery ?? config.normal!)
    : config.normal!
}
```

- [ ] **Step 1: Write failing tests for the new phase config behavior**

Add a new `describe` block to `packages/plan-engine/src/workout-scheduler.test.ts`:

```ts
// Helpers for phase config tests
function makeInput(phases: PhaseEntry[], totalWeeks: number, selectedDays = ["mon", "wed", "fri", "sat"]) {
  return {
    startDate: "2026-06-01",
    selectedDays,
    longRunDay: "sat",
    weeklyMileageRange: "40-60" as const,
    phases,
    totalWeeks,
    peakWeeklyKm: 80,
    trainingStructure: { runDaysPerWeek: selectedDays.length, restDaysPerWeek: 7 - selectedDays.length, maxQualitySessions: 2 },
    longRunTargets: { peakLongRunKm: 30, recoveryRunMaxKm: 13 },
    paceZones,
  }
}

describe("phase config — quality session types", () => {
  it("Base weeks get 1 tempo session, not intervals", () => {
    const phases: PhaseEntry[] = [{ name: "Base", startWeek: 1, endWeek: 8 }]
    const days = scheduleWorkouts(makeInput(phases, 8))
    const qualitySessions = days.filter(d => d.type === "tempo" || d.type === "intervals" || d.type === "mp")
    // No intervals in Base
    expect(days.filter(d => d.type === "intervals")).toHaveLength(0)
    // Tempo sessions present
    expect(qualitySessions.filter(d => d.type === "tempo").length).toBeGreaterThan(0)
  })

  it("early Build gets tempo + intervals", () => {
    // 8-week Build; weeks 1-3 are early (localIndex 0-2 < floor(8/2)=4)
    const phases: PhaseEntry[] = [
      { name: "Build", startWeek: 1, endWeek: 8 },
    ]
    const days = scheduleWorkouts(makeInput(phases, 8))
    // Week 1 (localIndex 0 < 4 → early) should have both tempo and intervals
    const week1 = days.filter(d => {
      const d0 = new Date("2026-06-01T00:00:00Z")
      const dDate = new Date(d.date + "T00:00:00Z")
      const dayDiff = Math.floor((dDate.getTime() - d0.getTime()) / 86400000)
      return dayDiff < 7
    })
    const types = week1.map(d => d.type)
    expect(types).toContain("tempo")
    expect(types).toContain("intervals")
  })

  it("late Build gets tempo + mp", () => {
    // 8-week Build; weeks 5-8 are late (localIndex 4-7 >= 4)
    const phases: PhaseEntry[] = [
      { name: "Build", startWeek: 1, endWeek: 8 },
    ]
    const days = scheduleWorkouts(makeInput(phases, 8))
    // Week 5 (localIndex 4 >= 4 → late) should have both tempo and mp, no intervals
    const week5 = days.filter(d => {
      const d0 = new Date("2026-06-01T00:00:00Z")
      const dDate = new Date(d.date + "T00:00:00Z")
      const dayDiff = Math.floor((dDate.getTime() - d0.getTime()) / 86400000)
      return dayDiff >= 28 && dayDiff < 35
    })
    const types = week5.map(d => d.type)
    expect(types).toContain("tempo")
    expect(types).toContain("mp")
    expect(types).not.toContain("intervals")
  })

  it("Peak recovery week (every 4th) gets 1 tempo, not 2 sessions", () => {
    // 8-week Peak with no taper; week 4 is a recovery week (4 % 4 === 0)
    const phases: PhaseEntry[] = [
      { name: "Peak", startWeek: 1, endWeek: 8 },
    ]
    const days = scheduleWorkouts(makeInput(phases, 8))
    // Week 4 = recovery week; should have 1 quality session (tempo), not mp
    const week4Quality = days.filter(d => {
      const d0 = new Date("2026-06-01T00:00:00Z")
      const dDate = new Date(d.date + "T00:00:00Z")
      const dayDiff = Math.floor((dDate.getTime() - d0.getTime()) / 86400000)
      return dayDiff >= 21 && dayDiff < 28 && (d.type === "tempo" || d.type === "mp" || d.type === "intervals")
    })
    expect(week4Quality).toHaveLength(1)
    expect(week4Quality[0]!.type).toBe("tempo")
  })

  it("Taper week 1 gets 1 tempo session", () => {
    const phases: PhaseEntry[] = [
      { name: "Peak", startWeek: 1, endWeek: 4 },
      { name: "Taper", startWeek: 5, endWeek: 7 },
    ]
    const days = scheduleWorkouts(makeInput(phases, 7))
    // Week 5 = taper first week; 1 tempo
    const week5Quality = days.filter(d => {
      const d0 = new Date("2026-06-01T00:00:00Z")
      const dDate = new Date(d.date + "T00:00:00Z")
      const dayDiff = Math.floor((dDate.getTime() - d0.getTime()) / 86400000)
      return dayDiff >= 28 && dayDiff < 35 && (d.type === "tempo" || d.type === "mp" || d.type === "intervals")
    })
    expect(week5Quality).toHaveLength(1)
    expect(week5Quality[0]!.type).toBe("tempo")
  })

  it("Taper weeks 2+ get no quality sessions", () => {
    const phases: PhaseEntry[] = [
      { name: "Peak", startWeek: 1, endWeek: 4 },
      { name: "Taper", startWeek: 5, endWeek: 7 },
    ]
    const days = scheduleWorkouts(makeInput(phases, 7))
    // Weeks 6-7 = taper rest weeks; 0 quality
    const taper23Quality = days.filter(d => {
      const d0 = new Date("2026-06-01T00:00:00Z")
      const dDate = new Date(d.date + "T00:00:00Z")
      const dayDiff = Math.floor((dDate.getTime() - d0.getTime()) / 86400000)
      return dayDiff >= 35 && (d.type === "tempo" || d.type === "mp" || d.type === "intervals")
    })
    expect(taper23Quality).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd packages/plan-engine && pnpm vitest run workout-scheduler.test.ts 2>&1 | tail -30
```
Expected: multiple failures in the new `describe` block.

- [ ] **Step 3: Replace `qualityCountAndTypes` in `workout-scheduler.ts`**

Delete the entire `qualityCountAndTypes` function (lines ~60–100). Replace with:

```ts
type QualityType = "tempo" | "intervals" | "mp"

interface PhaseSlot {
  sessions: number
  types: QualityType[]
}

const PHASE_CONFIG = {
  "General Fitness": {
    normal:   { sessions: 0, types: [] as QualityType[] },
    recovery: { sessions: 0, types: [] as QualityType[] },
  },
  "Base": {
    normal:   { sessions: 1, types: ["tempo"] as QualityType[] },
    recovery: { sessions: 1, types: ["tempo"] as QualityType[] },
  },
  "Build": {
    early: {
      normal:   { sessions: 2, types: ["tempo", "intervals"] as QualityType[] },
      recovery: { sessions: 1, types: ["tempo"] as QualityType[] },
    },
    late: {
      normal:   { sessions: 2, types: ["tempo", "mp"] as QualityType[] },
      recovery: { sessions: 1, types: ["tempo"] as QualityType[] },
    },
  },
  "Peak": {
    normal:   { sessions: 2, types: ["mp", "tempo"] as QualityType[] },
    recovery: { sessions: 1, types: ["tempo"] as QualityType[] },
  },
  "Taper": {
    first: {
      normal:   { sessions: 1, types: ["tempo"] as QualityType[] },
      recovery: { sessions: 0, types: [] as QualityType[] },
    },
    rest: {
      normal:   { sessions: 0, types: [] as QualityType[] },
      recovery: { sessions: 0, types: [] as QualityType[] },
    },
  },
} as const satisfies Record<string, unknown>

function getQualityConfig(
  weekNumber: number,
  phase: string,
  phases: PhaseEntry[],
  isRecovery: boolean,
): PhaseSlot {
  const phaseEntry = phases.find(p => p.name === phase)
  const localIndex = phaseEntry ? weekNumber - phaseEntry.startWeek : 0

  if (phase === "Build") {
    const buildEntry = phases.find(p => p.name === "Build")
    const buildLength = buildEntry ? buildEntry.endWeek - buildEntry.startWeek + 1 : 0
    const slot = localIndex < Math.floor(buildLength / 2)
      ? PHASE_CONFIG["Build"].early
      : PHASE_CONFIG["Build"].late
    return isRecovery ? slot.recovery : slot.normal
  }

  if (phase === "Taper") {
    const slot = phaseEntry && weekNumber === phaseEntry.startWeek
      ? PHASE_CONFIG["Taper"].first
      : PHASE_CONFIG["Taper"].rest
    return isRecovery ? slot.recovery : slot.normal
  }

  const config = (PHASE_CONFIG as Record<string, { normal: PhaseSlot; recovery: PhaseSlot }>)[phase]
    ?? PHASE_CONFIG["Base"]
  return isRecovery ? config.recovery : config.normal
}
```

- [ ] **Step 4: Update `scheduleWorkouts` to use the new function**

In `scheduleWorkouts`, add `preTaperWeeks` before the week loop:

```ts
const taperPhase = phases.find(p => p.name === "Taper")
const preTaperWeeks = taperPhase ? taperPhase.startWeek - 1 : totalWeeks
```

Inside the week loop, add `isRecovery` and change the `qualityCountAndTypes` call:

```ts
// Replace:
const { count, types } = qualityCountAndTypes(week, phase, phases, trainingStructure.maxQualitySessions)

// With:
const isRecovery = week % 4 === 0 && week !== preTaperWeeks
const { sessions, types } = getQualityConfig(week, phase, phases, isRecovery)
const count = Math.min(sessions, trainingStructure.maxQualitySessions)
```

Update the loop body to use `count` and `types` (types is now `QualityType[]` not `Array<"tempo" | "intervals" | "mp">`):

```ts
for (let i = 0; i < count; i++) {
  const type = types[i]!
  // rest of existing loop body unchanged
```

- [ ] **Step 5: Run the tests**

```bash
cd packages/plan-engine && pnpm vitest run workout-scheduler.test.ts 2>&1 | tail -30
```
Expected: new describe block passes. Existing tests may need minor updates if they assert specific quality session counts (update assertions to match new behavior).

- [ ] **Step 6: Fix the two existing tests that will break**

Two existing tests in `workout-scheduler.test.ts` assert OLD behavior and must be updated:

**Test 1** — line ~155: "Base phase: 1 quality/week — intervals on even local index, tempo on odd"

Old:
```ts
expect(week1Quality[0]!.type).toBe("intervals") // week 1 = local index 0 = even
expect(week2Quality[0]!.type).toBe("tempo")      // week 2 = local index 1 = odd
```
Replace with (new `PHASE_CONFIG` makes Base always tempo):
```ts
expect(week1Quality[0]!.type).toBe("tempo")
expect(week2Quality[0]!.type).toBe("tempo")
```
Also update the `it` description: `"Base weeks always get 1 tempo session"`.

**Test 2** — line ~167: "Build first half: 1 tempo/week"

Old assertion for early Build week 1:
```ts
expect(buildW1).toHaveLength(1)
expect(buildW1[0]!.type).toBe("tempo")
```
New `PHASE_CONFIG` gives early Build 2 sessions (tempo + intervals). Replace with:
```ts
expect(buildW1).toHaveLength(2)
const types = buildW1.map(d => d.type)
expect(types).toContain("tempo")
expect(types).toContain("intervals")
```
Also update the `it` description: `"Build early half: 2 sessions — tempo + intervals"`.

Run full suite after fixing:
```bash
cd packages/plan-engine && pnpm vitest run 2>&1 | tail -40
```

- [ ] **Step 7: Commit**

```bash
git add packages/plan-engine/src/workout-scheduler.ts packages/plan-engine/src/workout-scheduler.test.ts
git commit -m "feat: replace qualityCountAndTypes with declarative PHASE_CONFIG"
```

---

## Task 4: Add progression long run scheduling

**Files:**
- Modify: `packages/plan-engine/src/workout-scheduler.ts`
- Modify: `packages/plan-engine/src/workout-scheduler.test.ts`

### Background

The existing scheduler assigns all long runs as `type: "long"`. Per the spec:
- Build phase: every 3rd long run (where `localIndex % 3 === 2`) → `type: "progression"`
- Peak phase: every other long run (`localIndex % 2 === 1`) → `type: "progression"`
- All other phases: `type: "long"`

`localIndex` = `weekNumber - phaseEntry.startWeek` (0-indexed within the phase). This variable already exists in the scheduler's week loop via the `phaseForWeek` lookup.

A progression run has the same distance and pace properties as a long run. The only difference is the `type` field.

- [ ] **Step 1: Write failing test**

Add to `packages/plan-engine/src/workout-scheduler.test.ts`:

Date arithmetic reference (startDate = "2026-06-01", a Monday; longRunDay = "sat"):
- Week 1 Sat: 2026-06-06 (offset 5), localIndex 0
- Week 2 Sat: 2026-06-13 (offset 12), localIndex 1
- Week 3 Sat: 2026-06-20 (offset 19), localIndex 2 ← this is the progression week (2 % 3 === 2)
- Week 4 Sat: 2026-06-27 (offset 26), localIndex 3

```ts
describe("progression long runs", () => {
  it("Build week 3 (localIndex 2) gets a progression run", () => {
    // 6-week Build starting week 1; localIndex 2 → 2 % 3 === 2 → progression
    // startDate "2026-06-01" (Mon); week 3 Sat = offset 19 = "2026-06-20"
    const phases: PhaseEntry[] = [{ name: "Build", startWeek: 1, endWeek: 6 }]
    const days = scheduleWorkouts(makeInput(phases, 6))
    const thirdSat = days.find(d => d.date === "2026-06-20") // week 3 Saturday
    expect(thirdSat?.type).toBe("progression")
  })

  it("Build weeks 1 and 2 get regular long runs", () => {
    // Week 1 (localIndex 0): 0 % 3 = 0 ≠ 2 → long
    // Week 2 (localIndex 1): 1 % 3 = 1 ≠ 2 → long
    const phases: PhaseEntry[] = [{ name: "Build", startWeek: 1, endWeek: 6 }]
    const days = scheduleWorkouts(makeInput(phases, 6))
    const sat1 = days.find(d => d.date === "2026-06-06") // week 1 Sat
    const sat2 = days.find(d => d.date === "2026-06-13") // week 2 Sat
    expect(sat1?.type).toBe("long")
    expect(sat2?.type).toBe("long")
  })

  it("Peak odd-indexed weeks get progression runs", () => {
    // 4-week Peak; localIndex 1 and 3 → progression (% 2 === 1)
    const phases: PhaseEntry[] = [{ name: "Peak", startWeek: 1, endWeek: 4 }]
    const days = scheduleWorkouts(makeInput(phases, 4))
    const sat2 = days.find(d => d.date === "2026-06-13") // week 2, localIndex 1
    const sat4 = days.find(d => d.date === "2026-06-27") // week 4, localIndex 3
    expect(sat2?.type).toBe("progression")
    expect(sat4?.type).toBe("progression")
  })

  it("Peak even-indexed weeks get regular long runs", () => {
    const phases: PhaseEntry[] = [{ name: "Peak", startWeek: 1, endWeek: 4 }]
    const days = scheduleWorkouts(makeInput(phases, 4))
    const sat1 = days.find(d => d.date === "2026-06-06") // week 1, localIndex 0
    const sat3 = days.find(d => d.date === "2026-06-20") // week 3, localIndex 2
    expect(sat1?.type).toBe("long")
    expect(sat3?.type).toBe("long")
  })

  it("Base long runs are always type long", () => {
    const phases: PhaseEntry[] = [{ name: "Base", startWeek: 1, endWeek: 6 }]
    const days = scheduleWorkouts(makeInput(phases, 6))
    const longRuns = days.filter(d => d.type === "long" || d.type === "progression")
    expect(longRuns.every(d => d.type === "long")).toBe(true)
  })

  it("progression run has same pace as long run", () => {
    const phases: PhaseEntry[] = [{ name: "Build", startWeek: 1, endWeek: 6 }]
    const days = scheduleWorkouts(makeInput(phases, 6))
    const progression = days.find(d => d.type === "progression")
    expect(progression?.targetPace).toBe(paceZones.longRun)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd packages/plan-engine && pnpm vitest run workout-scheduler.test.ts -t "progression" 2>&1 | tail -20
```
Expected: FAIL — type is `"long"` not `"progression"`.

- [ ] **Step 3: Add `getLongRunType` module-level helper and compute `localIndex` in the week loop**

**Part A:** Add this function above `scheduleWorkouts` (module-level, not inside the loop):

```ts
function getLongRunType(phase: string, localIndex: number): "long" | "progression" {
  if (phase === "Build" && localIndex % 3 === 2) return "progression"
  if (phase === "Peak"  && localIndex % 2 === 1) return "progression"
  return "long"
}
```

**Part B:** In the week loop, compute `localIndex` once per week (right after computing `phase`, before the long run section):

```ts
const phase = phaseForWeek(week, phases)
const phaseEntry = phases.find(p => p.name === phase)
const localIndex = phaseEntry ? week - phaseEntry.startWeek : 0
```

This `localIndex` is already computed inside `getQualityConfig` but the function doesn't expose it. Rather than refactoring `getQualityConfig`'s signature, compute it once in the loop and use it in both places — the computation is a single expression and the duplication cost is negligible.

**Part C:** In the `// ── 1. Long run ──` section, replace `type: "long"` with:

```ts
assigned.set(longRunEntry.date, [{
  date: longRunEntry.date,
  type: getLongRunType(phase, localIndex),
  distanceKm: longRunKm,
  targetPace: paceZones.longRun,
}])
```

- [ ] **Step 4: Run the tests**

```bash
cd packages/plan-engine && pnpm vitest run workout-scheduler.test.ts 2>&1 | tail -30
```
Expected: all progression tests pass.

- [ ] **Step 5: Run full test suite**

```bash
cd packages/plan-engine && pnpm vitest run
```
Expected: all passing.

- [ ] **Step 6: Commit**

```bash
git add packages/plan-engine/src/workout-scheduler.ts packages/plan-engine/src/workout-scheduler.test.ts
git commit -m "feat: schedule progression long runs in Build and Peak phases"
```

---

## Task 5: Add `StepMileageConsistency` onboarding step

**Files:**
- Modify: `apps/web/components/onboarding/types.ts`
- Create: `apps/web/components/onboarding/steps/step-mileage-consistency.tsx`
- Modify: `apps/web/components/onboarding/onboarding-flow.tsx`

- [ ] **Step 1: Add `mileageConsistency` to `OnboardingData` and `getSteps()`**

In `apps/web/components/onboarding/types.ts`, add the field to `OnboardingData`:

```ts
export interface OnboardingData {
  goal?: Goal
  race?: RaceData
  timeGoal?: boolean
  goalTime?: { hours: number; minutes: number }
  selectedDays?: Day[]
  longRunDay?: Day
  weeklyMileageRange?: "under-40" | "40-60" | "60-80" | "80-plus"
  mileageConsistency?: "lt-4w" | "4-12w" | "3-6m" | "6m-plus"  // ← add
  units?: "km" | "miles"
}
```

Update `getSteps()`:

```ts
export function getSteps(): readonly string[] {
  return [
    "findRace",
    "goalTime",
    "whichDays",
    "weeklyMileage",
    "mileageConsistency",  // ← add after weeklyMileage
  ]
}
```

- [ ] **Step 2: Create `step-mileage-consistency.tsx`**

Model this exactly after `step-weekly-mileage.tsx` — same structure, auto-advance on selection.

```tsx
"use client"

import { useState } from "react"
import { OnboardingCard } from "../onboarding-card"
import type { StepProps } from "../types"

type MileageConsistency = "lt-4w" | "4-12w" | "3-6m" | "6m-plus"

const OPTIONS: { value: MileageConsistency; label: string; description: string }[] = [
  { value: "lt-4w",    label: "Less than 4 weeks",  description: "Recently started at this volume" },
  { value: "4-12w",    label: "4–12 weeks",          description: "Building into this volume" },
  { value: "3-6m",     label: "3–6 months",          description: "Consistently training at this level" },
  { value: "6m-plus",  label: "6+ months",           description: "Well-established base" },
]

export function StepMileageConsistency({ formData, onNext }: Pick<StepProps, "formData" | "onNext">) {
  const [selected, setSelected] = useState<MileageConsistency | undefined>(formData.mileageConsistency)

  function handleSelect(value: MileageConsistency) {
    setSelected(value)
    setTimeout(() => onNext({ mileageConsistency: value }), 150)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          How long have you been training at this weekly mileage?
        </h2>
      </div>
      <div className="space-y-3">
        {OPTIONS.map((opt) => (
          <OnboardingCard
            key={opt.value}
            label={opt.label}
            description={opt.description}
            selected={selected === opt.value}
            onClick={() => handleSelect(opt.value)}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Wire the new step into `onboarding-flow.tsx`**

Open `apps/web/components/onboarding/onboarding-flow.tsx`.

a) Add the import at the top with the other step imports:
```ts
import { StepMileageConsistency } from "./steps/step-mileage-consistency"
```

b) Add to `STEP_LABELS`:
```ts
const STEP_LABELS: Record<string, string> = {
  findRace:           "Find your race",
  goalTime:           "Goal time",
  whichDays:          "Running days",
  weeklyMileage:      "Weekly mileage",
  mileageConsistency: "Training history",  // ← add
}
```

c) Add to `renderStep()` switch:
```ts
case "mileageConsistency": return <StepMileageConsistency {...stepProps} />
```
Add this case immediately after the `"weeklyMileage"` case.

- [ ] **Step 4: Run typecheck**

```bash
pnpm typecheck
```
Expected: no errors.

- [ ] **Step 5: Manually smoke-test the onboarding flow**

```bash
pnpm dev
```
Navigate through onboarding. After "Weekly mileage", the "Training history" step should appear with 4 options. Selecting an option should auto-advance to the plan generation page.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/onboarding/types.ts apps/web/components/onboarding/steps/step-mileage-consistency.tsx apps/web/components/onboarding/onboarding-flow.tsx
git commit -m "feat: add mileage consistency onboarding step"
```

---

## Task 6: Add mileage gap warning to `StepWeeklyMileage`

**Files:**
- Modify: `apps/web/components/onboarding/steps/step-weekly-mileage.tsx`

### Background

When a user's goal time implies a peak weekly km far above their current mileage, we show an inline amber warning. The user must tap "Continue" to proceed (auto-advance is suppressed).

**Warning condition:** `peakWeeklyKm > startingVol * 1.5`

Where:
- `startingVol` comes from `MILEAGE_RANGE_LOW_KM` (defined locally, in km)
- `peakWeeklyKm` = `computeGoalPeakMileage(formData.race.distance, goalTotalMinutes)?.high`
- `goalTotalMinutes` = `formData.goalTime.hours * 60 + formData.goalTime.minutes`
- If `formData.goalTime` is undefined OR `formData.race?.distance` is undefined → no warning

**Interaction model:**
1. User selects a range → show as selected
2. If condition met: suppress auto-advance, show warning + Continue button
3. If user selects a *different* range: re-evaluate immediately. If new range also triggers warning, show new warning. If not, auto-advance as normal (no Continue button).
4. Tapping Continue → `onNext({ weeklyMileageRange: selected })`

- [ ] **Step 1: Update `step-weekly-mileage.tsx`**

Replace the entire file:

```tsx
"use client"

import { useState } from "react"
import { computeGoalPeakMileage } from "@workspace/plan-engine"
import { OnboardingCard } from "../onboarding-card"
import type { StepProps } from "../types"

type MileageRange = "under-40" | "40-60" | "60-80" | "80-plus"

const KM_OPTIONS: { value: MileageRange; label: string; description: string }[] = [
  { value: "under-40", label: "Under 40 km/week",  description: "Building base fitness" },
  { value: "40-60",   label: "40–60 km/week",      description: "Consistent recreational runner" },
  { value: "60-80",   label: "60–80 km/week",      description: "Consistent club runner" },
  { value: "80-plus", label: "80+ km/week",         description: "High mileage athlete" },
]

const MILES_OPTIONS: { value: MileageRange; label: string; description: string }[] = [
  { value: "under-40", label: "Under 25 mi/week",  description: "Building base fitness" },
  { value: "40-60",   label: "25–37 mi/week",      description: "Consistent recreational runner" },
  { value: "60-80",   label: "37–50 mi/week",      description: "Consistent club runner" },
  { value: "80-plus", label: "50+ mi/week",         description: "High mileage athlete" },
]

// Always in km — matches WEEK1_VOLUME_KM in volume-progression.ts
const MILEAGE_RANGE_LOW_KM: Record<MileageRange, number> = {
  "under-40": 30,
  "40-60":    40,
  "60-80":    60,
  "80-plus":  80,
}

function computeWarning(
  range: MileageRange,
  formData: StepProps["formData"],
): { peakKm: number; multiplier: number } | null {
  if (!formData.goalTime || !formData.race?.distance) return null
  const goalTotalMinutes = formData.goalTime.hours * 60 + formData.goalTime.minutes
  const result = computeGoalPeakMileage(formData.race.distance, goalTotalMinutes)
  if (!result) return null
  const startingVol = MILEAGE_RANGE_LOW_KM[range]
  const peakKm = result.high
  if (peakKm <= startingVol * 1.5) return null
  const multiplier = Math.round((peakKm / startingVol) * 10) / 10
  return { peakKm: Math.round(peakKm), multiplier }
}

export function StepWeeklyMileage({ formData, onNext }: Pick<StepProps, "formData" | "onNext">) {
  const [selected, setSelected] = useState<MileageRange | undefined>(formData.weeklyMileageRange)
  const [warning, setWarning] = useState<{ peakKm: number; multiplier: number } | null>(() =>
    formData.weeklyMileageRange ? computeWarning(formData.weeklyMileageRange, formData) : null
  )
  const units = formData.units ?? "km"
  const options = units === "miles" ? MILES_OPTIONS : KM_OPTIONS

  function handleSelect(value: MileageRange) {
    setSelected(value)
    const w = computeWarning(value, formData)
    setWarning(w)
    if (!w) {
      setTimeout(() => onNext({ weeklyMileageRange: value }), 150)
    }
    // If warning: stay on page, show warning + Continue button
  }

  function handleContinue() {
    if (selected) onNext({ weeklyMileageRange: selected })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          {units === "miles"
            ? "How many miles do you run per week?"
            : "How many kilometres do you run per week?"}
        </h2>
        <p className="text-sm text-muted-foreground">
          This sets your starting volume for week 1 of the plan.
        </p>
      </div>
      <div className="space-y-3">
        {options.map((opt) => (
          <OnboardingCard
            key={opt.value}
            label={opt.label}
            description={opt.description}
            selected={selected === opt.value}
            onClick={() => handleSelect(opt.value)}
          />
        ))}
      </div>
      {warning && selected && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30 p-4 space-y-3">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Your goal time implies peak training weeks of ~{warning.peakKm} km — about {warning.multiplier}× your current volume. Your plan will ramp gradually, but this is an ambitious build. Consider extending your plan start date for more ramp time.
          </p>
          <button
            onClick={handleContinue}
            className="text-sm font-medium text-amber-900 dark:text-amber-200 underline underline-offset-2"
          >
            Continue anyway
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```
Expected: no errors.

- [ ] **Step 3: Manually test the warning**

```bash
pnpm dev
```
Complete onboarding with a goal time that implies high volume (e.g., sub-3:00 marathon) but select a low mileage range ("Under 40 km/week"). The warning should appear with a "Continue anyway" button. Tapping Continue should advance to the next step.

Select a high mileage range ("80+ km/week") with the same goal time — the warning should not appear and should auto-advance.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/onboarding/steps/step-weekly-mileage.tsx
git commit -m "feat: add mileage gap warning to weekly mileage step"
```

---

## Task 7: Final verification

- [ ] **Step 1: Run full test suite**

```bash
cd packages/plan-engine && pnpm vitest run
```
Expected: all tests pass.

- [ ] **Step 2: Run typecheck across all packages**

```bash
pnpm typecheck
```
Expected: no errors.

- [ ] **Step 3: Run lint**

```bash
pnpm lint
```
Expected: no errors.

- [ ] **Step 4: Manual end-to-end smoke test**

```bash
pnpm dev
```
- Complete onboarding with a full marathon goal time of 3:20 (200 min) and "40–60 km/week" starting volume.
- Verify warning appears (peak km for 3:20 full = 80 km; 40 × 1.5 = 60; 80 > 60 → warning expected).
- Advance through "Training history" step — confirm it appears and auto-advances.
- On the plan page, verify:
  - Build-phase long runs: every 3rd is labeled "Progression Run"
  - Peak-phase long runs: every other is "Progression Run"
  - Early Build weeks have both tempo and intervals sessions
  - Late Build weeks have tempo and MP sessions
  - Peak recovery weeks (week 4 if 4-week Peak) have 1 tempo session

- [ ] **Step 5: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "chore: cleanup after scheduler science alignment"
```
