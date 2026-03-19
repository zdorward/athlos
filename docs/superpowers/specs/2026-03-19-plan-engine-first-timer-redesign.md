# Plan Engine First-Timer Redesign

**Date:** 2026-03-19
**Status:** Approved

---

## Problem

The current plan generation system has two critical flaws for lower-mileage and first-time marathon runners:

1. **Long run cap** — the scheduler caps long runs at 35% of weekly volume. At 40 km/week peak, this limits the long run to 14 km (~8.7 miles) — completely inadequate for marathon preparation. The cap is wrong for marathon at any volume below ~100 km/week.

2. **No first-timer awareness** — the algorithm treats a first-timer at 30 km/week identically to an experienced runner returning to the same bracket. No guardrails, no feasibility checks, no constraint on quality session complexity.

Additionally:
- The mileage bracket is asked after goal time, so feasibility can't be checked when goal time is entered
- Strength training is always included with no opt-out
- Two unused onboarding step files persist in the codebase
- `workout-scheduler.ts` (386 lines) has grown too large and does too much

---

## Goals

- Generate sound marathon and half marathon plans for first-time runners
- Surface feasibility warnings when current mileage + race date + goal time are in tension
- Give users control over strength training inclusion
- Fix the long run cap for marathon distances
- Keep the algorithm in one coherent pipeline — no parallel first-timer code path

---

## Non-Goals

- Changing the training science principles (they remain correct)
- Supporting experience levels beyond first-timer / experienced (no "intermediate" persona)
- Adding easy run pace as an onboarding input (deferred)
- Changing the mileage bracket UX from cards to a number input

---

## Section 1: Onboarding Flow

### New Step Order

| # | Step | Change |
|---|------|--------|
| 1 | Find race | No change |
| 2 | First [marathon / half marathon]? | **New** |
| 3 | Weekly mileage | Moved earlier (was step 4) |
| 4 | Goal time | Moved after mileage; feasibility warning shown here |
| 5 | Which days | No change |
| 6 | Include strength training? | **New** |

### New Step: `step-first-at-distance.tsx`

- Two `OnboardingCard` buttons: "Yes, it's my first" / "No, I've done one before"
- Heading is dynamic from `race.distance`:
  - `"full"` → "Is this your first marathon?"
  - `"half"` → "Is this your first half marathon?"
- Required — no skip option
- Returns `{ isFirstAtDistance: boolean }`

### New Step: `step-include-strength.tsx`

- Two `OnboardingCard` buttons: "Yes, include it" / "No, running only"
- "Yes" subtext: "2×/week resistance + core — shown to improve running economy"
- "No" subtext: "Running sessions only"
- Returns `{ includeStrength: boolean }`

### Feasibility Warning

Displayed on the goal time step (step 4) as an inline callout — not a blocker. The user can proceed.

Example copy: *"With your current mileage and 14 weeks to race day, your plan will peak at a ~22 km long run. For a first marathon we recommend 16+ weeks to safely reach 29–32 km."*

The warning is returned by the API in the plan response and shown in the onboarding UI before the user reaches the final screen.

### Data Model Additions

```ts
// OnboardingData (apps/web/components/onboarding/types.ts)
isFirstAtDistance: boolean
includeStrength: boolean
```

```ts
// PlanGenerationInput (packages/plan-engine/src/types.ts)
isFirstAtDistance: boolean
includeStrength: boolean
```

### Deletions

Remove two superseded unused step files:
- `apps/web/components/onboarding/steps/step-long-run-day.tsx`
- `apps/web/components/onboarding/steps/step-time-goal.tsx`

---

## Section 2: PlanConstraints Layer

### New Module: `packages/plan-engine/src/constraints.ts`

A single `computeConstraints()` function takes all plan inputs and returns a `PlanConstraints` object. All scheduling functions read from this object — no flags threaded through individual functions.

### PlanConstraints Shape

