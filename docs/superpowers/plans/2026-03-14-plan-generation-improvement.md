# Plan Generation Improvement — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve training plan quality by adding fitness context to onboarding, computing personalized pace zones server-side via the Riegel formula, expanding workout types, and rewriting the LLM prompt with a structured phase-based coaching framework.

**Architecture:** Pure TypeScript pace calculator and phase scheduler run server-side before LLM call. The LLM receives complete, deterministic context (pace zones, phase schedule, starting volume) and is forbidden from doing math or deciding structure. New onboarding steps collect weekly mileage and optional recent race result with fitness context.

**Tech Stack:** Next.js 16, TypeScript, Vitest (new), `@workspace/ai` package, Claude API streaming NDJSON.

**Spec:** `docs/superpowers/specs/2026-03-14-plan-generation-improvement-design.md`

---

## Chunk 1: Foundation — Types, pace calculator, phase scheduler

### Task 1: Add Vitest to packages/ai

**Files:**
- Modify: `packages/ai/package.json`
- Create: `packages/ai/vitest.config.ts`

- [ ] **Step 1: Add vitest to devDependencies**

In `packages/ai/package.json`, add to `devDependencies` and add a `test` script:

```json
{
  "name": "@workspace/ai",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "vitest run"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.39.0"
  },
  "devDependencies": {
    "@workspace/typescript-config": "workspace:*",
    "typescript": "^5.9.3",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create vitest config**

`packages/ai/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
})
```

- [ ] **Step 3: Install**

```bash
cd /path/to/repo && pnpm install
```

Expected: vitest installed, no errors.

- [ ] **Step 4: Verify test runner works**

```bash
cd packages/ai && pnpm test
```

Expected: "No test files found" or passes 0 tests — not an error.

- [ ] **Step 5: Commit**

```bash
git add packages/ai/package.json packages/ai/vitest.config.ts pnpm-lock.yaml
git commit -m "chore: add vitest to packages/ai"
```

---

### Task 2: Update types in packages/ai

**Files:**
- Modify: `packages/ai/src/types.ts`

Current `WorkoutType` is `"easy" | "long" | "tempo" | "intervals" | "rest" | "race" | "strength"`. We add `"medium-long"` and `"mp"`. We also add `PhaseEntry`, extend `TrainingPlan` with `phases?`, extend `TrainingPlanMeta` with `phases`, and add new fields to `PlanGenerationInput`.

- [ ] **Step 1: Replace the entire file**

`packages/ai/src/types.ts`:
```ts
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
  date: string         // ISO "2026-06-16"
  type: WorkoutType
  distanceKm?: number  // always km; omitted for rest days only
  description: string
  completed?: boolean
  targetHR?: string    // free text, e.g. "Zone 2 (130–145 bpm)"
  targetPace?: string  // free text, e.g. "5:30–6:00/km"
  effort?: "hard" | "good" | "easy"
}

export interface PhaseEntry {
  name: string
  startWeek: number
  endWeek: number
}

export interface TrainingPlanMeta {
  _meta: true
  totalWeeks: number
  totalKm: number
  peakWeekKm: number
  phases?: PhaseEntry[]  // optional for backward compatibility with older prompts
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
    date: string  // ISO string
    distance: "5k" | "10k" | "half" | "full" | "ultra"
    city: string
  }
  goalTime?: { hours: number; minutes: number }
  selectedDays: string[]
  longRunDay: string
  units: "km" | "miles"
  strengthTraining: boolean
  strengthDays?: string[]
  startDate?: string  // ISO "YYYY-MM-DD" — first day of training
  weeklyMileageRange: "under-40" | "40-60" | "60-80" | "80-plus"
  recentRace?: {
    distance: "5k" | "10k" | "half" | "full"
    hours: number
    minutes: number
    seconds: number
    context: "active" | "short-break" | "long-break"
  }
}
```

- [ ] **Step 2: Type-check**

```bash
cd /path/to/repo && pnpm typecheck
```

Expected: TypeScript errors in `workout-utils.ts` (WORKOUT_NAMES and WORKOUT_TEXT_CLASS are missing `medium-long` and `mp` keys). This is expected — we'll fix them in Task 10. All other packages should be clean.

- [ ] **Step 3: Commit**

```bash
git add packages/ai/src/types.ts
git commit -m "feat: add medium-long/mp WorkoutType, PhaseEntry, new PlanGenerationInput fields"
```

---

### Task 3: Implement pace calculator (TDD)

**Files:**
- Create: `packages/ai/src/pace-calculator.test.ts`
- Create: `packages/ai/src/pace-calculator.ts`

The pace calculator is a pure function: takes a race result (or goal time) and returns six pace zone strings. The phase scheduler is a pure function: takes total weeks and race distance and returns phase boundaries.

#### Step 1 — Write tests first

- [ ] **Step 1: Create `packages/ai/src/pace-calculator.test.ts`**

```ts
import { describe, it, expect } from "vitest"
import { calculatePaceZones, computePhases } from "./pace-calculator"

// ─── calculatePaceZones ────────────────────────────────────────────────────

describe("calculatePaceZones — recent race, active", () => {
  // 10K in 47:30 → T_5k = 2850 × (5/10)^1.06 ≈ 1367s → ref = 273.4 s/km
  const zones = calculatePaceZones(
    { hours: 0, minutes: 47, seconds: 30, distance: "10k", context: "active" },
    "recent-race"
  )

  it("returns non-null for valid input", () => {
    expect(zones).not.toBeNull()
  })

  it("sets source to recent-race", () => {
    expect(zones!.source).toBe("recent-race")
  })

  it("vo2max zone: 4:28–4:39/km", () => {
    expect(zones!.vo2max).toBe("4:28–4:39/km")
  })

  it("threshold zone: 4:50–5:01/km", () => {
    expect(zones!.threshold).toBe("4:50–5:01/km")
  })

  it("mp zone: 5:09–5:28/km", () => {
    expect(zones!.mp).toBe("5:09–5:28/km")
  })

  it("mediumLong zone: 5:28–5:42/km", () => {
    expect(zones!.mediumLong).toBe("5:28–5:42/km")
  })

  it("longRun zone: 5:42–6:04/km", () => {
    expect(zones!.longRun).toBe("5:42–6:04/km")
  })

  it("easy zone: 6:06–6:36/km", () => {
    expect(zones!.easy).toBe("6:06–6:36/km")
  })
})

describe("calculatePaceZones — context multipliers", () => {
  it("short-break applies ×1.05 to all zones", () => {
    // ref = 273.4 × 1.05 = 287.1 s/km
    // vo2max fast = 287.1 × 0.98 = 281.4 → 281s → 4:41
    const zones = calculatePaceZones(
      { hours: 0, minutes: 47, seconds: 30, distance: "10k", context: "short-break" },
      "recent-race"
    )!
    expect(zones.vo2max).toBe("4:41–4:53/km")
  })

  it("long-break applies ×1.12 to all zones", () => {
    // ref = 273.4 × 1.12 = 306.2 s/km
    // easy slow = 306.2 × 1.45 = 444.0 → 444s → 7:24
    const zones = calculatePaceZones(
      { hours: 0, minutes: 47, seconds: 30, distance: "10k", context: "long-break" },
      "recent-race"
    )!
    expect(zones.easy).toMatch(/–7:24\/km$/)
  })

  it("defaults to active when context is undefined", () => {
    const withContext = calculatePaceZones(
      { hours: 0, minutes: 47, seconds: 30, distance: "10k", context: "active" },
      "recent-race"
    )
    const withoutContext = calculatePaceZones(
      { hours: 0, minutes: 47, seconds: 30, distance: "10k" },
      "recent-race"
    )
    expect(withContext!.vo2max).toBe(withoutContext!.vo2max)
  })
})

