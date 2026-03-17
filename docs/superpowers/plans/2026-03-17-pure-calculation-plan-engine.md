# Pure Calculation Plan Engine Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace LLM-based plan generation with a deterministic, pure-calculation scheduler that eliminates API costs and latency.

**Architecture:** Rename `packages/ai` → `packages/plan-engine`; add `volume-progression.ts` and `workout-scheduler.ts` as pure functions; replace the streaming NDJSON API route with a synchronous JSON endpoint; remove strength configuration from onboarding (scheduler assigns strength automatically).

**Tech Stack:** TypeScript, Vitest, Next.js App Router, pnpm monorepo with Turbo

---

## File Map

**New files:**
- `packages/plan-engine/src/volume-progression.ts` — computes weekly km array
- `packages/plan-engine/src/volume-progression.test.ts`
- `packages/plan-engine/src/workout-scheduler.ts` — slot-based scheduler, returns `WorkoutDay[]`
- `packages/plan-engine/src/workout-scheduler.test.ts`

**Modified files:**
- `packages/plan-engine/package.json` — rename `@workspace/ai` → `@workspace/plan-engine`, remove `@anthropic-ai/sdk`
- `packages/plan-engine/src/types.ts` — remove `description` from `WorkoutDay`; remove `strengthTraining`/`strengthDays` from `PlanGenerationInput`; remove `TrainingPlanMeta`
- `packages/plan-engine/src/index.ts` — remove LLM exports; export scheduler + volume-progression
- `packages/plan-engine/src/pace-calculator.ts` — rename `maxQualityPerWeek` → `maxQualitySessions`
- `packages/plan-engine/src/bridge-runs.ts` — inline `firstMondayOnOrAfter` (currently imported from `race-prompt.ts`)
- `apps/web/package.json` — update dep `@workspace/ai` → `@workspace/plan-engine`
- `apps/web/app/api/generate-plan/route.ts` — sync JSON, precondition validation, scheduler call
- `apps/web/app/plan/page.tsx` — replace streaming with `fetch` + `.json()`, remove `mergeStrengthDays`, add staggered reveal animation
- `apps/web/app/(app)/plan/[id]/page.tsx` — update import path
- `apps/web/components/onboarding/types.ts` — remove `strengthTraining`/`strengthDays`/`strength` step
- `apps/web/components/onboarding/onboarding-flow.tsx` — remove `StepStrength` import and case
- `apps/web/components/onboarding/final-screen.tsx` — remove strength display row
- `turbo.json` — remove `ANTHROPIC_API_KEY`, `AI_PROVIDER`, `AI_MODEL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

**Deleted files:**
- `packages/plan-engine/src/providers/claude.ts`
- `packages/plan-engine/src/provider.ts`
- `packages/plan-engine/src/config.ts`
- `packages/plan-engine/src/race-prompt.ts`
- `packages/plan-engine/src/race-prompt.test.ts`
- `packages/plan-engine/src/strength-recommendation.ts`
- `packages/plan-engine/src/strength-recommendation.test.ts`
- `apps/web/components/onboarding/steps/step-strength.tsx`

---

## Task 1: Rename the package directory

**Files:**
- Rename: `packages/ai/` → `packages/plan-engine/`
- Modify: `packages/plan-engine/package.json`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Rename directory**

```bash
mv packages/ai packages/plan-engine
```

- [ ] **Step 2: Update package name**

In `packages/plan-engine/package.json`, change `"name": "@workspace/ai"` → `"name": "@workspace/plan-engine"`.

- [ ] **Step 3: Update web app dependency**

In `apps/web/package.json`, change `"@workspace/ai": "workspace:*"` → `"@workspace/plan-engine": "workspace:*"`.

- [ ] **Step 4: Update all import paths across the monorepo**

```bash
grep -r '@workspace/ai' apps packages --include='*.ts' --include='*.tsx' -l
```

For each file found, replace `@workspace/ai` with `@workspace/plan-engine`. This includes:
- `apps/web/app/api/generate-plan/route.ts`
- `apps/web/app/plan/page.tsx`
- `apps/web/app/(app)/plan/[id]/page.tsx`
- Any other files surfaced by the grep

- [ ] **Step 4b: Check turbo.json for any path references to packages/ai**

```bash
grep -i 'packages/ai' turbo.json
```

If any path references exist, update them to `packages/plan-engine`.

- [ ] **Step 5: Reinstall to update pnpm lockfile**

```bash
pnpm install
```

- [ ] **Step 6: Verify typecheck still resolves the package**

```bash
pnpm typecheck 2>&1 | head -30
```

Expected: errors may exist (we haven't updated types yet) but the package should resolve — no `Cannot find module '@workspace/plan-engine'` errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: rename packages/ai to packages/plan-engine"
```

---

## Task 2: Update WorkoutDay and PlanGenerationInput types

**Files:**
- Modify: `packages/plan-engine/src/types.ts`

- [ ] **Step 1: Remove `description` from `WorkoutDay`**

Delete the line `description: string` from the `WorkoutDay` interface. The field is gone entirely — not optional.

Remove `TrainingPlanMeta` interface entirely (it was the LLM streaming metadata shape).

- [ ] **Step 2: Remove strength fields from `PlanGenerationInput`**

Delete `strengthTraining: boolean` and `strengthDays?: string[]` from the `PlanGenerationInput` interface.

After edits `types.ts` should look like:

```typescript
export type WorkoutType =
  | "easy"
  | "long"
  | "medium-long"
  | "mp"
  | "tempo"
  | "intervals"
  | "rest"
  | "race"
  | "strength"

export interface WorkoutDay {
  date: string
  type: WorkoutType
  distanceKm?: number
  targetHR?: string
  targetPace?: string
  completed?: boolean
  effort?: "hard" | "good" | "easy"
}

export interface PhaseEntry {
  name: string
  startWeek: number
  endWeek: number
}

export interface TrainingPlan {
  totalWeeks: number
  totalKm: number
  peakWeekKm: number
  days: WorkoutDay[]
  phases?: PhaseEntry[]
}

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
  weeklyMileageRange: "under-40" | "40-60" | "60-80" | "80-plus"
}
```

- [ ] **Step 3: Run typecheck to see what breaks**

```bash
pnpm typecheck 2>&1 | grep -E "error TS" | head -20
```

Note the files with errors — they reference `description`, `strengthTraining`, or `strengthDays`. We'll fix them in later tasks.

- [ ] **Step 4: Commit**

```bash
git add packages/plan-engine/src/types.ts
git commit -m "refactor: remove description from WorkoutDay, remove strength fields from PlanGenerationInput"
```

---

## Task 3: Rename maxQualityPerWeek → maxQualitySessions

**Files:**
- Modify: `packages/plan-engine/src/pace-calculator.ts`

The scheduler spec references `trainingStructure.maxQualitySessions` but the existing code uses `maxQualityPerWeek`. Rename it to match the spec.

- [ ] **Step 1: Rename in pace-calculator.ts**

In `computeTrainingStructure`, change the return type and all internal references from `maxQualityPerWeek` to `maxQualitySessions`.

Change: `return { runDaysPerWeek: run, restDaysPerWeek: rest, maxQualityPerWeek: quality }`
To: `return { runDaysPerWeek: run, restDaysPerWeek: rest, maxQualitySessions: quality }`

- [ ] **Step 2: Update callers**

```bash
grep -r 'maxQualityPerWeek' apps packages --include='*.ts' --include='*.tsx'
```

Update any file that destructures or accesses `maxQualityPerWeek` to use `maxQualitySessions`.

- [ ] **Step 3: Run tests**

```bash
cd packages/plan-engine && pnpm test
```