```ts
interface PlanConstraints {
  // Volume
  startingVolumeKm: number       // from bracket (unchanged: 30/50/70/90)
  peakWeeklyKm: number           // from goal time or bracket high fallback
  rampRatePerWeek: number        // first-timers: 0.08; experienced: 0.10

  // Long run
  peakLongRunKm: number          // absolute target: 29–38 km (full), 19–26 km (half)
  longRunMaxFraction: number     // full marathon: 0.40; half: 0.38; others: 0.35

  // Quality
  maxQualitySessions: number     // first-timers: always 1; others: from goal time
  allowIntervals: boolean        // first-timers: false; others: true

  // Strength
  includeStrength: boolean       // from onboarding toggle

  // Guardrails
  minimumPlanWeeks: number       // first-timers full: 16; first-timers half: 12; others: 8
  feasibilityWarning: string | null
}
```

### Feasibility Warning Logic

```
achievablePeakKm = startingVolumeKm × (1 + rampRate)^(preTaperWeeks)
achievableLongRunKm = achievablePeakKm × longRunMaxFraction

if totalWeeks < minimumPlanWeeks:
  → "Not enough weeks — [distance] preparation requires at least [N] weeks"

if achievableLongRunKm < 26 km AND distance === "full":
  → "Long run will only reach ~[X] km — consider a later race or higher starting mileage"

if achievableLongRunKm < 16 km AND distance === "half":
  → "Long run will only reach ~[X] km — consider a later race or higher starting mileage"
```

Both conditions can fire simultaneously. `null` if the plan is sound.

### Changes to Existing Functions

| File | Change |
|------|--------|
| `workout-scheduler.ts` | Replace hardcoded `0.35` with `constraints.longRunMaxFraction`; skip strength placement if `constraints.includeStrength === false`; skip interval placement if `constraints.allowIntervals === false` |
| `training-parameters.ts` | `computeTrainingStructure` no longer owns `maxQualitySessions` for the first-timer case — constraints owns it |
| `volume-progression.ts` | Use `constraints.rampRatePerWeek` instead of pure linear interpolation |
| `generate-plan/route.ts` | Call `computeConstraints()` early; thread `constraints` through the pipeline; include `feasibilityWarning` in API response |

---

## Section 3: File Structure

### plan-engine

```
packages/plan-engine/src/
├── index.ts
├── types.ts
├── constants.ts
├── constraints.ts          ← new
├── pace-calculator.ts
├── training-parameters.ts
├── phase-planner.ts
├── volume-progression.ts
├── workout-scheduler.ts    ← orchestration only (~150 lines)
├── workout-placement.ts    ← new: quality/strength/easy placement logic
└── bridge-runs.ts
```

`workout-scheduler.ts` retains the main week loop and calls into `workout-placement.ts` for per-day decisions. Each file targets under 200 lines.

### Onboarding

```
apps/web/components/onboarding/steps/
├── step-find-race.tsx
├── step-first-at-distance.tsx    ← new
├── step-goal-time.tsx
├── step-which-days.tsx
├── step-weekly-mileage.tsx
└── step-include-strength.tsx     ← new
```

Deleted:
- `step-long-run-day.tsx`
- `step-time-goal.tsx`

---

## Section 4: New Onboarding Step Components

Both components follow the `OnboardingCard` pattern from `step-weekly-mileage.tsx` — no new UI primitives.

### `step-first-at-distance.tsx`

```
Props: { race: RaceData; value: boolean | undefined; onChange: (v: boolean) => void }

Heading:  race.distance === "full" ? "Is this your first marathon?"
                                   : "Is this your first half marathon?"

Cards:
  - "Yes, it's my first"     → isFirstAtDistance: true
  - "No, I've done one"      → isFirstAtDistance: false

Required: no skip
```

### `step-include-strength.tsx`

```
Props: { value: boolean | undefined; onChange: (v: boolean) => void }

Heading: "Do you want to include strength training?"

Cards:
  - "Yes, include it"     subtext: "2×/week resistance + core — shown to improve running economy"
  - "No, running only"    subtext: "Running sessions only"

Required: no skip
```

---

## API Response Change

```ts
// generate-plan response adds:
{
  feasibilityWarning: string | null
  // ... existing fields unchanged
}
```

The onboarding final screen reads this from the response and displays the warning inline above the "Build My Plan" button if present.

---

## Out of Scope

- Pace zone changes for first-timers (same zones, less intense sessions)
- Changing training science principles or phase structure
- New workout types
- Half marathon-specific phase durations (existing phase planner handles distance already)