describe("calculatePaceZones — goal time", () => {
  it("applies 5% buffer and sets source to goal-time", () => {
    // 3:30:00 marathon → T with 5% buffer = 13230s
    // T_5k = 13230 × (5/42.195)^1.06 ≈ 1379.4s → ref ≈ 275.88 s/km (Node.js verified)
    // vo2max fast = Math.round(275.88 × 0.98) = Math.round(270.36) = 270 → 4:30
    // vo2max slow = Math.round(275.88 × 1.02) = Math.round(281.40) = 281 → 4:41
    const zones = calculatePaceZones(
      { hours: 3, minutes: 30, seconds: 0, distance: "full" },
      "goal-time"
    )!
    expect(zones.source).toBe("goal-time")
    expect(zones.vo2max).toBe("4:30–4:41/km")
  })

  it("does not apply context multiplier for goal-time source", () => {
    // context field ignored when source is goal-time
    const with_ctx = calculatePaceZones(
      { hours: 3, minutes: 30, seconds: 0, distance: "full", context: "long-break" },
      "goal-time"
    )!
    const without_ctx = calculatePaceZones(
      { hours: 3, minutes: 30, seconds: 0, distance: "full" },
      "goal-time"
    )!
    expect(with_ctx.vo2max).toBe(without_ctx.vo2max)
  })
})

describe("calculatePaceZones — invalid input", () => {
  it("returns null for zero time", () => {
    const result = calculatePaceZones(
      { hours: 0, minutes: 0, seconds: 0, distance: "10k" },
      "recent-race"
    )
    expect(result).toBeNull()
  })

  it("returns null for impossibly fast pace (< 2:00/km)", () => {
    // 10K in 0:10:00 = 1:00/km — physically impossible
    const result = calculatePaceZones(
      { hours: 0, minutes: 10, seconds: 0, distance: "10k" },
      "recent-race"
    )
    expect(result).toBeNull()
  })
})

// ─── computePhases ────────────────────────────────────────────────────────

describe("computePhases — 28 week full marathon (5-phase)", () => {
  const phases = computePhases(28, "full")

  it("produces 5 phases", () => {
    expect(phases).toHaveLength(5)
  })

  it("phase names are correct", () => {
    expect(phases.map(p => p.name)).toEqual([
      "General Fitness", "Base", "Build", "Peak", "Taper"
    ])
  })

  it("weeks are contiguous and sum to 28", () => {
    expect(phases[0]!.startWeek).toBe(1)
    expect(phases[4]!.endWeek).toBe(28)
    for (let i = 1; i < phases.length; i++) {
      expect(phases[i]!.startWeek).toBe(phases[i - 1]!.endWeek + 1)
    }
  })

  it("matches spec example: GF=6, Base=8, Build=7, Peak=3, Taper=4", () => {
    expect(phases[0]).toEqual({ name: "General Fitness", startWeek: 1, endWeek: 6 })
    expect(phases[1]).toEqual({ name: "Base", startWeek: 7, endWeek: 14 })
    expect(phases[2]).toEqual({ name: "Build", startWeek: 15, endWeek: 21 })
    expect(phases[3]).toEqual({ name: "Peak", startWeek: 22, endWeek: 24 })
    expect(phases[4]).toEqual({ name: "Taper", startWeek: 25, endWeek: 28 })
  })
})

describe("computePhases — 16 week half marathon (4-phase)", () => {
  const phases = computePhases(16, "half")

  it("produces 4 phases (Base, Build, Peak, Taper)", () => {
    expect(phases.map(p => p.name)).toEqual(["Base", "Build", "Peak", "Taper"])
  })

  it("weeks sum to 16", () => {
    expect(phases[0]!.startWeek).toBe(1)
    expect(phases[phases.length - 1]!.endWeek).toBe(16)
    for (let i = 1; i < phases.length; i++) {
      expect(phases[i]!.startWeek).toBe(phases[i - 1]!.endWeek + 1)
    }
  })

  it("taper is at least 3 weeks for half", () => {
    const taper = phases.find(p => p.name === "Taper")!
    expect(taper.endWeek - taper.startWeek + 1).toBeGreaterThanOrEqual(3)
  })
})

describe("computePhases — 4 week 5K (very short)", () => {
  const phases = computePhases(4, "5k")

  it("weeks sum to 4", () => {
    const total = phases.reduce((s, p) => s + p.endWeek - p.startWeek + 1, 0)
    expect(total).toBe(4)
  })

  it("taper is at least 2 weeks for 5K", () => {
    const taper = phases.find(p => p.name === "Taper")!
    expect(taper.endWeek - taper.startWeek + 1).toBeGreaterThanOrEqual(2)
  })

  it("starts at week 1", () => {
    expect(phases[0]!.startWeek).toBe(1)
  })
})