Expected: all existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/plan-engine/src/pace-calculator.ts
git commit -m "refactor: rename maxQualityPerWeek to maxQualitySessions"
```

---

## Task 4: Move firstMondayOnOrAfter into bridge-runs.ts

`race-prompt.ts` is being deleted. `bridge-runs.ts` currently imports `firstMondayOnOrAfter` from it. Move the function.

**Files:**
- Modify: `packages/plan-engine/src/bridge-runs.ts`

- [ ] **Step 1: Copy firstMondayOnOrAfter into bridge-runs.ts**

Read `race-prompt.ts` to find the exact implementation of `firstMondayOnOrAfter`. Add it as a local (non-exported) function at the top of `bridge-runs.ts`.

- [ ] **Step 2: Remove the import from race-prompt**

Delete the `import { firstMondayOnOrAfter } from "./race-prompt"` line at the top of `bridge-runs.ts`.

- [ ] **Step 3: Export firstMondayOnOrAfter from bridge-runs.ts**

The function is currently re-exported from `index.ts` (for use by plan/page.tsx). After this change, update `index.ts` to import it from `./bridge-runs` instead of `./race-prompt`. (We'll clean up `index.ts` fully in Task 11 — for now just fix the import.)

- [ ] **Step 4: Run bridge-runs tests**

```bash
cd packages/plan-engine && pnpm test bridge-runs
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add packages/plan-engine/src/bridge-runs.ts packages/plan-engine/src/index.ts
git commit -m "refactor: inline firstMondayOnOrAfter into bridge-runs.ts"
```

---

## Task 5: Write volume-progression.ts (TDD)

**Files:**
- Create: `packages/plan-engine/src/volume-progression.test.ts`
- Create: `packages/plan-engine/src/volume-progression.ts`

The spec defines `computeWeeklyVolumes(input: VolumeProgressionInput): number[]`. Rules (checked in order, rule 6 is a post-processing cap):

1. Taper weeks: 80%/60%/40% of peak based on taper week index
2. Final non-taper week: standard progression (suppresses rule 3)
3. Recovery weeks: `weekNumber % 4 === 0` → 70% of prior week
4. Week 1: lower bound of weeklyMileageRange
5. All other: prior × 1.10
6. Cap: `Math.min(result, peakWeeklyKm)` — always applied

Week 1 lower bounds: `under-40` → 30, `40-60` → 40, `60-80` → 60, `80-plus` → 80.

- [ ] **Step 1: Write the test file**

```typescript
// packages/plan-engine/src/volume-progression.test.ts
import { describe, it, expect } from "vitest"
import { computeWeeklyVolumes } from "./volume-progression"
import type { PhaseEntry } from "./types"

const noTaperPhases: PhaseEntry[] = [
  { name: "Base",  startWeek: 1, endWeek: 6 },
  { name: "Build", startWeek: 7, endWeek: 10 },
  { name: "Peak",  startWeek: 11, endWeek: 12 },
]

const withTaperPhases: PhaseEntry[] = [
  { name: "Base",  startWeek: 1, endWeek: 6 },
  { name: "Build", startWeek: 7, endWeek: 10 },
  { name: "Peak",  startWeek: 11, endWeek: 14 },
  { name: "Taper", startWeek: 15, endWeek: 17 },
]

describe("computeWeeklyVolumes", () => {
  it("week 1 uses lower bound of weeklyMileageRange", () => {
    const vols = computeWeeklyVolumes({
      totalWeeks: 8,
      weeklyMileageRange: "40-60",
      peakWeeklyKm: 100,
      phases: noTaperPhases,
    })
    expect(vols[0]).toBe(40)
  })

  it("week 1 lower bounds: under-40=30, 60-80=60, 80-plus=80", () => {
    const base = { totalWeeks: 8, peakWeeklyKm: 200, phases: noTaperPhases }
    expect(computeWeeklyVolumes({ ...base, weeklyMileageRange: "under-40" })[0]).toBe(30)
    expect(computeWeeklyVolumes({ ...base, weeklyMileageRange: "60-80" })[0]).toBe(60)
    expect(computeWeeklyVolumes({ ...base, weeklyMileageRange: "80-plus" })[0]).toBe(80)
  })

  it("non-recovery weeks grow by 10%", () => {
    const vols = computeWeeklyVolumes({
      totalWeeks: 3,
      weeklyMileageRange: "40-60",
      peakWeeklyKm: 200,
      phases: noTaperPhases,
    })
    expect(vols[1]).toBeCloseTo(44, 5)   // 40 × 1.10
    expect(vols[2]).toBeCloseTo(48.4, 5) // 44 × 1.10
  })

  it("week 4 is a recovery week at 70% of week 3", () => {
    const vols = computeWeeklyVolumes({
      totalWeeks: 5,
      weeklyMileageRange: "40-60",
      peakWeeklyKm: 200,
      phases: noTaperPhases,
    })
    const week3 = vols[2]!
    expect(vols[3]).toBeCloseTo(week3 * 0.7, 5)
  })

  it("week 8 is a recovery week at 70% of week 7", () => {
    const vols = computeWeeklyVolumes({
      totalWeeks: 9,
      weeklyMileageRange: "40-60",
      peakWeeklyKm: 200,
      phases: noTaperPhases,
    })
    expect(vols[7]).toBeCloseTo(vols[6]! * 0.7, 5)
  })

  it("result is capped at peakWeeklyKm", () => {
    const vols = computeWeeklyVolumes({
      totalWeeks: 20,
      weeklyMileageRange: "80-plus",
      peakWeeklyKm: 90,
      phases: noTaperPhases,
    })
    expect(Math.max(...vols)).toBeLessThanOrEqual(90)
  })

  it("taper week 1 = 80% of peak, week 2 = 60%, week 3 = 40%", () => {
    const peak = 100
    const vols = computeWeeklyVolumes({
      totalWeeks: 17,
      weeklyMileageRange: "40-60",
      peakWeeklyKm: peak,
      phases: withTaperPhases,
    })
    expect(vols[14]).toBe(80) // taper week 1 = index 14
    expect(vols[15]).toBe(60) // taper week 2
    expect(vols[16]).toBe(40) // taper week 3
  })

  it("taper overrides recovery week rule", () => {
    // week 16 (index 15) is both taper week 2 AND weekNumber % 4 === 0
    const vols = computeWeeklyVolumes({
      totalWeeks: 17,
      weeklyMileageRange: "40-60",
      peakWeeklyKm: 100,
      phases: withTaperPhases,
    })
    // If recovery rule applied it'd be 70% of prior week, not 60% of peak
    expect(vols[15]).toBe(60)
  })

  it("final non-taper week suppresses recovery rule when weekNumber % 4 === 0", () => {
    // 12 weeks, no taper — week 12 (index 11) is final and also % 4 === 0
    const vols = computeWeeklyVolumes({
      totalWeeks: 12,
      weeklyMileageRange: "40-60",
      peakWeeklyKm: 200,
      phases: noTaperPhases,
    })
    // week 12 should be 10% more than week 11, not 70% of it
    expect(vols[11]).toBeCloseTo(vols[10]! * 1.1, 5)
  })

  it("taper is capped at peakWeeklyKm", () => {
    // Shouldn't exceed peak even with generous peak value
    const vols = computeWeeklyVolumes({
      totalWeeks: 17,
      weeklyMileageRange: "40-60",
      peakWeeklyKm: 50, // low ceiling
      phases: withTaperPhases,
    })
    expect(Math.max(...vols)).toBeLessThanOrEqual(50)
  })
})
```

- [ ] **Step 2: Run the test — confirm all fail**

```bash
cd packages/plan-engine && pnpm test volume-progression
```

Expected: all tests fail with "Cannot find module".

- [ ] **Step 3: Implement volume-progression.ts**

```typescript
// packages/plan-engine/src/volume-progression.ts
import type { PhaseEntry } from "./types"

type WeeklyMileageRange = "under-40" | "40-60" | "60-80" | "80-plus"

export interface VolumeProgressionInput {
  totalWeeks: number
  weeklyMileageRange: WeeklyMileageRange
  peakWeeklyKm: number
  phases: PhaseEntry[]
}

const WEEK1_VOLUME_KM: Record<WeeklyMileageRange, number> = {
  "under-40": 30,
  "40-60": 40,
  "60-80": 60,
  "80-plus": 80,
}

