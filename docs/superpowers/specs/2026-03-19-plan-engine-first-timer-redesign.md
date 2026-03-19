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

### Wiring: `getSteps()` and `renderStep()`

Two files in the onboarding orchestration require mechanical updates:

**`apps/web/components/onboarding/types.ts` — `getSteps()`**
Add `"firstAtDistance"` at index 1 (after `findRace`) and `"includeStrength"` at index 5 (after `whichDays`). Move `"weeklyMileage"` before `"goalTime"`. Updated return:
```ts
["findRace", "firstAtDistance", "weeklyMileage", "goalTime", "whichDays", "includeStrength"]
```

Add both new step keys to `STEP_LABELS`:
```ts
firstAtDistance: "Experience",
includeStrength: "Strength Training",
```

**`apps/web/components/onboarding/onboarding-flow.tsx` — `renderStep()`**
Add two new cases to the switch (or equivalent conditional):
```ts
case "firstAtDistance": return <StepFirstAtDistance ... />
case "includeStrength": return <StepIncludeStrength ... />
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
  startingVolumeKm: number       // from WEEK1_VOLUME_KM in volume-progression.ts (30/40/60/80)
  peakWeeklyKm: number           // achievable peak — see derivation below
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

### Starting Volume: Resolve Pre-existing Inconsistency

Two constants currently diverge:
- `WEEK1_VOLUME_KM` in `volume-progression.ts`: `{ under-40: 30, 40-60: 40, 60-80: 60, 80-plus: 80 }` — this is what `computeWeeklyVolumes` actually uses
- `STARTING_VOLUME_KM` in `constants.ts`: `{ under-40: 30, 40-60: 50, 60-80: 70, 80-plus: 90 }` — diverged duplicate

As part of this change: delete `STARTING_VOLUME_KM` from `constants.ts` and export `WEEK1_VOLUME_KM` from `volume-progression.ts` (rename to `STARTING_VOLUME_KM` for clarity, or export as-is). `constraints.ts` imports and uses `WEEK1_VOLUME_KM` as the canonical starting volume.

### Peak Weekly Km: Achievable vs. Aspirational

`computeConstraints()` computes an **achievable peak** by clamping the goal-time-derived peak to what the ramp rate can reach in the available pre-taper weeks:

```
aspirationalPeakKm = computeGoalPeakMileage(distance, goalMinutes)?.high
                     ?? MILEAGE_RANGE_HIGH[weeklyMileageRange]

preTaperWeeks = totalWeeks - 3   // taper is always 3 weeks minimum

achievablePeakKm = startingVolumeKm × (1 + rampRatePerWeek)^preTaperWeeks

constraints.peakWeeklyKm = Math.min(aspirationalPeakKm, achievablePeakKm)
```

The plan uses `constraints.peakWeeklyKm` (achievable), not the raw aspirational value. This ensures the plan is sound. The feasibility warning explains the gap if one exists.

`preTaperWeeks` is not stored in `PlanConstraints` — it is a local variable in `computeConstraints()`, derived as `totalWeeks - 3`. `computeConstraints()` does not call `computePhases()` internally; it uses the fixed 3-week taper minimum as the approximation. The actual phase boundary used downstream remains `computePhases()` output.

### Feasibility Warning Logic

```
achievableLongRunKm = achievablePeakKm × longRunMaxFraction

if totalWeeks < minimumPlanWeeks:
  → "Not enough weeks — [distance] preparation requires at least [N] weeks"

if achievableLongRunKm < 26 km AND distance === "full":
  → "Long run will only reach ~[X] km — consider a later race or higher starting mileage"

if achievableLongRunKm < 16 km AND distance === "half":
  → "Long run will only reach ~[X] km — consider a later race or higher starting mileage"
```

Both conditions can fire simultaneously. `null` if the plan is sound.

### Feasibility Warning Display

The warning is returned by the API in the plan response and displayed on the **final confirmation screen** (after all onboarding steps, before "Build My Plan"). It is not computed client-side during step 4. The final screen already exists (`final-screen.tsx`) and is where the API response is consumed — no client-side constraint computation is needed.

### Interval Slot Behaviour for First-Timers

When `constraints.allowIntervals === false`, the Build early phase has its interval slot dropped entirely — the week has 1 quality session (tempo), not 2. This is consistent with `constraints.maxQualitySessions === 1` for first-timers. The interval slot is not replaced with a second tempo. The `workout-placement.ts` logic should filter out any `types` entry of `"intervals"` before counting sessions when `allowIntervals` is false.

### Changes to Existing Functions

| File | Change |
|------|--------|
| `workout-scheduler.ts` | Replace hardcoded `0.35` with `constraints.longRunMaxFraction`; skip strength placement if `constraints.includeStrength === false`; skip interval slot if `constraints.allowIntervals === false` |
| `training-parameters.ts` | `computeTrainingStructure` no longer owns `maxQualitySessions` for the first-timer case — constraints owns it |
| `volume-progression.ts` | Use `constraints.rampRatePerWeek` instead of pure linear interpolation; export `WEEK1_VOLUME_KM` as canonical starting volume |
| `constants.ts` | Delete `STARTING_VOLUME_KM` (superseded by `WEEK1_VOLUME_KM`) |
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

## Implementation Notes

### `computeWeeklyVolumes` stays linear

`volume-progression.ts` keeps its linear interpolation (`startVol + (peak - startVol) × t`). It does not switch to compound growth. The ramp rate is used only inside `computeConstraints()` to calculate the feasibility ceiling (`achievablePeakKm`). The plan's actual weekly volumes just need to reach the clamped `constraints.peakWeeklyKm` — the linear progression already does this. No formula change to `computeWeeklyVolumes` is needed; only its input `peakWeeklyKm` changes (it now receives the clamped value from constraints).

### `MILEAGE_RANGE_HIGH` already exists in `route.ts`

The constant is already defined locally in `apps/web/app/api/generate-plan/route.ts` as `{ "under-40": 40, "40-60": 60, "60-80": 80, "80-plus": 120 }`. Move it to `packages/plan-engine/src/constraints.ts` so `computeConstraints()` can use it directly without the API route re-defining it.

### `maxQualitySessions` ownership in `SchedulerInput`

`SchedulerInput` currently carries `trainingStructure: TrainingStructure` which includes `maxQualitySessions`. After this change, `SchedulerInput` should also carry `constraints: PlanConstraints`. The quality count clamp in `workout-scheduler.ts` (line 263: `Math.min(sessions, trainingStructure.maxQualitySessions)`) should become `Math.min(sessions, constraints.maxQualitySessions)`. `trainingStructure.maxQualitySessions` is still computed by `computeTrainingStructure()` for experienced runners and can be removed from `TrainingStructure` if constraints always owns this value — or kept for reference.

### Feasibility warning display location

`final-screen.tsx` does not call the plan generation API — it stores to sessionStorage and navigates to `/plan`. The plan generation API is called from `/plan/page.tsx`. The feasibility warning is therefore displayed on the plan page after generation, not on the final confirmation screen. It appears as an inline callout above the plan calendar — not a blocking error, just informational. This is the simplest wiring path and matches the "not a blocker" intent.

---

## Out of Scope

- Pace zone changes for first-timers (same zones, less intense sessions)
- Changing training science principles or phase structure
- New workout types
- Half marathon-specific phase durations (existing phase planner handles distance already)