describe("computePhases — exactly 21 weeks triggers 5-phase", () => {
  const phases = computePhases(21, "full")

  it("produces 5 phases", () => {
    expect(phases.some(p => p.name === "General Fitness")).toBe(true)
  })

  it("weeks sum to 21", () => {
    const total = phases.reduce((s, p) => s + p.endWeek - p.startWeek + 1, 0)
    expect(total).toBe(21)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd packages/ai && pnpm test
```

Expected: FAIL — `Cannot find module './pace-calculator'`

- [ ] **Step 3: Create `packages/ai/src/pace-calculator.ts`**

```ts
import type { PhaseEntry } from "./types"

export interface PaceInput {
  hours: number
  minutes: number
  seconds: number
  distance: "5k" | "10k" | "half" | "full"
  context?: "active" | "short-break" | "long-break"
}

export interface PaceZones {
  easy: string       // e.g. "6:06–6:36/km"
  longRun: string
  mediumLong: string
  mp: string
  threshold: string
  vo2max: string
  source: "recent-race" | "goal-time"
}

const DISTANCE_KM: Record<string, number> = {
  "5k": 5,
  "10k": 10,
  half: 21.0975,
  full: 42.195,
}

const CONTEXT_MULTIPLIER: Record<string, number> = {
  active: 1.0,
  "short-break": 1.05,
  "long-break": 1.12,
}

// Zone [lowerMultiplier, upperMultiplier] of 5K pace.
// Lower multiplier = faster pace (fewer seconds/km) = listed first in the range.
const ZONES = {
  vo2max:     [0.98, 1.02],
  threshold:  [1.06, 1.10],
  mp:         [1.13, 1.20],
  mediumLong: [1.20, 1.25],
  longRun:    [1.25, 1.33],
  easy:       [1.34, 1.45],
} as const

/** Format total seconds as "M:SS" */
function formatPace(secPerKm: number): string {
  const total = Math.round(secPerKm)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

/** Format a zone as "fastPace–slowPace/km" */
function formatZone(lo: number, hi: number, refSecPerKm: number): string {
  return `${formatPace(refSecPerKm * lo)}–${formatPace(refSecPerKm * hi)}/km`
}

/**
 * Calculate pace zones from a race result or goal time.
 *
 * Returns null if input is invalid (zero time or impossibly fast pace).
 * Caller should fall back to goal time with 5% buffer when null is returned.
 */
export function calculatePaceZones(
  input: PaceInput,
  source: "recent-race" | "goal-time"
): PaceZones | null {
  const distKm = DISTANCE_KM[input.distance]
  if (!distKm) return null

  const totalSec = input.hours * 3600 + input.minutes * 60 + input.seconds
  if (totalSec <= 0) return null

  // Apply 5% conservative buffer for goal times (aspirational → realistic)
  const adjustedSec = source === "goal-time" ? totalSec * 1.05 : totalSec

  // Riegel formula: T_5k = T_input × (5 / D_km)^1.06
  const t5kSec = adjustedSec * Math.pow(5 / distKm, 1.06)
  let ref = t5kSec / 5  // seconds per km at 5K equivalent pace

  // Guard: reject impossibly fast paces (< 2:00/km = 120 s/km)
  if (ref < 120) return null

  // Apply fitness context multiplier (recent-race only; goal-time already has the buffer)
  if (source === "recent-race") {
    const ctx = input.context ?? "active"
    ref *= CONTEXT_MULTIPLIER[ctx] ?? 1.0
  }

  return {
    vo2max:     formatZone(...ZONES.vo2max, ref),
    threshold:  formatZone(...ZONES.threshold, ref),
    mp:         formatZone(...ZONES.mp, ref),
    mediumLong: formatZone(...ZONES.mediumLong, ref),
    longRun:    formatZone(...ZONES.longRun, ref),
    easy:       formatZone(...ZONES.easy, ref),
    source,
  }
}

// ─── Phase schedule ─────────────────────────────────────────────────────────

function getTaperMin(distance: string): number {
  // "ultra" intentionally falls through to the same minimum as half/full (3 weeks)
  return distance === "5k" || distance === "10k" ? 2 : 3
}

/**
 * Compute the phase schedule for a training plan.
 *
 * ≤ 20 weeks → 4 phases (Base, Build, Peak, Taper)
 * 21+ weeks  → 5 phases (General Fitness, Base, Build, Peak, Taper)
 *
 * Taper minimum is always respected. Phases with 0 weeks are omitted.
 */
export function computePhases(totalWeeks: number, distance: string): PhaseEntry[] {
  const taperMin = getTaperMin(distance)
  const taper = Math.max(taperMin, Math.round(totalWeeks * 0.15))
  let remaining = totalWeeks - taper

  const result: PhaseEntry[] = []
  let w = 1

  function pushPhase(name: string, weeks: number) {
    if (weeks <= 0) return
    result.push({ name, startWeek: w, endWeek: w + weeks - 1 })
    w += weeks
    remaining -= weeks
  }

  if (totalWeeks <= 20) {
    // 4-phase
    const base  = Math.min(remaining, Math.max(1, Math.round(totalWeeks * 0.40)))
    remaining -= base
    const build = Math.min(remaining, Math.max(0, Math.round(totalWeeks * 0.30)))
    remaining -= build
    const peak  = Math.max(0, remaining)

    pushPhase("Base",  base)
    pushPhase("Build", build)
    pushPhase("Peak",  peak)
  } else {
    // 5-phase
    const gf    = Math.min(remaining, Math.max(1, Math.round(totalWeeks * 0.20)))
    remaining -= gf
    const base  = Math.min(remaining, Math.max(1, Math.round(totalWeeks * 0.30)))
    remaining -= base
    const build = Math.min(remaining, Math.max(1, Math.round(totalWeeks * 0.25)))
    remaining -= build
    const peak  = Math.max(0, remaining)

    pushPhase("General Fitness", gf)
    pushPhase("Base",  base)
    pushPhase("Build", build)
    pushPhase("Peak",  peak)
  }

  // Always push taper last (resets `remaining` tracking; use totalWeeks as anchor)
  result.push({ name: "Taper", startWeek: w, endWeek: totalWeeks })
  return result
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd packages/ai && pnpm test
```

Expected: all tests PASS. If any fail, check the expected values using the formula: ref = T_5k / 5, then multiply by zone bounds and round.

- [ ] **Step 5: Typecheck**

```bash
cd /path/to/repo && pnpm typecheck
```

Expected: errors only in `workout-utils.ts` (missing keys for new WorkoutType values). Those are fixed in Task 10.

- [ ] **Step 6: Commit**

```bash
git add packages/ai/src/pace-calculator.ts packages/ai/src/pace-calculator.test.ts
git commit -m "feat: add pace calculator and phase scheduler with tests"
```

---

## Chunk 2: Prompt Rewrite

### Task 4: Rewrite race-prompt.ts

**Files:**
- Modify: `packages/ai/src/race-prompt.ts`

The current prompt sends the LLM only a goal time and some logistical fields. The new prompt sends:
- Personalized pace zones (computed from recent race or goal time)
- Explicit phase schedule with week ranges
- Starting volume derived from weekly mileage range
- Fitness source description
- Fully rewritten system prompt with 80/20 intensity rules, phase-specific guidance, and weekly structure constraints

- [ ] **Step 1: Replace `packages/ai/src/race-prompt.ts` entirely**

```ts
import type { PlanGenerationInput } from "./types"
import { calculatePaceZones, computePhases } from "./pace-calculator"

const SYSTEM_PROMPT = `You are an expert running coach building a personalised race training plan. Your output is a complete, week-by-week schedule in NDJSON format.

## Output Format

First line — plan metadata. Copy phases array verbatim from user message. Estimate totalKm and peakWeekKm from your planned weekly distances:
{"_meta":true,"totalWeeks":<n>,"totalKm":<your estimate of total km>,"peakWeekKm":<your estimate of peak week km>,"phases":<phases array from user message>}

Then one line per calendar day in the exact date range provided. Use ONLY the dates in the "Week schedule" section — never invent or shift dates:
{"date":"YYYY-MM-DD","type":"<type>","distanceKm":<n>,"targetPace":"<pace zone from user message>","description":"<specific one sentence>"}

Rest days:
{"date":"YYYY-MM-DD","type":"rest","description":"Full rest day."}

Race day:
{"date":"YYYY-MM-DD","type":"race","distanceKm":<race_distance_km>,"description":"Race day — <race name>. Trust your training."}

No markdown, no explanation, no code fences. Output valid JSON only. No trailing commas.

## Valid Workout Types

- easy        — fully aerobic, conversational pace; use easy zone for targetPace
- long        — weekly long run; use longRun zone; ALWAYS on the designated long run day
- medium-long — 60–75% of long run distance, moderate-easy effort; use mediumLong zone; mid-week only
- mp          — standalone race-pace run; use mp zone
- tempo       — sustained threshold effort 20–40 min; use threshold zone
- intervals   — short repetitions 600m–1600m with recovery; use vo2max zone
- strength    — no distanceKm
- rest        — full rest, no distanceKm
- race        — race day

Every workout except rest and strength MUST have a targetPace matching the zone label exactly as given in the user message.

## Intensity Distribution (80/20 Rule)

- At least 80% of weekly running distance must be at easy, medium-long, or long run pace
- Maximum 2 quality sessions per week (tempo, intervals, mp)
- If athlete has only 3 running days: max 1 quality session per week

## Weekly Structure Rules

- Never schedule two quality sessions on consecutive days
- The day after the long run must be rest or easy only
- At least one easy or rest day before any quality session
- Long run MUST fall on the designated long run day every single week — no exceptions

## Phase-Specific Guidance

Follow the phase schedule provided in the user message. Apply the rules below per phase.

**General Fitness (21+ week plans only):**
- Easy runs and long runs only — no tempo, no intervals, no mp
- Build mileage progressively from the stated starting volume
- From week 3 onward: optional strides (4–6 × 20 sec) may be noted in description of easy runs

**Base:**
- Easy runs, long runs, medium-long runs
- Strides on easy days (note in description)
- Final week of this phase only: introduce one tempo run (20–25 min)

**Build:**
- One tempo session per week (25–40 min or cruise intervals)
- VO2max intervals in the second half of this phase only
- Medium-long run mid-week on a non-quality day
- Long run builds toward peak distance

**Peak:**
- Highest mileage weeks
- Long runs may include race-pace segments in the final 10–16 km — use type "long" and describe the mp segment in the description (e.g. "22 km long run — last 12 km at race pace")
- One VO2max session per week
- One tempo or standalone mp run per week

**Taper:**
- First taper week: reduce total volume by 20% from peak week
- Final taper week(s): reduce total volume by 40% from peak week
- Keep workout intensity — shorten sessions but do not drop quality entirely
- Use only workout types the athlete has already seen in the plan
- Long run is 60–70% of peak long run distance

## Hard Constraints

- Only schedule runs on the athlete's available running days — all other days must be type "rest"
- Long run MUST be on the designated long run day every single week, no exceptions
- When a strength day and a running day fall on the same date: emit TWO separate JSON lines for that date (one run, one strength)
- Follow the 10% weekly mileage increase rule; include a recovery week (30% mileage reduction) every 4th week
- Always output distances in kilometres
- Descriptions must be specific (e.g. "2 km warm-up, 5 × 1000 m at vo2max zone with 90 sec jog, 2 km cool-down") not vague (e.g. "do intervals")`

const DAY_NAMES: Record<string, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday",
  fri: "Friday", sat: "Saturday", sun: "Sunday",
}

const DAY_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

const DISTANCE_KM_MAP: Record<string, number> = {
  "5k": 5, "10k": 10, half: 21.1, full: 42.2, ultra: 80,
}

const RANGE_LABEL: Record<string, string> = {
  "under-40": "under 40",
  "40-60": "40–60",
  "60-80": "60–80",
  "80-plus": "80+",
}

const STARTING_VOLUME_KM: Record<string, number> = {
  "under-40": 30,
  "40-60": 50,
  "60-80": 70,
  "80-plus": 90,
}

function toISO(date: Date): string {
  return date.toISOString().split("T")[0]!
}

function firstMondayOnOrAfter(date: Date): Date {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  const day = d.getUTCDay()
  if (day !== 1) {
    d.setUTCDate(d.getUTCDate() + (day === 0 ? 1 : 8 - day))
  }
  return d
}

function buildWeekSchedule(startDate: Date, endDate: Date): string {
  const weeks: string[] = []
  const cur = new Date(startDate)
  let weekNum = 1
  while (cur <= endDate) {
    const weekStart = toISO(cur)
    const weekEnd = new Date(cur)
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6)
    const clampedEnd = weekEnd <= endDate ? weekEnd : endDate
    const dayLabels: string[] = []
    const day = new Date(cur)
    while (day <= clampedEnd) {
      dayLabels.push(`${toISO(day)} (${DAY_OF_WEEK[day.getUTCDay()]})`)
      day.setUTCDate(day.getUTCDate() + 1)
    }
    weeks.push(`Week ${weekNum} [${weekStart} – ${toISO(clampedEnd)}]: ${dayLabels.join(", ")}`)
    cur.setUTCDate(cur.getUTCDate() + 7)
    weekNum++
  }
  return weeks.join("\n")
}

export function buildPrompt(input: PlanGenerationInput): { system: string; user: string } {
  const startDate = input.startDate
    ? new Date(input.startDate + "T00:00:00Z")
    : firstMondayOnOrAfter(new Date())

  const endDate = new Date(input.race.date)
  endDate.setUTCHours(0, 0, 0, 0)

  const msPerWeek = 7 * 24 * 60 * 60 * 1000
  const totalWeeks = Math.floor((endDate.getTime() - startDate.getTime()) / msPerWeek) + 1

  const { name, date, distance, city } = input.race
  const raceKm = DISTANCE_KM_MAP[distance] ?? 42.2

  // ── Pace zones ──────────────────────────────────────────────────────────
  let paceZones = null

  if (input.recentRace) {
    const { hours, minutes, seconds, distance: rd, context } = input.recentRace
    paceZones = calculatePaceZones({ hours, minutes, seconds, distance: rd, context }, "recent-race")
  }

  if (!paceZones && input.goalTime) {
    const { hours, minutes } = input.goalTime
    paceZones = calculatePaceZones(
      // ultra is out of scope per spec; use "full" as a proxy for pace zone calculation
      { hours, minutes, seconds: 0, distance: distance === "ultra" ? "full" : distance as "5k"|"10k"|"half"|"full" },
      "goal-time"
    )
  }

  // ── Phase schedule ───────────────────────────────────────────────────────
  const phases = computePhases(totalWeeks, distance)
  const phasesJson = JSON.stringify(phases)

  const phaseScheduleLines = phases
    .map(p => `  ${p.name.padEnd(18)}: weeks ${p.startWeek}–${p.endWeek}`)
    .join("\n")

  // ── Weekly mileage / starting volume ────────────────────────────────────
  const mileageRange = input.weeklyMileageRange  // required field; default applied upstream in mapToInput
  const startingVolume = STARTING_VOLUME_KM[mileageRange] ?? 50
  const rangeLabel = RANGE_LABEL[mileageRange] ?? "40–60"

  // ── Fitness source description ───────────────────────────────────────────
  let fitnessSource = "goal time"
  if (input.recentRace) {
    const { hours, minutes, seconds, distance: rd, context } = input.recentRace
    const timeStr = hours > 0
      ? `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      : `${minutes}:${seconds.toString().padStart(2, "0")}`
    const ctxNote = context === "short-break" ? " (short break applied)" :
                    context === "long-break"   ? " (long break applied)" : ""
    fitnessSource = `recent ${rd.toUpperCase()} in ${timeStr}${ctxNote}`
  }

  // ── User message ─────────────────────────────────────────────────────────
  const lines: string[] = []

  lines.push(`Goal: Race — ${name} in ${city} on ${date} (${raceKm} km / ${distance})`)

  if (input.goalTime) {
    const { hours, minutes } = input.goalTime
    lines.push(`Time goal: ${hours}h${minutes.toString().padStart(2, "0")}m`)
  } else {
    lines.push("Time goal: finish (no specific time target)")
  }

  lines.push("")
  lines.push("Fitness baseline:")
  lines.push(`  Current weekly mileage: ${rangeLabel} km/week`)
  lines.push(`  Starting volume (week 1 total): ${startingVolume} km`)
  lines.push(`  Fitness source: ${fitnessSource}`)

  if (paceZones) {
    lines.push("")
    lines.push("Pace zones (use these exactly for targetPace on every non-rest, non-strength workout):")
    lines.push(`  Easy:         ${paceZones.easy}`)
    lines.push(`  Long run:     ${paceZones.longRun}`)
    lines.push(`  Medium-long:  ${paceZones.mediumLong}`)
    lines.push(`  Race pace:    ${paceZones.mp}`)
    lines.push(`  Threshold:    ${paceZones.threshold}`)
    lines.push(`  VO2max:       ${paceZones.vo2max}`)
  } else {
    lines.push("")
    lines.push("Pace zones: not available — calibrate paces to the athlete's goal time and fitness level.")
  }

  const runDayNames = input.selectedDays.map(d => DAY_NAMES[d] ?? d).join(", ")
  const longRunDayName = DAY_NAMES[input.longRunDay] ?? input.longRunDay

  lines.push("")
  lines.push(`Available running days: ${runDayNames}`)
  lines.push(`Long run day: ${longRunDayName} — every week's long run MUST be on ${longRunDayName}, no exceptions.`)

  if (input.strengthTraining && input.strengthDays?.length) {
    const strengthDayNames = input.strengthDays.map(d => DAY_NAMES[d] ?? d).join(", ")
    lines.push(`Strength training days: ${strengthDayNames}`)
  } else {
    lines.push("Strength training: none")
  }

  lines.push("")
  lines.push("Phase schedule (follow exactly):")
  lines.push(phaseScheduleLines)

  lines.push("")
  lines.push(`Meta line phases (copy verbatim into your first JSON line's "phases" field):`)
  lines.push(phasesJson)

  lines.push("")
  lines.push(`Week schedule (use ONLY these exact dates — do not invent or shift any dates):\n${buildWeekSchedule(startDate, endDate)}`)

  return { system: SYSTEM_PROMPT, user: lines.join("\n") }
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /path/to/repo && pnpm typecheck
```

Expected: only the existing `workout-utils.ts` errors (new WorkoutType keys). No new errors.

- [ ] **Step 3: Commit**

```bash
git add packages/ai/src/race-prompt.ts
git commit -m "feat: rewrite race-prompt with pace zones, phase schedule, and coaching rules"
```

---

## Chunk 3: Onboarding steps

### Task 5: Update onboarding types

**Files:**
- Modify: `apps/web/components/onboarding/types.ts`

- [ ] **Step 1: Add new fields and update getSteps**

Replace the `OnboardingData` interface and `getSteps` in `apps/web/components/onboarding/types.ts`:

```ts
export type Goal = "race"
export type Day = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"
export type Distance = "5k" | "10k" | "half" | "full" | "ultra"

export const DISTANCE_LABELS: Record<Distance, string> = {
  "5k":    "5K",
  "10k":   "10K",
  "half":  "Half Marathon",
  "full":  "Full Marathon",
  "ultra": "Ultra",
}

export const DAY_LABELS: Record<Day, { short: string; full: string }> = {
  mon: { short: "Mon", full: "Monday" },
  tue: { short: "Tue", full: "Tuesday" },
  wed: { short: "Wed", full: "Wednesday" },
  thu: { short: "Thu", full: "Thursday" },
  fri: { short: "Fri", full: "Friday" },
  sat: { short: "Sat", full: "Saturday" },
  sun: { short: "Sun", full: "Sunday" },
}

export const ORDERED_DAYS: Day[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

export interface RaceData {
  name: string
  city: string
  date: Date
  distance: Distance
}

export interface OnboardingData {
  goal?: Goal
  race?: RaceData
  timeGoal?: boolean
  goalTime?: { hours: number; minutes: number }
  selectedDays?: Day[]
  longRunDay?: Day
  strengthTraining?: boolean
  strengthDays?: Day[]
  weeklyMileageRange?: "under-40" | "40-60" | "60-80" | "80-plus"
  recentRace?: {
    distance: "5k" | "10k" | "half" | "full"
    hours: number
    minutes: number
    seconds: number
    context: "active" | "short-break" | "long-break"
  }
}

export interface StepProps {
  formData: OnboardingData
  onNext: (data: Partial<OnboardingData>) => void
}

export function getSteps(): readonly string[] {
  return [
    "findRace",
    "goalTime",
    "whichDays",
    "strengthTraining",
    "strengthDays",
    "weeklyMileage",
    "recentRace",
  ]
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /path/to/repo && pnpm typecheck
```

Expected: still only `workout-utils.ts` errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/onboarding/types.ts
git commit -m "feat: add weeklyMileageRange and recentRace to OnboardingData, update getSteps"
```

---

### Task 6: Create step-weekly-mileage.tsx

**Files:**
- Create: `apps/web/components/onboarding/steps/step-weekly-mileage.tsx`

This is a four-option card picker. Selecting a card immediately advances (150ms delay, same pattern as StepStrengthTraining).

- [ ] **Step 1: Create the file**

`apps/web/components/onboarding/steps/step-weekly-mileage.tsx`:
```tsx
"use client"

import { useState } from "react"
import { OnboardingCard } from "../onboarding-card"
import type { StepProps } from "../types"

type MileageRange = "under-40" | "40-60" | "60-80" | "80-plus"

const OPTIONS: { value: MileageRange; label: string; description: string }[] = [
  { value: "under-40", label: "Under 40 km/week",  description: "Building base fitness" },
  { value: "40-60",   label: "40–60 km/week",      description: "Solid recreational runner" },
  { value: "60-80",   label: "60–80 km/week",      description: "Committed club runner" },
  { value: "80-plus", label: "80+ km/week",         description: "High mileage athlete" },
]

export function StepWeeklyMileage({ formData, onNext }: Pick<StepProps, "formData" | "onNext">) {
  const [selected, setSelected] = useState<MileageRange | undefined>(formData.weeklyMileageRange)

  function handleSelect(value: MileageRange) {
    setSelected(value)
    setTimeout(() => onNext({ weeklyMileageRange: value }), 150)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          How many kilometres do you run per week?
        </h2>
        <p className="text-sm text-muted-foreground">
          This sets your starting volume for week 1 of the plan.
        </p>
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

- [ ] **Step 2: Typecheck**

```bash
cd /path/to/repo && pnpm typecheck
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/onboarding/steps/step-weekly-mileage.tsx
git commit -m "feat: add step-weekly-mileage onboarding step"
```

---

### Task 7: Create step-recent-race.tsx

**Files:**
- Create: `apps/web/components/onboarding/steps/step-recent-race.tsx`

This step has three parts rendered on one screen:
1. Distance picker (2×2 grid of OnboardingCards)
2. Time entry (h:mm:ss)
3. Fitness context question (appears only after a valid time is entered)

Skip button calls `onNext({})` with no recentRace — the prompt falls back to goal time.

- [ ] **Step 1: Create the file**

`apps/web/components/onboarding/steps/step-recent-race.tsx`:
```tsx
"use client"

import { useRef, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { OnboardingCard } from "../onboarding-card"
import { DISTANCE_LABELS, type StepProps } from "../types"

type RaceDistance = "5k" | "10k" | "half" | "full"
type FitnessContext = "active" | "short-break" | "long-break"

const DISTANCES: { value: RaceDistance; label: string }[] = [
  { value: "5k",   label: DISTANCE_LABELS["5k"] },
  { value: "10k",  label: DISTANCE_LABELS["10k"] },
  { value: "half", label: DISTANCE_LABELS["half"] },
  { value: "full", label: DISTANCE_LABELS["full"] },
]

const CONTEXT_OPTIONS: { value: FitnessContext; label: string; description: string }[] = [
  { value: "active",       label: "Actively training",       description: "Running regularly right now" },
  { value: "short-break",  label: "Took a short break",      description: "Off for less than 2 months" },
  { value: "long-break",   label: "Been off for a while",    description: "2+ months since regular training" },
]

export function StepRecentRace({ formData, onNext }: Pick<StepProps, "formData" | "onNext">) {
  const [distance, setDistance] = useState<RaceDistance | undefined>(
    formData.recentRace?.distance
  )
  const [hours,   setHours]   = useState(formData.recentRace?.hours.toString() ?? "")
  const [minutes, setMinutes] = useState(
    formData.recentRace?.minutes !== undefined
      ? formData.recentRace.minutes.toString().padStart(2, "0")
      : ""
  )
  const [seconds, setSeconds] = useState(
    formData.recentRace?.seconds !== undefined
      ? formData.recentRace.seconds.toString().padStart(2, "0")
      : ""
  )
  const [context, setContext] = useState<FitnessContext | undefined>(
    formData.recentRace?.context
  )

  const minutesRef = useRef<HTMLInputElement>(null)
  const secondsRef = useRef<HTMLInputElement>(null)

  const h = parseInt(hours,   10)
  const m = parseInt(minutes, 10)
  const s = parseInt(seconds, 10)

  const timeIsValid =
    distance !== undefined &&
    hours !== "" && minutes !== "" && seconds !== "" &&
    !isNaN(h) && !isNaN(m) && !isNaN(s) &&
    h >= 0 && h <= 23 && m >= 0 && m <= 59 && s >= 0 && s <= 59 &&
    (h * 3600 + m * 60 + s) > 0

  const canAdvance = timeIsValid && context !== undefined

  function handleNext() {
    if (!canAdvance || !distance || !context) return
    onNext({
      recentRace: { distance, hours: h, minutes: m, seconds: s, context },
    })
  }

  function handleSkip() {
    onNext({})
  }

  const inputCls =
    "w-16 rounded-xl border border-border bg-muted/50 py-3 text-center text-3xl font-semibold tracking-tight outline-none focus:border-primary focus:bg-background transition-colors"

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Any recent race results?</h2>
        <p className="text-sm text-muted-foreground">
          A recent finish time gives us accurate pacing zones. Skip if you don&apos;t have one.
        </p>
      </div>

      {/* Distance picker */}
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Distance
        </p>
        <div className="grid grid-cols-2 gap-2">
          {DISTANCES.map((d) => (
            <OnboardingCard
              key={d.value}
              label={d.label}
              selected={distance === d.value}
              onClick={() => setDistance(d.value)}
            />
          ))}
        </div>
      </div>

      {/* Time entry */}
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Finish time
        </p>
        <div className="flex items-center justify-center gap-2">
          <div className="flex flex-col items-center gap-1">
            <input
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={hours}
              onChange={(e) => setHours(e.target.value.replace(/\D/g, "").slice(0, 2))}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") { e.preventDefault(); minutesRef.current?.focus() }
              }}
              className={inputCls}
            />
            <span className="text-xs text-muted-foreground">h</span>
          </div>
          <span className="text-3xl font-semibold text-muted-foreground pb-4">:</span>
          <div className="flex flex-col items-center gap-1">
            <input
              ref={minutesRef}
              type="text"
              inputMode="numeric"
              placeholder="00"
              value={minutes}
              onChange={(e) => {
                const n = e.target.value.replace(/\D/g, "").slice(0, 2)
                if (n === "" || parseInt(n, 10) <= 59) setMinutes(n)
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft")  { e.preventDefault(); /* focus handled by browser */ }
                if (e.key === "ArrowRight") { e.preventDefault(); secondsRef.current?.focus() }
              }}
              className={inputCls}
            />
            <span className="text-xs text-muted-foreground">min</span>
          </div>
          <span className="text-3xl font-semibold text-muted-foreground pb-4">:</span>
          <div className="flex flex-col items-center gap-1">
            <input
              ref={secondsRef}
              type="text"
              inputMode="numeric"
              placeholder="00"
              value={seconds}
              onChange={(e) => {
                const n = e.target.value.replace(/\D/g, "").slice(0, 2)
                if (n === "" || parseInt(n, 10) <= 59) setSeconds(n)
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") { e.preventDefault(); minutesRef.current?.focus() }
              }}
              className={inputCls}
            />
            <span className="text-xs text-muted-foreground">sec</span>
          </div>
        </div>
      </div>

      {/* Context picker — only shown after a valid time is entered */}
      {timeIsValid && (
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            How is your training going right now?
          </p>
          <div className="space-y-2">
            {CONTEXT_OPTIONS.map((opt) => (
              <OnboardingCard
                key={opt.value}
                label={opt.label}
                description={opt.description}
                selected={context === opt.value}
                onClick={() => setContext(opt.value)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <Button onClick={handleNext} disabled={!canAdvance} className="w-full">
          Next
        </Button>
        <div className="text-center">
          <button
            onClick={handleSkip}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Skip — use my goal time for pacing
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /path/to/repo && pnpm typecheck
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/onboarding/steps/step-recent-race.tsx
git commit -m "feat: add step-recent-race with fitness context picker"
```

---

### Task 8: Wire new steps into onboarding-flow.tsx

**Files:**
- Modify: `apps/web/components/onboarding/onboarding-flow.tsx`

Two changes: add imports and cases in `renderStep()`, add entries in `STEP_LABELS`.

- [ ] **Step 1: Add imports at top of file** (after existing step imports)

Find the block of step imports (around line 10–14) and add:
```ts
import { StepWeeklyMileage } from "./steps/step-weekly-mileage"
import { StepRecentRace } from "./steps/step-recent-race"
```

- [ ] **Step 2: Add STEP_LABELS entries**

Find `STEP_LABELS` and add:
```ts
const STEP_LABELS: Record<string, string> = {
  findRace: "Your race",
  goalTime: "Goal time",
  whichDays: "Running days",
  strengthTraining: "Strength training",
  strengthDays: "Lifting days",
  weeklyMileage: "Weekly mileage",
  recentRace: "Recent race",
}
```

- [ ] **Step 3: Add cases to renderStep()**

Find the `switch (stepName)` block and add two cases:
```ts
case "weeklyMileage": return <StepWeeklyMileage {...stepProps} />
case "recentRace":    return <StepRecentRace {...stepProps} />
```

- [ ] **Step 4: Typecheck**

```bash
cd /path/to/repo && pnpm typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/onboarding/onboarding-flow.tsx
git commit -m "feat: wire weeklyMileage and recentRace steps into onboarding flow"
```

---

## Chunk 4: Display layer

### Task 9: Update workout-utils.ts

**Files:**
- Modify: `apps/web/app/plan/workout-utils.ts`

Three changes:
1. Add `medium-long` and `mp` entries to `WORKOUT_NAMES` and `WORKOUT_TEXT_CLASS` (fixing TypeScript errors)
2. Add `mp` color to `getWorkoutColor`
3. Update `getPhaseLabel` to accept an optional `phases` array and use it when present

- [ ] **Step 1: Replace file**

`apps/web/app/plan/workout-utils.ts`:
```ts
import type { WorkoutType, WorkoutDay, PhaseEntry } from "@workspace/ai"

export const WORKOUT_NAMES: Record<WorkoutType, string> = {
  easy:          "Easy Run",
  long:          "Long Run",
  "medium-long": "Medium-Long",
  mp:            "Race Pace",
  tempo:         "Tempo Run",
  intervals:     "Intervals",
  strength:      "Strength",
  rest:          "Rest Day",
  race:          "Race Day",
}

// Tailwind class for text color. Use getWorkoutColor() for oklch values.
// Types with an empty string here rely on getWorkoutColor() for their inline oklch style instead.
export const WORKOUT_TEXT_CLASS: Record<WorkoutType, string> = {
  easy:          "text-muted-foreground",
  long:          "text-primary",
  "medium-long": "text-primary/70",
  mp:            "",  // color applied via getWorkoutColor() (warm amber oklch)
  tempo:         "",
  intervals:     "",
  strength:      "",
  rest:          "text-subtle-foreground",
  race:          "text-primary",
}

// Inline color style for types that can't be expressed as Tailwind classes.
export function getWorkoutColor(type: WorkoutType): string {
  const map: Partial<Record<WorkoutType, string>> = {
    mp:            "oklch(0.78 0.15 55)",   // warm amber — between easy and tempo
    tempo:         "oklch(0.78 0.15 80)",
    intervals:     "oklch(0.75 0.18 30)",
    strength:      "oklch(0.65 0.15 300)",
  }
  return map[type] ?? ""
}

export function formatDistance(km: number, units: "km" | "miles"): string {
  if (units === "miles") {
    return (km * 0.621371).toFixed(1)
  }
  return km % 1 === 0 ? km.toString() : km.toFixed(1)
}

export function distanceUnit(units: "km" | "miles"): string {
  return units === "miles" ? "mi" : "km"
}

export function groupDaysByWeek(days: WorkoutDay[]): WorkoutDay[][] {
  if (days.length === 0) return []
  const startMs = new Date(days[0]!.date).getTime()
  const weeks: WorkoutDay[][] = []
  for (const day of days) {
    const weekIdx = Math.floor(
      (new Date(day.date).getTime() - startMs) / (7 * 24 * 60 * 60 * 1000)
    )
    if (!weeks[weekIdx]) weeks[weekIdx] = []
    weeks[weekIdx]!.push(day)
  }
  return weeks
}

/**
 * Returns the phase label for a given week.
 *
 * If `phases` is provided (from the server-computed schedule), uses it directly.
 * Falls back to the legacy percentage-based heuristic for plans without phase data.
 *
 * Note: the spec defines a 2-param signature `getPhaseLabel(weekNum, phases)`,
 * but the legacy fallback requires `totalWeeks` and `taperWeeks`. This 4-param
 * signature is used instead to preserve backward compatibility.
 */
export function getPhaseLabel(
  weekNum: number,
  totalWeeks: number,
  taperWeeks: number,
  phases?: PhaseEntry[]
): string {
  if (phases && phases.length > 0) {
    const phase = phases.find((p) => weekNum >= p.startWeek && weekNum <= p.endWeek)
    return phase?.name ?? ""
  }
  // Legacy fallback
  if (weekNum <= Math.floor(totalWeeks * 0.4)) return "Base"
  if (weekNum <= Math.floor(totalWeeks * 0.7)) return "Build"
  if (weekNum <= totalWeeks - taperWeeks) return "Peak"
  return "Taper"
}

export function getTaperWeeks(distance?: "5k" | "10k" | "half" | "full" | "ultra"): number {
  if (!distance) return 0
  if (distance === "5k" || distance === "10k") return 2
  return 3
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /path/to/repo && pnpm typecheck
```

Expected: no errors (the `workout-utils.ts` errors from Tasks 2–5 are now fixed).

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/plan/workout-utils.ts
git commit -m "feat: add medium-long/mp display config, update getPhaseLabel to accept phases array"
```

---

### Task 10: Pass phases through plan-calendar.tsx and plan-feed.tsx

**Files:**
- Modify: `apps/web/app/plan/plan-calendar.tsx`
- Modify: `apps/web/app/plan/plan-feed.tsx`

Both components currently call `getPhaseLabel(weekNum, totalWeeks, taperWeeks)`. They need to accept a `phases` prop and pass it to `getPhaseLabel`.

- [ ] **Step 1: Update plan-calendar.tsx**

First, find the `RUN_TYPES` constant (around line 202) and add the new run types:
```ts
const RUN_TYPES = new Set(["easy", "long", "medium-long", "mp", "tempo", "intervals", "race"])
```

Then, add `phases?: PhaseEntry[]` to the import and to `PlanCalendarProps`:

```ts
import type { WorkoutDay, WorkoutType, PhaseEntry } from "@workspace/ai"
```

Add to `PlanCalendarProps` interface:
```ts
phases?: PhaseEntry[]
```

Update destructuring in the function signature:
```ts
export function PlanCalendar({ days, units, totalWeeks, raceDistance, onToggleComplete, onSaveEdit, selectedKey, onSelectedKeyChange, phases }: PlanCalendarProps) {
```

Update the `getPhaseLabel` call (currently line ~141):
```ts
const phase = totalWeeks > 0 ? getPhaseLabel(weekNum, totalWeeks, taperWeeks, phases) : ""
```

Also update the `prevPhase` line (~143):
```ts
const prevPhase = totalWeeks > 0 && weekIdx > 0
  ? getPhaseLabel(weekIdx, totalWeeks, taperWeeks, phases)
  : null
```

- [ ] **Step 2: Update plan-feed.tsx**

Add `PhaseEntry` to import:
```ts
import type { WorkoutDay, WorkoutType, PhaseEntry } from "@workspace/ai"
```

Add to `PlanFeedProps` interface:
```ts
phases?: PhaseEntry[]
```

Update destructuring in the function signature to include `phases`.

Update the `getPhaseLabel` call (currently line ~62). Note: `plan-feed.tsx` has only one call (no `prevPhase`):
```ts
const phase = totalWeeks > 0 ? getPhaseLabel(weekNum, totalWeeks, taperWeeks, phases) : ""
```

- [ ] **Step 3: Typecheck**

```bash
cd /path/to/repo && pnpm typecheck
```

Expected: no errors (but `plan/page.tsx` hasn't passed `phases` yet — TypeScript won't error since the prop is optional).

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/plan/plan-calendar.tsx apps/web/app/plan/plan-feed.tsx
git commit -m "feat: pass phases prop to calendar and feed for accurate phase labels"
```

---

### Task 11: Update plan/page.tsx

**Files:**
- Modify: `apps/web/app/plan/page.tsx`

Four changes:
1. Expand `VALID_WORKOUT_TYPES` to include `"medium-long"` and `"mp"`
2. Add `weeklyMileageRange` and `recentRace` mapping in `mapToInput`
3. Add `phases` state, extract from `_meta` line, add to `SavedPlanSnapshot`, pass to calendar/feed
4. Import `PhaseEntry`

- [ ] **Step 1: Add PhaseEntry import**

In the import line at the top, add `PhaseEntry`:
```ts
import type { PlanGenerationInput, TrainingPlan, WorkoutDay, WorkoutType, PhaseEntry } from "@workspace/ai"
```

- [ ] **Step 2: Expand VALID_WORKOUT_TYPES**

Replace:
```ts
const VALID_WORKOUT_TYPES = new Set(["easy", "long", "tempo", "intervals", "rest", "race", "strength"])
```
With:
```ts
const VALID_WORKOUT_TYPES = new Set([
  "easy", "long", "medium-long", "mp", "tempo", "intervals", "rest", "race", "strength",
])
```

- [ ] **Step 3: Add phases to SavedPlanSnapshot**

```ts
interface SavedPlanSnapshot {
  input: PlanGenerationInput
  days: WorkoutDay[]
  totalWeeks: number
  totalKm: number
  peakWeekKm: number
  phases?: PhaseEntry[]  // optional for backward compatibility with snapshots saved before this change
  savedAt: number
}
```

- [ ] **Step 4: Update mapToInput to include new fields**

After the existing `if (raw["timeGoal"] === true && raw["goalTime"])` block, add:

```ts
// weeklyMileageRange — apply default if missing
const rawRange = raw["weeklyMileageRange"] as string | undefined
const validRanges = ["under-40", "40-60", "60-80", "80-plus"]
input.weeklyMileageRange = validRanges.includes(rawRange ?? "")
  ? (rawRange as PlanGenerationInput["weeklyMileageRange"])
  : "40-60"

// recentRace — passthrough with numeric coercion
if (raw["recentRace"]) {
  const rr = raw["recentRace"] as Record<string, unknown>
  const ctx = rr["context"] as string | undefined
  input.recentRace = {
    distance: rr["distance"] as "5k" | "10k" | "half" | "full",
    hours:    Number(rr["hours"]   ?? 0),
    minutes:  Number(rr["minutes"] ?? 0),
    seconds:  Number(rr["seconds"] ?? 0),
    context:  ctx === "short-break" || ctx === "long-break" ? ctx : "active",
  }
}
```

Note: `weeklyMileageRange` is required on `PlanGenerationInput` so the default must always be applied. Do not return null if it's missing — just default it.

- [ ] **Step 5: Add phases state**

Add after the existing `useState` declarations:
```ts
const [phases, setPhases] = useState<PhaseEntry[]>([])
```

- [ ] **Step 6: Extract phases from _meta NDJSON line**

Find the `} else if (parsed["_meta"] === true) {` block and update it:

```ts
} else if (parsed["_meta"] === true) {
  const tw = Number(parsed["totalWeeks"] ?? 0)
  totalWeeksRef.current = tw
  const metaPhases = Array.isArray(parsed["phases"])
    ? (parsed["phases"] as PhaseEntry[])
    : []
  setPhases(metaPhases)
  setPlan((p) => ({
    ...p,
    totalWeeks: tw,
    totalKm:    Number(parsed["totalKm"]    ?? 0),
    peakWeekKm: Number(parsed["peakWeekKm"] ?? 0),
    phases:     metaPhases,
  }))
```

- [ ] **Step 7: Include phases in SavedPlanSnapshot creation**

In `handleBeforeSignIn`:
```ts
const snapshot: SavedPlanSnapshot = {
  input,
  days: current.days ?? [],
  totalWeeks: current.totalWeeks ?? 0,
  totalKm:    current.totalKm    ?? 0,
  peakWeekKm: current.peakWeekKm ?? 0,
  phases:     current.phases     ?? [],
  savedAt:    Date.now(),
}
```

- [ ] **Step 8: Restore phases from snapshot in auto-save effect**

In the auto-save effect, update `setPlan` and `setPhases`:
```ts
streamStartedRef.current = true
setInput(snapshot.input)
setPhases(snapshot.phases ?? [])
setPlan({
  days:       snapshot.days,
  totalWeeks: snapshot.totalWeeks,
  totalKm:    snapshot.totalKm,
  peakWeekKm: snapshot.peakWeekKm,
  phases:     snapshot.phases ?? [],
})
setStatus("complete")
totalWeeksRef.current = snapshot.totalWeeks
```

- [ ] **Step 9: Pass phases to PlanCalendar and PlanFeed**

In the render, add `phases={phases}` to both:
```tsx
<PlanCalendar
  days={plan.days ?? []}
  units={input.units}
  totalWeeks={plan.totalWeeks ?? 0}
  raceDistance={input.race?.distance}
  phases={phases}
  selectedKey={selectedKey}
  onSelectedKeyChange={setSelectedKey}
/>
```

```tsx
<PlanFeed
  days={plan.days ?? []}
  units={input.units}
  totalWeeks={plan.totalWeeks ?? 0}
  raceDistance={input.race?.distance}
  phases={phases}
  selectedKey={selectedKey}
  onSelectedKeyChange={setSelectedKey}
/>
```

- [ ] **Step 10: Typecheck**

```bash
cd /path/to/repo && pnpm typecheck
```

Expected: no errors.

- [ ] **Step 11: Run tests**

```bash
cd packages/ai && pnpm test
```

Expected: all tests pass.

- [ ] **Step 12: Commit**

```bash
git add apps/web/app/plan/page.tsx
git commit -m "feat: wire phases through plan page — mapToInput, meta parsing, snapshot, display"
```

---

## Final verification

- [ ] **Run full typecheck**

```bash
cd /path/to/repo && pnpm typecheck
```

Expected: no errors across all packages.

- [ ] **Run tests**

```bash
cd packages/ai && pnpm test
```

Expected: all tests pass.

- [ ] **Run dev server and exercise the flow**

```bash
cd /path/to/repo && pnpm dev
```

Manual checks:
1. Open the app, click through onboarding — verify "Weekly mileage" and "Recent race" steps appear after Strength days
2. On "Recent race" step: enter a distance + time → verify context picker appears; click Skip → verify it advances without recentRace
3. Reach the plan page → verify plan generates; check browser console for any JSON parse errors
4. Inspect a generated workout — verify `targetPace` field contains a pace string (not empty)
5. Check the calendar — verify phase labels change correctly across phase boundaries (5-phase for long plans, 4-phase for short plans)
6. Verify `medium-long` and `mp` workout types render with correct labels and colors if the LLM produces them