export function computeWeeklyVolumes(input: VolumeProgressionInput): number[] {
  const { totalWeeks, weeklyMileageRange, peakWeeklyKm, phases } = input

  const taperPhase = phases.find(p => p.name === "Taper")
  const hasTaper = !!taperPhase

  const volumes: number[] = []

  for (let weekNumber = 1; weekNumber <= totalWeeks; weekNumber++) {
    const idx = weekNumber - 1
    let volume: number

    // Rule 1: taper weeks
    if (hasTaper && taperPhase && weekNumber >= taperPhase.startWeek) {
      const taperIndex = weekNumber - taperPhase.startWeek // 0-based
      const pct = taperIndex === 0 ? 0.8 : taperIndex === 1 ? 0.6 : 0.4
      volume = peakWeeklyKm * pct
    }
    // Rule 2: final non-taper week (suppresses recovery rule)
    else if (!hasTaper && weekNumber === totalWeeks) {
      volume = weekNumber === 1
        ? WEEK1_VOLUME_KM[weeklyMileageRange]
        : volumes[idx - 1]! * 1.1
    }
    // Rule 3: recovery weeks (weekNumber % 4 === 0, 1-indexed)
    else if (weekNumber % 4 === 0) {
      volume = volumes[idx - 1]! * 0.7
    }
    // Rule 4: week 1
    else if (weekNumber === 1) {
      volume = WEEK1_VOLUME_KM[weeklyMileageRange]
    }
    // Rule 5: all other weeks
    else {
      volume = volumes[idx - 1]! * 1.1
    }

    // Rule 6: cap (unconditional post-processing)
    volumes.push(Math.min(volume, peakWeeklyKm))
  }

  return volumes
}
```

- [ ] **Step 4: Run tests — all should pass**

```bash
cd packages/plan-engine && pnpm test volume-progression
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/plan-engine/src/volume-progression.ts packages/plan-engine/src/volume-progression.test.ts
git commit -m "feat: add volume-progression.ts with full TDD coverage"
```

---

## Task 6: Write workout-scheduler.ts — long run + easy runs (TDD)

**Files:**
- Create: `packages/plan-engine/src/workout-scheduler.ts`
- Create: `packages/plan-engine/src/workout-scheduler.test.ts`

Build the scheduler incrementally. This task covers the scaffold, long run assignment, and easy run distribution. Quality and strength come in Tasks 7 and 8.

**Key types and constants to establish:**

```typescript
// Day-of-week ordering used throughout the scheduler
const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const
type DayKey = (typeof DAY_ORDER)[number]
const DAY_INDEX: Record<DayKey, number> = { mon:0, tue:1, wed:2, thu:3, fri:4, sat:5, sun:6 }
```

**Adjacency definition:** Within a week's Mon–Sun window, "adjacent to X" means the day immediately before or after X in DAY_ORDER. No wrap: Sun(6) and Mon(0) of the same week are not adjacent.

**Long run distance:**
```
progressFactor = Math.min(weeklyKm / peakWeeklyKm, 1.0)
rawDistance = peakLongRunKm × progressFactor
longRunKm = Math.min(rawDistance, weeklyKm × 0.35)
// rounded to nearest 0.5
```

**Easy runs:** Remaining running days after long run. `easyTotal = weeklyKm - longRunKm - sum(placed quality km)`. Distributed evenly, each capped at `longRunKm - 1`. Remainder added to first easy day.

- [ ] **Step 1: Write failing tests for long run + easy**

```typescript
// packages/plan-engine/src/workout-scheduler.test.ts
import { describe, it, expect } from "vitest"
import { scheduleWorkouts } from "./workout-scheduler"
import type { PhaseEntry } from "./types"
import type { PaceZones } from "./pace-calculator"

const paceZones: PaceZones = {
  easy: "6:00–6:30/km",
  longRun: "5:45–6:15/km",
  mediumLong: "5:30–6:00/km",
  mp: "5:00–5:10/km",
  threshold: "4:45–4:55/km",
  vo2max: "4:30–4:40/km",
  source: "goal-time",
}

const basePhases: PhaseEntry[] = [
  { name: "Base", startWeek: 1, endWeek: 4 },
]

const baseInput = {
  startDate: "2026-06-01", // a Monday
  selectedDays: ["mon", "wed", "fri", "sat"],
  longRunDay: "sat",
  weeklyMileageRange: "40-60" as const,
  phases: basePhases,
  totalWeeks: 4,
  peakWeeklyKm: 60,
  trainingStructure: { runDaysPerWeek: 4, restDaysPerWeek: 3, maxQualitySessions: 1 },
  longRunTargets: { peakLongRunKm: 30, recoveryRunMaxKm: 13 },
  paceZones,
}

describe("scheduleWorkouts — long run", () => {
  it("assigns a long run on longRunDay every week", () => {
    const days = scheduleWorkouts(baseInput)
    const longRuns = days.filter(d => d.type === "long")
    expect(longRuns).toHaveLength(4)
    longRuns.forEach(d => expect(new Date(d.date).getDay()).toBe(6)) // Saturday
  })

  it("long run pace is paceZones.longRun", () => {
    const days = scheduleWorkouts(baseInput)
    days.filter(d => d.type === "long").forEach(d => {
      expect(d.targetPace).toBe(paceZones.longRun)
    })
  })

  it("long run distance is capped at 35% of weekly km", () => {
    // In very low-volume week, rawDistance might exceed 35% cap
    const days = scheduleWorkouts({ ...baseInput, peakWeeklyKm: 200 })
    const week1Saturday = days.find(d => d.type === "long" && d.date === "2026-06-06")
    expect(week1Saturday).toBeDefined()
    // weeklyKm for week 1 = 40 (lower bound of "40-60"), cap = 40 × 0.35 = 14
    expect(week1Saturday!.distanceKm).toBeLessThanOrEqual(14)
  })

  it("long run distance scales with progressFactor", () => {
    const days = scheduleWorkouts(baseInput)
    const longRuns = days.filter(d => d.type === "long").map(d => d.distanceKm ?? 0)
    // Distances should generally increase week-over-week (before recovery)
    expect(longRuns[1]).toBeGreaterThanOrEqual(longRuns[0]!)
  })

  it("long run distance rounded to nearest 0.5", () => {
    const days = scheduleWorkouts(baseInput)
    days.filter(d => d.type === "long").forEach(d => {
      const km = d.distanceKm ?? 0
      expect((km * 2) % 1).toBe(0)
    })
  })
})

describe("scheduleWorkouts — rest days", () => {
  it("non-selected days are rest days", () => {
    const days = scheduleWorkouts(baseInput)
    // Tuesday and Thursday are not in selectedDays
    const tuesdays = days.filter(d => new Date(d.date).getDay() === 2)
    tuesdays.forEach(d => expect(d.type).toBe("rest"))
    const thursdays = days.filter(d => new Date(d.date).getDay() === 4)
    thursdays.forEach(d => expect(d.type).toBe("rest"))
  })

  it("rest days have no distanceKm", () => {
    const days = scheduleWorkouts(baseInput)
    days.filter(d => d.type === "rest").forEach(d => {
      expect(d.distanceKm).toBeUndefined()
    })
  })
})

describe("scheduleWorkouts — easy runs", () => {
  it("remaining running days after long/quality are easy runs", () => {
    // With maxQualitySessions=1, one quality + long run leaves 2 easy days
    const days = scheduleWorkouts({ ...baseInput, phases: [{ name: "Base", startWeek: 1, endWeek: 4 }] })
    const week1 = days.filter(d => d.date >= "2026-06-01" && d.date <= "2026-06-07")
    const runDays = week1.filter(d => d.type !== "rest" && d.type !== "strength")
    expect(runDays.some(d => d.type === "easy")).toBe(true)
  })

  it("easy run distance rounded to nearest 0.5", () => {
    const days = scheduleWorkouts(baseInput)
    days.filter(d => d.type === "easy").forEach(d => {
      const km = d.distanceKm ?? 0
      expect((km * 2) % 1).toBe(0)
    })
  })

  it("easy run distance capped at longRunKm - 1", () => {
    const days = scheduleWorkouts(baseInput)
    const week1Long = days.find(d => d.type === "long" && d.date >= "2026-06-01" && d.date <= "2026-06-07")
    const week1Easy = days.filter(d => d.type === "easy" && d.date >= "2026-06-01" && d.date <= "2026-06-07")
    week1Easy.forEach(d => {
      expect(d.distanceKm ?? 0).toBeLessThanOrEqual((week1Long?.distanceKm ?? 0) - 1)
    })
  })
})

describe("scheduleWorkouts — total days", () => {
  it("returns exactly 7 × totalWeeks days (one per calendar day)", () => {
    const days = scheduleWorkouts(baseInput)
    expect(days).toHaveLength(4 * 7)
  })

  it("no duplicate dates for running days (strength can share)", () => {
    const days = scheduleWorkouts(baseInput)
    const runDays = days.filter(d => d.type !== "strength")
    const dates = runDays.map(d => d.date)
    expect(new Set(dates).size).toBe(dates.length)
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd packages/plan-engine && pnpm test workout-scheduler
```

Expected: all fail with "Cannot find module".

- [ ] **Step 3: Implement the scheduler scaffold + long run + easy runs**

```typescript
// packages/plan-engine/src/workout-scheduler.ts
import { addDays, format } from "date-fns"
import type { WorkoutDay, PhaseEntry } from "./types"
import type { PaceZones } from "./pace-calculator"
import { computeWeeklyVolumes } from "./volume-progression"

type WeeklyMileageRange = "under-40" | "40-60" | "60-80" | "80-plus"

export interface TrainingStructure {
  runDaysPerWeek: number
  restDaysPerWeek: number
  maxQualitySessions: number
}

export interface LongRunTargets {
  peakLongRunKm: number
  recoveryRunMaxKm: number
}

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
}

const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const
type DayKey = (typeof DAY_ORDER)[number]
const DAY_INDEX: Record<string, number> = {
  mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6,
}

function round05(km: number): number {
  return Math.round(km * 2) / 2
}

function isAdjacentTo(day: string, targetDay: string): boolean {
  const a = DAY_INDEX[day] ?? -1
  const b = DAY_INDEX[targetDay] ?? -1
  return Math.abs(a - b) === 1
}

function phaseForWeek(weekNumber: number, phases: PhaseEntry[]): string {
  return phases.find(p => weekNumber >= p.startWeek && weekNumber <= p.endWeek)?.name ?? "Base"
}

export function scheduleWorkouts(input: SchedulerInput): WorkoutDay[] {
  const {
    startDate, selectedDays, longRunDay, phases, totalWeeks,
    peakWeeklyKm, trainingStructure, longRunTargets, paceZones,
  } = input

  const weeklyVolumes = computeWeeklyVolumes({
    totalWeeks,
    weeklyMileageRange: input.weeklyMileageRange,
    peakWeeklyKm,
    phases,
  })

  const start = new Date(startDate + "T00:00:00Z")
  const result: WorkoutDay[] = []

  for (let week = 1; week <= totalWeeks; week++) {
    const weeklyKm = weeklyVolumes[week - 1]!
    const phase = phaseForWeek(week, phases)
    const weekStart = addDays(start, (week - 1) * 7)

    // Build date→dayKey map for this week
    const weekDays: { date: string; dayKey: string }[] = []
    for (let d = 0; d < 7; d++) {
      const date = format(addDays(weekStart, d), "yyyy-MM-dd")
      const dayKey = DAY_ORDER[d]!
      weekDays.push({ date, dayKey })
    }

    // Assigned slots: date → WorkoutDay[]
    const assigned = new Map<string, WorkoutDay[]>()

    // ── Step 1: Long run ──
    const longRunEntry = weekDays.find(d => d.dayKey === longRunDay)!
    const progressFactor = Math.min(weeklyKm / peakWeeklyKm, 1.0)
    const rawLongKm = longRunTargets.peakLongRunKm * progressFactor
    const longRunKm = round05(Math.min(rawLongKm, weeklyKm * 0.35))

    const longDay: WorkoutDay = {
      date: longRunEntry.date,
      type: "long",
      distanceKm: longRunKm,
      targetPace: paceZones.longRun,
    }
    assigned.set(longRunEntry.date, [longDay])

    // ── Step 2: Quality sessions ──
    const qualityDays = scheduleQualitySessions(
      week, phase, phases, weeklyKm, selectedDays, longRunDay,
      weekDays, assigned, trainingStructure.maxQualitySessions, paceZones,
    )
    for (const qd of qualityDays) {
      assigned.set(qd.date, [qd])
    }

    // ── Step 3: Easy runs ──
    const placedQualityKm = qualityDays.reduce((s, d) => s + (d.distanceKm ?? 0), 0)
    const easyTotal = weeklyKm - longRunKm - placedQualityKm

    const easyRunDays = weekDays
      .filter(d => selectedDays.includes(d.dayKey) && !assigned.has(d.date))
      .sort((a, b) => DAY_INDEX[a.dayKey]! - DAY_INDEX[b.dayKey]!)

    if (easyRunDays.length > 0 && easyTotal > 0) {
      const cap = longRunKm - 1
      const rawPerDay = easyTotal / easyRunDays.length
      const cappedPerDay = Math.min(rawPerDay, cap)
      const base = round05(cappedPerDay)

      // Distribute remainder to first day without double-rounding:
      // compute raw unrounded remainder so we don't overshoot easyTotal.
      const rawRemainder = Math.max(0, easyTotal - base * easyRunDays.length)

      easyRunDays.forEach((ed, i) => {
        const km = round05(base + (i === 0 ? rawRemainder : 0))
        const eDay: WorkoutDay = {
          date: ed.date,
          type: "easy",
          distanceKm: Math.max(0, km),
          targetPace: paceZones.easy,
        }
        assigned.set(ed.date, [eDay])
      })
    }

    // ── Step 4: Strength sessions ──
    const strengthDays = scheduleStrengthSessions(
      week, phase, phases, longRunDay, weekDays, assigned,
    )
    for (const sd of strengthDays) {
      const existing = assigned.get(sd.date) ?? []
      assigned.set(sd.date, [...existing, sd])
    }

    // ── Step 5: Rest days ──
    for (const { date, dayKey } of weekDays) {
      if (!selectedDays.includes(dayKey) && !assigned.has(date)) {
        assigned.set(date, [{ date, type: "rest" }])
      } else if (!assigned.has(date)) {
        assigned.set(date, [{ date, type: "rest" }])
      }
    }

    // Flatten in date order
    for (const { date } of weekDays) {
      const dayWorkouts = assigned.get(date) ?? [{ date, type: "rest" as const }]
      result.push(...dayWorkouts)
    }
  }

  return result
}

// ── Quality session placement ──────────────────────────────────────────────

function qualityCountAndTypes(
  weekNumber: number,
  phase: string,
  phases: PhaseEntry[],
  maxQualitySessions: number,
): { count: number; types: Array<"tempo" | "intervals" | "mp"> } {
  const phaseEntry = phases.find(p => p.name === phase)
  const localIndex = phaseEntry ? weekNumber - phaseEntry.startWeek : 0
  const buildEntry = phases.find(p => p.name === "Build")
  const buildLength = buildEntry ? buildEntry.endWeek - buildEntry.startWeek + 1 : 0

  let count: number
  let types: Array<"tempo" | "intervals" | "mp">

  switch (phase) {
    case "General Fitness":
      count = 0; types = []; break
    case "Base":
      count = 1
      types = localIndex % 2 === 0 ? ["intervals"] : ["tempo"]
      break
    case "Build":
      if (buildLength === 1) {
        count = 1; types = ["tempo"]
      } else if (localIndex < Math.floor(buildLength / 2)) {
        count = 1; types = ["tempo"]
      } else {
        count = 2; types = ["tempo", "mp"]
      }
      break
    case "Peak":
      count = 2; types = ["mp", "tempo"]; break
    case "Taper":
      if (phaseEntry && weekNumber === phaseEntry.startWeek) {
        count = 1; types = ["tempo"]
      } else {
        count = 0; types = []
      }
      break
    default:
      count = 1; types = ["tempo"]
  }

  count = Math.min(count, maxQualitySessions)
  return { count, types: types.slice(0, count) }
}

function qualityDistance(type: "tempo" | "intervals" | "mp", weeklyKm: number): number {
  const pct = type === "intervals" ? 0.10 : type === "tempo" ? 0.12 : 0.15
  return round05(weeklyKm * pct)
}

function scheduleQualitySessions(
  weekNumber: number,
  phase: string,
  phases: PhaseEntry[],
  weeklyKm: number,
  selectedDays: string[],
  longRunDay: string,
  weekDays: { date: string; dayKey: string }[],
  assigned: Map<string, WorkoutDay[]>,
  maxQualitySessions: number,
  paceZones: PaceZones,
): WorkoutDay[] {
  const { count, types } = qualityCountAndTypes(weekNumber, phase, phases, maxQualitySessions)
  const placed: WorkoutDay[] = []

  for (let i = 0; i < count; i++) {
    const type = types[i]!
    // Collect candidates: running days that are not the long run, not yet assigned,
    // not adjacent to the long run day, and not consecutive with an already-placed quality session.
    const filteredCandidates = weekDays.filter(({ dayKey, date }) =>
      selectedDays.includes(dayKey) &&
      dayKey !== longRunDay &&
      !assigned.has(date) &&
      !isAdjacentTo(dayKey, longRunDay) &&
      placed.every(p => {
        const pDayKey = weekDays.find(w => w.date === p.date)?.dayKey ?? ""
        return !isAdjacentTo(dayKey, pDayKey)
      })
    )

    const candidate = filteredCandidates.sort(
      (a, b) => (DAY_INDEX[a.dayKey] ?? 0) - (DAY_INDEX[b.dayKey] ?? 0)
    )[0]

    if (!candidate) continue // session dropped

    const paceMap = {
      tempo: paceZones.threshold,
      intervals: paceZones.vo2max,
      mp: paceZones.mp,
    }

    placed.push({
      date: candidate.date,
      type,
      distanceKm: qualityDistance(type, weeklyKm),
      targetPace: paceMap[type],
    })
  }

  return placed
}

// ── Strength session placement ─────────────────────────────────────────────

function strengthCount(weekNumber: number, phase: string, phases: PhaseEntry[]): number {
  const phaseEntry = phases.find(p => p.name === phase)
  const peakEntry = phases.find(p => p.name === "Peak")

  switch (phase) {
    case "General Fitness":
    case "Base":
    case "Build":
      return 2
    case "Peak": {
      if (!peakEntry) return 2
      const peakLength = peakEntry.endWeek - peakEntry.startWeek + 1
      const localIndex = weekNumber - peakEntry.startWeek
      return localIndex >= peakLength - 2 ? 1 : 2
    }
    case "Taper":
      return phaseEntry && weekNumber === phaseEntry.startWeek ? 1 : 0
    default:
      return 2
  }
}

function circularDist(a: number, b: number): number {
  const diff = Math.abs(a - b)
  return Math.min(diff, 7 - diff)
}

function scheduleStrengthSessions(
  weekNumber: number,
  phase: string,
  phases: PhaseEntry[],
  longRunDay: string,
  weekDays: { date: string; dayKey: string }[],
  assigned: Map<string, WorkoutDay[]>,
): WorkoutDay[] {
  const count = strengthCount(weekNumber, phase, phases)
  if (count === 0) return []

  const longIdx = DAY_INDEX[longRunDay] ?? 0

  // Candidates: easy run days only, not adjacent to long run
  const candidates = weekDays.filter(({ dayKey, date }) => {
    const workouts = assigned.get(date)
    return (
      workouts?.some(w => w.type === "easy") &&
      !isAdjacentTo(dayKey, longRunDay)
    )
  })

  // Sort by circular distance from long run (descending = furthest first)
  const sorted = [...candidates].sort((a, b) => {
    const da = circularDist(DAY_INDEX[a.dayKey] ?? 0, longIdx)
    const db = circularDist(DAY_INDEX[b.dayKey] ?? 0, longIdx)
    return db - da
  })

  // Select without consecutive days
  const selected: typeof sorted = []
  for (const candidate of sorted) {
    if (
      selected.every(s => !isAdjacentTo(s.dayKey, candidate.dayKey)) &&
      selected.length < count
    ) {
      selected.push(candidate)
    }
  }

  return selected.map(({ date }) => ({ date, type: "strength" as const }))
}
```

- [ ] **Step 4: Run the tests**

```bash
cd packages/plan-engine && pnpm test workout-scheduler
```

Expected: long run and easy run tests pass. Debug any failures before proceeding.

- [ ] **Step 5: Commit**

```bash
git add packages/plan-engine/src/workout-scheduler.ts packages/plan-engine/src/workout-scheduler.test.ts
git commit -m "feat: add workout-scheduler with long run, easy, quality, strength placement"
```

---

## Task 7: Extend workout-scheduler tests — quality sessions

**Files:**
- Modify: `packages/plan-engine/src/workout-scheduler.test.ts`

- [ ] **Step 1: Add quality session tests**

Append to the test file:

```typescript
describe("scheduleWorkouts — quality session phase rules", () => {
  it("General Fitness phase: no quality sessions", () => {
    const days = scheduleWorkouts({
      ...baseInput,
      phases: [{ name: "General Fitness", startWeek: 1, endWeek: 4 }],
    })
    const quality = days.filter(d => ["tempo","intervals","mp"].includes(d.type))
    expect(quality).toHaveLength(0)
  })

  it("Base phase: 1 quality/week — intervals on even local index, tempo on odd", () => {
    const days = scheduleWorkouts({
      ...baseInput,
      phases: [{ name: "Base", startWeek: 1, endWeek: 4 }],
    })
    const week1Quality = days.filter(d => d.date >= "2026-06-01" && d.date <= "2026-06-07" && ["intervals","tempo"].includes(d.type))
    const week2Quality = days.filter(d => d.date >= "2026-06-08" && d.date <= "2026-06-14" && ["intervals","tempo"].includes(d.type))
    expect(week1Quality).toHaveLength(1)
    expect(week1Quality[0]!.type).toBe("intervals") // week 1 = local index 0 = even
    expect(week2Quality[0]!.type).toBe("tempo")      // week 2 = local index 1 = odd
  })

  it("Build first half: 1 tempo/week", () => {
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
    // Build week 1 (startWeek=3, local index 0 < floor(4/2)=2) = first half = 1 tempo
    const buildW1 = days.filter(d => d.date >= "2026-06-15" && d.date <= "2026-06-21" && ["tempo","mp","intervals"].includes(d.type))
    expect(buildW1).toHaveLength(1)
    expect(buildW1[0]!.type).toBe("tempo")
  })

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
    // Build week 3 (local index 2 >= floor(4/2)=2) = second half = tempo + mp
    const buildW3 = days.filter(d => d.date >= "2026-06-29" && d.date <= "2026-07-05" && ["tempo","mp","intervals"].includes(d.type))
    expect(buildW3).toHaveLength(2)
    const types = buildW3.map(d => d.type)
    expect(types).toContain("tempo")
    expect(types).toContain("mp")
  })

  it("Peak phase: 2 sessions — mp first, then tempo", () => {
    const days = scheduleWorkouts({
      ...baseInput,
      totalWeeks: 4,
      trainingStructure: { runDaysPerWeek: 4, restDaysPerWeek: 3, maxQualitySessions: 2 },
      phases: [{ name: "Peak", startWeek: 1, endWeek: 4 }],
      peakWeeklyKm: 80,
    })
    const week1Quality = days.filter(d => d.date >= "2026-06-01" && d.date <= "2026-06-07" && ["tempo","mp","intervals"].includes(d.type))
    expect(week1Quality).toHaveLength(2)
    const types = week1Quality.map(d => d.type)
    expect(types).toContain("mp")
    expect(types).toContain("tempo")
    expect(types).not.toContain("intervals")
  })

  it("Taper: 1 tempo in first taper week, 0 thereafter", () => {
    const days = scheduleWorkouts({
      ...baseInput,
      totalWeeks: 3,
      phases: [{ name: "Taper", startWeek: 1, endWeek: 3 }],
      peakWeeklyKm: 80,
    })
    const week1Q = days.filter(d => d.date >= "2026-06-01" && d.date <= "2026-06-07" && ["tempo","mp","intervals"].includes(d.type))
    const week2Q = days.filter(d => d.date >= "2026-06-08" && d.date <= "2026-06-14" && ["tempo","mp","intervals"].includes(d.type))
    const week3Q = days.filter(d => d.date >= "2026-06-15" && d.date <= "2026-06-21" && ["tempo","mp","intervals"].includes(d.type))
    expect(week1Q).toHaveLength(1)
    expect(week1Q[0]!.type).toBe("tempo")
    expect(week2Q).toHaveLength(0)
    expect(week3Q).toHaveLength(0)
  })

  it("quality sessions never adjacent to long run day", () => {
    const days = scheduleWorkouts({
      ...baseInput,
      phases: [{ name: "Peak", startWeek: 1, endWeek: 4 }],
      trainingStructure: { runDaysPerWeek: 4, restDaysPerWeek: 3, maxQualitySessions: 2 },
      peakWeeklyKm: 80,
    })
    const quality = days.filter(d => ["tempo","mp","intervals"].includes(d.type))
    quality.forEach(q => {
      const qDayKey = DAY_ORDER[new Date(q.date).getUTCDay() === 0 ? 6 : new Date(q.date).getUTCDay() - 1]!
      expect(isAdjacentTo(qDayKey, "sat")).toBe(false)
    })
  })

  it("no two quality sessions on consecutive days", () => {
    const days = scheduleWorkouts({
      ...baseInput,
      selectedDays: ["mon", "tue", "wed", "thu", "sat"],
      phases: [{ name: "Peak", startWeek: 1, endWeek: 4 }],
      trainingStructure: { runDaysPerWeek: 5, restDaysPerWeek: 2, maxQualitySessions: 2 },
      peakWeeklyKm: 80,
    })
    const quality = days.filter(d => ["tempo","mp","intervals"].includes(d.type))
    for (let i = 0; i < quality.length - 1; i++) {
      const a = quality[i]!.date
      const b = quality[i+1]!.date
      const diff = Math.abs(new Date(a).getTime() - new Date(b).getTime()) / (24 * 3600 * 1000)
      if (diff < 2) {
        // same week — check adjacency
        expect(diff).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it("quality session dropped when no valid candidates on 2-day schedule", () => {
    // long run = sat, only other day = fri (adjacent to sat) → all quality dropped
    const days = scheduleWorkouts({
      ...baseInput,
      selectedDays: ["fri", "sat"],
      longRunDay: "sat",
      phases: [{ name: "Base", startWeek: 1, endWeek: 4 }],
    })
    const quality = days.filter(d => ["tempo","mp","intervals"].includes(d.type))
    expect(quality).toHaveLength(0)
  })

  it("quality pace: tempo=threshold, intervals=vo2max, mp=mp", () => {
    const days = scheduleWorkouts({
      ...baseInput,
      totalWeeks: 6,
      trainingStructure: { runDaysPerWeek: 4, restDaysPerWeek: 3, maxQualitySessions: 2 },
      phases: [
        { name: "Base",  startWeek: 1, endWeek: 2 },
        { name: "Build", startWeek: 3, endWeek: 4 },
        { name: "Peak",  startWeek: 5, endWeek: 6 },
      ],
      peakWeeklyKm: 80,
    })
    days.filter(d => d.type === "tempo").forEach(d => expect(d.targetPace).toBe(paceZones.threshold))
    days.filter(d => d.type === "intervals").forEach(d => expect(d.targetPace).toBe(paceZones.vo2max))
    days.filter(d => d.type === "mp").forEach(d => expect(d.targetPace).toBe(paceZones.mp))
  })
})
```

- [ ] **Step 2: Run — all quality tests should pass**

```bash
cd packages/plan-engine && pnpm test workout-scheduler
```

Fix any failures before proceeding.

- [ ] **Step 3: Commit**

```bash
git add packages/plan-engine/src/workout-scheduler.test.ts
git commit -m "test: add quality session phase rule coverage"
```

---

## Task 8: Extend workout-scheduler tests — strength sessions

**Files:**
- Modify: `packages/plan-engine/src/workout-scheduler.test.ts`

- [ ] **Step 1: Add strength tests**

Append to the test file:

```typescript
describe("scheduleWorkouts — strength sessions", () => {
  it("strength sessions appear on easy run days only", () => {
    const days = scheduleWorkouts({
      ...baseInput,
      phases: [{ name: "Base", startWeek: 1, endWeek: 4 }],
    })
    const strength = days.filter(d => d.type === "strength")
    strength.forEach(s => {
      const sameDay = days.filter(d => d.date === s.date)
      expect(sameDay.some(d => d.type === "easy")).toBe(true)
    })
  })

  it("strength sessions have no distanceKm or targetPace", () => {
    const days = scheduleWorkouts(baseInput)
    days.filter(d => d.type === "strength").forEach(s => {
      expect(s.distanceKm).toBeUndefined()
      expect(s.targetPace).toBeUndefined()
    })
  })

  it("no strength session adjacent to long run day", () => {
    const days = scheduleWorkouts(baseInput)
    days.filter(d => d.type === "strength").forEach(s => {
      const dayKey = DAY_ORDER[new Date(s.date).getUTCDay() === 0 ? 6 : new Date(s.date).getUTCDay() - 1]!
      expect(isAdjacentTo(dayKey, "sat")).toBe(false)
    })
  })

  it("no two strength sessions on consecutive days in a week", () => {
    const days = scheduleWorkouts({
      ...baseInput,
      selectedDays: ["mon", "tue", "wed", "thu", "fri", "sat"],
      trainingStructure: { runDaysPerWeek: 6, restDaysPerWeek: 1, maxQualitySessions: 1 },
      phases: [{ name: "Base", startWeek: 1, endWeek: 4 }],
      peakWeeklyKm: 80,
    })
    for (let w = 1; w <= 4; w++) {
      const weekStart = new Date("2026-06-01T00:00:00Z")
      weekStart.setUTCDate(weekStart.getUTCDate() + (w - 1) * 7)
      const weekEnd = new Date(weekStart)
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 6)
      const ws = weekStart.toISOString().slice(0, 10)
      const we = weekEnd.toISOString().slice(0, 10)
      const weekStrength = days.filter(d => d.type === "strength" && d.date >= ws && d.date <= we)
      if (weekStrength.length >= 2) {
        const dates = weekStrength.map(d => new Date(d.date).getTime()).sort()
        for (let i = 0; i < dates.length - 1; i++) {
          const diff = (dates[i+1]! - dates[i]!) / (24 * 3600 * 1000)
          expect(diff).toBeGreaterThanOrEqual(2)
        }
      }
    }
  })

  it("Base/Build: places 2 strength sessions when schedule allows", () => {
    // selectedDays: mon, wed, fri, sat (long run). Fri is adjacent to sat → ineligible.
    // Mon and Wed are both non-adjacent to sat and non-consecutive → 2 sessions should be placed.
    const days = scheduleWorkouts({
      ...baseInput,
      selectedDays: ["mon", "wed", "fri", "sat"],
      phases: [{ name: "Base", startWeek: 1, endWeek: 4 }],
      peakWeeklyKm: 60,
    })
    const week1Strength = days.filter(d => d.type === "strength" && d.date >= "2026-06-01" && d.date <= "2026-06-07")
    expect(week1Strength).toHaveLength(2)
  })

  it("Taper: 1 strength in first week, 0 afterward", () => {
    const days = scheduleWorkouts({
      ...baseInput,
      selectedDays: ["mon", "wed", "fri", "sat"],
      phases: [{ name: "Taper", startWeek: 1, endWeek: 3 }],
    })
    const w1s = days.filter(d => d.type === "strength" && d.date >= "2026-06-01" && d.date <= "2026-06-07")
    const w2s = days.filter(d => d.type === "strength" && d.date >= "2026-06-08" && d.date <= "2026-06-14")
    const w3s = days.filter(d => d.type === "strength" && d.date >= "2026-06-15" && d.date <= "2026-06-21")
    // Mon and Wed are both valid candidates (non-adjacent to Sat, non-consecutive) — exactly 1 should be placed
    expect(w1s).toHaveLength(1)
    expect(w2s).toHaveLength(0)
    expect(w3s).toHaveLength(0)
  })
})

describe("scheduleWorkouts — determinism", () => {
  it("identical inputs produce identical outputs", () => {
    const a = scheduleWorkouts(baseInput)
    const b = scheduleWorkouts(baseInput)
    expect(a).toEqual(b)
  })
})
```

- [ ] **Step 2: Run all tests**

```bash
cd packages/plan-engine && pnpm test workout-scheduler
```

Expected: all pass. If strength tests fail, debug `scheduleStrengthSessions` logic.

- [ ] **Step 3: Commit**

```bash
git add packages/plan-engine/src/workout-scheduler.test.ts
git commit -m "test: add strength session and determinism coverage to workout-scheduler"
```

---

## Task 9: Delete LLM infrastructure and strength-recommendation

**Files:**
- Delete: `packages/plan-engine/src/providers/claude.ts`
- Delete: `packages/plan-engine/src/provider.ts`
- Delete: `packages/plan-engine/src/config.ts`
- Delete: `packages/plan-engine/src/race-prompt.ts`
- Delete: `packages/plan-engine/src/race-prompt.test.ts`
- Delete: `packages/plan-engine/src/strength-recommendation.ts`
- Delete: `packages/plan-engine/src/strength-recommendation.test.ts`
- Modify: `packages/plan-engine/package.json`

- [ ] **Step 1: Delete LLM files**

```bash
rm packages/plan-engine/src/providers/claude.ts
rm packages/plan-engine/src/provider.ts
rm packages/plan-engine/src/config.ts
rm packages/plan-engine/src/race-prompt.ts
rm packages/plan-engine/src/race-prompt.test.ts
rm packages/plan-engine/src/strength-recommendation.ts
rm packages/plan-engine/src/strength-recommendation.test.ts
rmdir packages/plan-engine/src/providers 2>/dev/null || true
```

- [ ] **Step 2: Remove @anthropic-ai/sdk from package.json**

In `packages/plan-engine/package.json`, remove the `"@anthropic-ai/sdk"` entry from `dependencies`.

- [ ] **Step 3: Add date-fns if not already present**

`workout-scheduler.ts` uses `addDays` and `format` from `date-fns`. Check if it's already a dependency:

```bash
grep 'date-fns' packages/plan-engine/package.json
```

If not present, add it. Check if it's available via the app's dependencies — if so, add it to `packages/plan-engine/package.json` as well:

```bash
grep 'date-fns' apps/web/package.json
```

Add to `packages/plan-engine/package.json` dependencies: `"date-fns": "^3.0.0"` (match the version in apps/web).

- [ ] **Step 4: Reinstall**

```bash
pnpm install
```

- [ ] **Step 5: Run tests**

```bash
cd packages/plan-engine && pnpm test
```

Expected: race-prompt and strength-recommendation tests are gone; all remaining tests pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: delete LLM infrastructure and strength-recommendation"
```

---

## Task 10: Update index.ts exports

**Files:**
- Modify: `packages/plan-engine/src/index.ts`

Remove all LLM-related exports. Add scheduler and volume-progression exports.

- [ ] **Step 1: Rewrite index.ts**

```typescript
// packages/plan-engine/src/index.ts
export {
  type WorkoutDay,
  type WorkoutType,
  type TrainingPlan,
  type PlanGenerationInput,
  type PhaseEntry,
} from "./types"
export { buildBridgeRuns, firstMondayOnOrAfter } from "./bridge-runs"
export * from "./adaptation"
export {
  calculatePaceZones,
  computePhases,
  computeGoalPeakMileage,
  computeTrainingStructure,
  computeLongRunTargets,
  calculateRawGoalPace,
  type PaceZones,
} from "./pace-calculator"
export { computeWeeklyVolumes, type VolumeProgressionInput } from "./volume-progression"
export { scheduleWorkouts, type SchedulerInput, type TrainingStructure, type LongRunTargets } from "./workout-scheduler"
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck 2>&1 | head -30
```

Fix any remaining import errors — look for references to deleted exports (`getProvider`, `AIProvider`, `recommendStrengthCount`, `recommendStrengthDays`, `peakStrengthDay`, `TrainingPlanMeta`).

- [ ] **Step 3: Run all tests**

```bash
cd packages/plan-engine && pnpm test
```

- [ ] **Step 4: Commit**

```bash
git add packages/plan-engine/src/index.ts
git commit -m "refactor: update plan-engine index.ts to remove LLM exports and add scheduler"
```

---

## Task 11: Update the API route

**Files:**
- Modify: `apps/web/app/api/generate-plan/route.ts`
- Modify: `turbo.json`

Replace streaming NDJSON with synchronous JSON. Remove Upstash rate limiting. Add precondition validation. Call the scheduler.

- [ ] **Step 1: Rewrite route.ts**

```typescript
// apps/web/app/api/generate-plan/route.ts
import { type NextRequest } from "next/server"
import {
  type PlanGenerationInput,
  calculatePaceZones,
  computePhases,
  computeGoalPeakMileage,
  computeTrainingStructure,
  computeLongRunTargets,
  computeWeeklyVolumes,
  scheduleWorkouts,
  firstMondayOnOrAfter,
} from "@workspace/plan-engine"

const MILEAGE_RANGE_HIGH: Record<string, number> = {
  "under-40": 40,
  "40-60": 60,
  "60-80": 80,
  "80-plus": 120,
}

function weeksBetween(start: Date, end: Date): number {
  return Math.floor((end.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000))
}

export async function POST(req: NextRequest) {
  let input: PlanGenerationInput
  try {
    input = (await req.json()) as PlanGenerationInput
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  // Precondition validation
  if (!input.goal || !input.selectedDays?.length || !input.longRunDay) {
    return Response.json({ error: "Missing required fields" }, { status: 400 })
  }
  if (input.goal !== "race") {
    return Response.json({ error: "Invalid goal value" }, { status: 400 })
  }
  if (input.selectedDays.length < 2) {
    return Response.json({ error: "At least 2 running days required" }, { status: 400 })
  }
  if (!input.selectedDays.includes(input.longRunDay)) {
    return Response.json({ error: "longRunDay must be in selectedDays" }, { status: 400 })
  }

  // Derive plan parameters
  const raceDate = new Date(input.race.date + "T00:00:00Z")
  const startDate = input.startDate
    ? new Date(input.startDate + "T00:00:00Z")
    : firstMondayOnOrAfter(new Date())
  const totalWeeks = Math.max(1, weeksBetween(startDate, raceDate))

  const goalMinutes = input.goalTime
    ? input.goalTime.hours * 60 + input.goalTime.minutes + (input.goalTime.seconds ?? 0) / 60
    : null

  const peakMileage = goalMinutes
    ? computeGoalPeakMileage(input.race.distance, goalMinutes)
    : null
  const peakWeeklyKm = peakMileage?.high ?? MILEAGE_RANGE_HIGH[input.weeklyMileageRange] ?? 60

  const lowerBound = {
    "under-40": 30, "40-60": 40, "60-80": 60, "80-plus": 80,
  }[input.weeklyMileageRange] ?? 40

  if (lowerBound > peakWeeklyKm) {
    return Response.json({ error: "Starting volume exceeds peak weekly km" }, { status: 400 })
  }

  const phases = computePhases(totalWeeks, input.race.distance)
  // Compute pace zones from goal time; if no goal time, derive from peakWeeklyKm
  // using a rough 5% estimate so users without a goal time still get a valid plan.
  let paceZones = input.goalTime
    ? calculatePaceZones(
        { ...input.goalTime, seconds: input.goalTime.seconds ?? 0, distance: input.race.distance, context: "active" },
        "goal-time",
      )
    : null

  if (!paceZones) {
    // Fallback: estimate a goal time from peakWeeklyKm using a rough km/week → marathon time heuristic.
    // 60 km/week ≈ 4:00 marathon (240 min), scaling linearly.
    const estimatedMinutes = Math.round(240 * (60 / peakWeeklyKm))
    const hours = Math.floor(estimatedMinutes / 60)
    const minutes = estimatedMinutes % 60
    paceZones = calculatePaceZones(
      { hours, minutes, seconds: 0, distance: "full", context: "active" },
      "goal-time",
    )
  }

  if (!paceZones) {
    return Response.json({ error: "Could not compute pace zones" }, { status: 400 })
  }

  const trainingStructure = computeTrainingStructure(
    goalMinutes,
    input.race.distance,
    input.selectedDays.length,
    input.weeklyMileageRange,
  )

  const longRunTargets = computeLongRunTargets(input.race.distance, peakMileage)

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
  })

  const totalKm = Math.round(days.reduce((s, d) => s + (d.distanceKm ?? 0), 0))

  // peakWeekKm = max of the weeklyVolumes array.
  // Do NOT slice days[] by 7: strength sessions add extra entries per date,
  // making chunk boundaries unreliable. Re-derive from the volume array instead.
  const weeklyVolumes = computeWeeklyVolumes({
    totalWeeks,
    weeklyMileageRange: input.weeklyMileageRange,
    peakWeeklyKm,
    phases,
  })
  const peakWeekKm = Math.round(Math.max(...weeklyVolumes))

  return Response.json({ days, totalWeeks, totalKm, peakWeekKm, phases })
}
```

- [ ] **Step 2: Remove dead env vars from turbo.json**

In `turbo.json`, remove from the `env` array: `"ANTHROPIC_API_KEY"`, `"AI_PROVIDER"`, `"AI_MODEL"`, `"UPSTASH_REDIS_REST_URL"`, `"UPSTASH_REDIS_REST_TOKEN"`.

- [ ] **Step 3: Remove Upstash rate-limit lib usage**

Check if `apps/web/lib/rate-limit.ts` exists and is now unused:

```bash
grep -r 'rate-limit\|getRatelimit\|upstash' apps/web --include='*.ts' --include='*.tsx' -l
```

If `lib/rate-limit.ts` is no longer imported anywhere, delete it.

- [ ] **Step 4: Typecheck**

```bash
pnpm typecheck 2>&1 | grep 'generate-plan'
```

Expected: no errors on the route file.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/api/generate-plan/route.ts turbo.json
git commit -m "feat: replace streaming LLM route with synchronous scheduler endpoint"
```

---

## Task 12: Update plan/page.tsx

**Files:**
- Modify: `apps/web/app/plan/page.tsx`

Replace streaming with `fetch().json()`, remove `mergeStrengthDays`, add staggered reveal animation.

Key changes:
- Remove `ReadableStream` parsing loop, `_meta` handling, `generatingWeek` state, stream accumulation
- Add `isNewlyGenerated` state (in-memory only, not persisted)
- Add `AbortController` — abort prior request before starting new one
- Add CSS `@keyframes fade-in` animation with `animationDelay: weekIndex * 30ms` per week row

- [ ] **Step 1: Remove mergeStrengthDays function and all references**

Delete the `mergeStrengthDays` function definition (lines 23–61 in the current file).

Remove all calls to `mergeStrengthDays`.

In the import from `@workspace/plan-engine`, remove `peakStrengthDay` (deleted with `race-prompt.ts`). Keep `firstMondayOnOrAfter` — it is still needed by `buildBridgeRuns` in the generate effect. The updated import line should look like:

```typescript
import { buildBridgeRuns, firstMondayOnOrAfter } from "@workspace/plan-engine"
```

Remove `strengthDays`-related logic from `mapToInput`.

- [ ] **Step 2: Replace the streaming useEffect with a synchronous fetch**

Replace the entire `async function stream()` block and everything inside the streaming `useEffect` with:

```typescript
useEffect(() => {
  const raw = sessionStorage.getItem(SESSION_KEY)
  if (!raw) {
    const planRaw = localStorage.getItem(PLAN_KEY)
    if (planRaw) {
      try {
        const snap = JSON.parse(planRaw) as SavedPlanSnapshot
        const TEN_MINUTES = 10 * 60 * 1000
        if (snap.savedAt && Date.now() - snap.savedAt <= TEN_MINUTES) {
          streamStartedRef.current = true
          setInput(snap.input)
          return
        }
      } catch {}
      localStorage.removeItem(PLAN_KEY)
    }
    router.replace("/")
    return
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>
  } catch {
    router.replace("/")
    return
  }

  const mapped = mapToInput(parsed)
  if (!mapped) { router.replace("/"); return }
  setInput(mapped)

  if (streamStartedRef.current) return

  if (localStorage.getItem(PLAN_KEY)) {
    if (sessionPending) return
    if (sessionData?.session) return
    localStorage.removeItem(PLAN_KEY)
  }

  streamStartedRef.current = true

  const controller = new AbortController()
  abortRef.current?.abort()
  abortRef.current = controller

  setIsNewlyGenerated(true)

  async function generate() {
    let response: Response
    try {
      response = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mapped),
        signal: controller.signal,
      })
    } catch {
      if (!controller.signal.aborted) setStatus("error")
      return
    }

    if (!response.ok) {
      setStatus("error")
      return
    }

    let result: { days: WorkoutDay[]; totalWeeks: number; totalKm: number; peakWeekKm: number; phases: PhaseEntry[] }
    try {
      result = await response.json()
    } catch {
      setStatus("error")
      return
    }

    const bridgeDays = buildBridgeRuns(mapped!, result.days, new Date())
    const finalDays = bridgeDays.length > 0
      ? [...bridgeDays, ...result.days].sort((a, b) => a.date.localeCompare(b.date))
      : result.days

    totalWeeksRef.current = result.totalWeeks
    setPhases(result.phases ?? [])
    setPlan({
      days: finalDays,
      totalWeeks: result.totalWeeks,
      totalKm: result.totalKm,
      peakWeekKm: result.peakWeekKm,
      phases: result.phases,
    })
    setStatus("complete")
  }

  void generate()
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [sessionPending])
```

- [ ] **Step 3: Add abortRef and isNewlyGenerated state**

Add near the other refs/state:
```typescript
const abortRef = useRef<AbortController | null>(null)
const [isNewlyGenerated, setIsNewlyGenerated] = useState(false)
```

After `savePlanToServer` completes (success or failure), set `isNewlyGenerated(false)`.

- [ ] **Step 4: Remove generatingWeek state and all references**

Delete `const [generatingWeek, setGeneratingWeek] = useState(1)` and all usages. Update `PlanHeader` call to remove `generatingWeek` prop. Remove it from `PlanHeader`'s props if it's only used for a "Generating week #N" label.

- [ ] **Step 5: Add staggered animation styles**

In `plan-calendar.tsx` or `plan-feed.tsx` (wherever week rows are rendered), pass `isNewlyGenerated` down as a prop and apply:

```tsx
style={isNewlyGenerated ? {
  animationDelay: `${weekIndex * 30}ms`,
  animationFillMode: "both",
} : undefined}
className={cn(existingClass, isNewlyGenerated && "animate-fade-in")}
```

Add the `@keyframes fade-in` to `globals.css`:
```css
@keyframes fade-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0);   }
}
```

And in `@theme inline`:
```css
--animate-fade-in: fade-in 0.3s ease-out;
```

- [ ] **Step 6: Typecheck the plan page**

```bash
pnpm typecheck 2>&1 | grep 'plan/page'
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/plan/page.tsx packages/ui/src/styles/globals.css
git commit -m "feat: replace streaming generation with synchronous fetch + staggered reveal animation"
```

---

## Task 13: Remove strength from onboarding

**Files:**
- Modify: `apps/web/components/onboarding/types.ts`
- Modify: `apps/web/components/onboarding/onboarding-flow.tsx`
- Modify: `apps/web/components/onboarding/final-screen.tsx`
- Delete: `apps/web/components/onboarding/steps/step-strength.tsx`

- [ ] **Step 1: Remove strength fields from onboarding types.ts**

In `OnboardingData`, remove `strengthTraining?: boolean` and `strengthDays?: Day[]`.

In `getSteps()`, remove `"strength"` from the array.

Remove `"strength"` from `STEP_LABELS` in `onboarding-flow.tsx`.

- [ ] **Step 2: Remove StepStrength from onboarding-flow.tsx**

Remove the `import { StepStrength } from "./steps/step-strength"` line.

Remove the `case "strength": return <StepStrength {...stepProps} />` case.

- [ ] **Step 3: Remove strength display from final-screen.tsx**

Look for any UI that shows strength days (the `Dumbbell` row) in `FinalScreen`. Remove it.

Remove unused imports (`Dumbbell` icon, strength-related variables from `formData` destructuring).

- [ ] **Step 4: Delete step-strength.tsx**

```bash
rm apps/web/components/onboarding/steps/step-strength.tsx
```

- [ ] **Step 5: Typecheck onboarding**

```bash
pnpm typecheck 2>&1 | grep 'onboarding'
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: remove strength training configuration from onboarding (scheduler assigns automatically)"
```

---

## Task 13b: Integration test for the API route

**Files:**
- Create: `apps/web/app/api/generate-plan/route.test.ts`

The spec explicitly requires an integration test for the full `POST /api/generate-plan` round-trip.

- [ ] **Step 1: Write the integration test**

```typescript
// apps/web/app/api/generate-plan/route.test.ts
import { describe, it, expect } from "vitest"
import { POST } from "./route"
import { NextRequest } from "next/server"

function makeRequest(body: object): NextRequest {
  return new NextRequest("http://localhost/api/generate-plan", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

const validInput = {
  goal: "race",
  race: { name: "Test Marathon", date: "2027-04-01", distance: "full", city: "Test City" },
  goalTime: { hours: 3, minutes: 30, seconds: 0 },
  selectedDays: ["mon", "wed", "fri", "sat"],
  longRunDay: "sat",
  units: "km",
  weeklyMileageRange: "40-60",
}

describe("POST /api/generate-plan", () => {
  it("returns valid plan shape for a full marathon", async () => {
    const res = await POST(makeRequest(validInput))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.days).toBeInstanceOf(Array)
    expect(body.days.length).toBeGreaterThan(0)
    expect(typeof body.totalWeeks).toBe("number")
    expect(typeof body.totalKm).toBe("number")
    expect(typeof body.peakWeekKm).toBe("number")
    expect(body.phases).toBeInstanceOf(Array)
  })

  it("days contain only valid WorkoutTypes", () => {
    // synchronous helper — re-run for assertion
    const VALID_TYPES = new Set(["easy","long","medium-long","mp","tempo","intervals","rest","race","strength"])
    return POST(makeRequest(validInput)).then(async (res) => {
      const body = await res.json()
      body.days.forEach((d: { type: string }) => {
        expect(VALID_TYPES.has(d.type)).toBe(true)
      })
    })
  })

  it("no WorkoutDay has a description field", async () => {
    const res = await POST(makeRequest(validInput))
    const body = await res.json()
    body.days.forEach((d: Record<string, unknown>) => {
      expect(d["description"]).toBeUndefined()
    })
  })

  it("returns 400 when selectedDays has fewer than 2 entries", async () => {
    const res = await POST(makeRequest({ ...validInput, selectedDays: ["sat"], longRunDay: "sat" }))
    expect(res.status).toBe(400)
  })

  it("returns 400 when longRunDay is not in selectedDays", async () => {
    const res = await POST(makeRequest({ ...validInput, longRunDay: "sun" }))
    expect(res.status).toBe(400)
  })

  it("returns 400 when weeklyMileageRange lower bound exceeds peakWeeklyKm", async () => {
    // "80-plus" lower bound = 80; pair with a goal time that implies a low peak volume
    // We can't directly control peakWeeklyKm via the API, so instead override weeklyMileageRange
    // to something that would make the lower bound (80) exceed a low-volume target.
    // Use "80-plus" with a very slow goal time (implies low peakWeeklyKm < 80).
    const res = await POST(makeRequest({
      ...validInput,
      weeklyMileageRange: "80-plus",
      goalTime: { hours: 6, minutes: 0, seconds: 0 }, // very slow → peakWeeklyKm ~45
    }))
    expect(res.status).toBe(400)
  })

  it("deterministic: identical inputs return identical days", async () => {
    const [a, b] = await Promise.all([
      POST(makeRequest(validInput)).then(r => r.json()),
      POST(makeRequest(validInput)).then(r => r.json()),
    ])
    expect(a.days).toEqual(b.days)
  })

  it("long run always falls on longRunDay (saturday)", async () => {
    const res = await POST(makeRequest(validInput))
    const body = await res.json()
    const longRuns = body.days.filter((d: { type: string }) => d.type === "long")
    longRuns.forEach((d: { date: string }) => {
      // Saturday = day 6 in UTC
      expect(new Date(d.date + "T00:00:00Z").getUTCDay()).toBe(6)
    })
  })
})
```

- [ ] **Step 2: Run the integration test**

```bash
cd apps/web && pnpm vitest run app/api/generate-plan/route.test.ts
```

If vitest isn't configured for apps/web, add a `vitest.config.ts` following the pattern in `packages/plan-engine`. Otherwise run via `pnpm --filter @workspace/web test` if test script is configured.

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api/generate-plan/route.test.ts
git commit -m "test: add integration tests for POST /api/generate-plan"
```

---

## Task 14: Final cleanup and verification

**Files:**
- Various

- [ ] **Step 1: Full typecheck**

```bash
pnpm typecheck
```

Expected: 0 errors. Fix any remaining issues.

- [ ] **Step 2: Run all tests**

```bash
pnpm --filter @workspace/plan-engine test
```

Expected: all pass.

- [ ] **Step 3: Lint**

```bash
pnpm lint
```

Fix any lint errors.

- [ ] **Step 4: Build**

```bash
pnpm build
```

Expected: successful build. If any `description` property references remain in component code, this will surface them.

- [ ] **Step 5: Smoke test locally**

```bash
pnpm dev
```

Navigate to `/new-plan`, complete onboarding (no strength step should appear), navigate to `/plan`. Confirm:
- Plan loads in <1 second (no streaming)
- Week rows animate in with stagger on first load
- Plan data looks correct (has rest days, easy runs, quality sessions, strength entries on easy days)
- Saving works

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: final typecheck, lint, and build verification"
```
