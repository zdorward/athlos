# Scheduler Science Alignment Design

**Date:** 2026-03-17
**Status:** Approved

## Overview

Align the training plan scheduler with modern marathon science as documented in `docs/training-science/modern-marathon-science.md`. Three coordinated changes: (1) declarative phase config for quality sessions, (2) progression long run type for marathon-specific fatigue adaptation, and (3) onboarding mileage consistency awareness.

---

## Section 1: Declarative Phase Config for Quality Sessions

### Problem

The current `qualityCountAndTypes` function in `workout-scheduler.ts` uses an imperative switch/case that does not correctly implement the evidence-based periodization arc:

- Early Build should have **tempo + intervals** (VO2max as sharpener) but currently assigns tempo only
- Build/Base recovery weeks have **no quality session** but science supports 1 short session for advanced runners
- Peak correctly prioritizes MP but the code path is fragile and not clearly grounded in the phase config
- Recovery weeks in Peak should have 1 short tempo session (not 0) — science doc explicitly states "0 in taper recovery, 1 short in Base/Build recovery"; Peak is adjacent to Build, not Taper

### Design

Replace the imperative switch with a declarative `PHASE_CONFIG` constant:

```ts
const PHASE_CONFIG = {
  "General Fitness": { normal: { sessions: 0, types: [] },    recovery: { sessions: 0, types: [] } },
  "Base":            { normal: { sessions: 1, types: ["tempo"] }, recovery: { sessions: 1, types: ["tempo"] } },
  "Build":           {
    early: { normal: { sessions: 2, types: ["tempo", "intervals"] }, recovery: { sessions: 1, types: ["tempo"] } },
    late:  { normal: { sessions: 2, types: ["tempo", "mp"] },        recovery: { sessions: 1, types: ["tempo"] } },
  },
  "Peak":            { normal: { sessions: 2, types: ["mp", "tempo"] }, recovery: { sessions: 1, types: ["tempo"] } },
  "Taper":           {
    first: { normal: { sessions: 1, types: ["tempo"] }, recovery: { sessions: 0, types: [] } },
    rest:  { normal: { sessions: 0, types: [] },        recovery: { sessions: 0, types: [] } },
  },
}
```

**Recovery week detection:** A week is a recovery week when `weekNumber % 4 === 0` AND it is not the last pre-taper week. `computeWeeklyVolumes` returns `number[]` and does not expose this flag. The scheduler must re-derive it independently using the same formula:

```ts
const isRecovery = weekNumber % 4 === 0 && weekNumber !== preTaperWeeks
```

where `preTaperWeeks` is computed the same way as in `computeWeeklyVolumes`: `taperPhase ? taperPhase.startWeek - 1 : totalWeeks`.

**PHASE_CONFIG lookup path:** The lookup is always two steps: (1) resolve any sub-key (`early`/`late` for Build, `first`/`rest` for Taper), then (2) resolve `normal` or `recovery`. For non-split phases (`"General Fitness"`, `"Base"`, `"Peak"`), the config object has `normal` and `recovery` directly — no sub-key step is needed. Pseudocode:

```ts
const phaseEntry = phase === "Build" ? PHASE_CONFIG["Build"][earlyOrLate]
                 : phase === "Taper" ? PHASE_CONFIG["Taper"][firstOrRest]
                 : PHASE_CONFIG[phase]
const config = isRecovery ? phaseEntry.recovery : phaseEntry.normal
```

**Build split:** Determined by the week's position within the Build phase. Weeks in the first half of Build (`localIndex < Math.floor(buildLength / 2)`) are "early"; remainder are "late". Use `Math.floor` — this biases toward "early" config for odd-length Builds (e.g., 7-week Build: weeks 0–2 are early, weeks 3–6 are late).

**1-week Build edge case (behavioral change):** The existing code handles `buildLength === 1` as a special case returning `{ count: 1, types: ["tempo"] }`. The new `PHASE_CONFIG` replaces this: `Math.floor(1/2) === 0` means `localIndex === 0 >= 0` → "late" → `{ sessions: 2, types: ["tempo", "mp"] }`. This is a deliberate behavioral change: a single Build week immediately before Peak should focus on MP entry, not generic tempo. If the available running days cannot fit 2 quality sessions, the placement logic will schedule as many as fit.

**Quality session ordering:** Within each phase, the first listed type is primary (higher priority for placement on the best available day).

### Science Grounding

- Threshold (tempo) before VO2max: LT work builds the aerobic base first
- VO2max intervals in early/mid-Build as sharpener: raises ceiling after base is established
- MP dominant in Peak: final 6–8 weeks are marathon-specific per sub-elite plan analysis
- Recovery week quality for advanced runners: consistent with Athlos's target user profile

---

## Section 2: Progression Long Run Type

### Problem

The plan engine has no concept of a "progression long run" — where the final 25–30% of the run is at marathon pace (MP). These runs are the primary mechanism for building marathon-specific fatigue tolerance and are standard in all modern elite programs.

Currently, all long runs are scheduled as generic `"long"` type. Runners have no signal about when to include MP work.

### Design

**New WorkoutType:** `"progression"` — a long run with the final 25–30% at marathon pace.

**Scheduling rules:**
- **Build phase:** Every 3rd long run is a progression run (`localIndex % 3 === 2`)
- **Peak phase:** Every other long run is a progression run (`localIndex % 2 === 1`)
- **Base, General Fitness, Taper:** All long runs are standard `"long"`

**Display:** The plan UI labels these "Progression Run" with a note: "Last 25–30% at marathon pace."

**Science grounding:** ~25% of long runs with MP segments is coaching consensus supported by physiology. The Build→Peak progression from "every 3rd" to "every other" reflects the increasing marathon specificity as race day approaches.

### Implementation Notes

- `WorkoutType` union in `packages/plan-engine/src/types.ts` adds `"progression"`
- `scheduleWorkouts` in `workout-scheduler.ts` tracks `longRunLocalIndex` per phase and applies the rule
- Plan display components (`PlanCalendar`, `PlanFeed`, day detail) handle `"progression"` type with appropriate label and description

---

## Section 3: Onboarding Mileage Awareness

### Problem

Currently the onboarding flow has no sense of how long a runner has been training at their stated mileage. A runner who "runs 60–80 miles/week" but only started 3 weeks ago is very different from one who has maintained that volume for 6+ months.

Additionally, when a runner's goal time implies a peak training volume far above their starting mileage (>1.5× multiplier), the plan asks them to ramp dramatically — a volume spike associated with injury risk — with no warning.

### Design

**New onboarding step: `StepMileageConsistency`**

Inserted after `StepWeeklyMileage`. Single question:

> "How long have you been training at this weekly mileage?"

Options:
- Less than 4 weeks
- 4–12 weeks
- 3–6 months
- 6+ months

This is stored as `mileageConsistency: "lt-4w" | "4-12w" | "3-6m" | "6m-plus"` in `OnboardingData`. It is metadata only for now — future adaptive logic can use it to adjust ramp rate or flag high-risk plans.

**Inline mileage gap warning in `StepWeeklyMileage`**

When the selected mileage range's lower bound × 1.5 < the goal-implied peak weekly km, show an inline warning (yellow/amber, not blocking):

> "Your goal time implies peak training weeks of ~{X} km — about {Y}× your current volume. Your plan will ramp gradually, but this is an ambitious build. Consider extending your plan start date for more ramp time."

**Auto-advance interaction:** `StepWeeklyMileage` currently auto-advances 150ms after a selection (no confirm button). When the warning condition is met, this auto-advance behavior must be suppressed: instead of calling `onNext` after the timeout, render the inline warning and a "Continue" button that the user must tap to proceed. When there is no warning, the existing auto-advance behavior is preserved. This is the only change to the component's interaction model.

**Computation:**

`startingVol` is the lower bound of the selected mileage range **in kilometers** — these values match `WEEK1_VOLUME_KM` in `volume-progression.ts` and are always km regardless of the user's display units. The comparison is km vs. km throughout. Define this constant directly in `step-weekly-mileage.tsx` (do not import from `route.ts`, which is a server-only API file):

```ts
const MILEAGE_RANGE_LOW_KM: Record<string, number> = {
  "under-40": 30,
  "40-60": 40,
  "60-80": 60,
  "80-plus": 80,
}
```

`peakWeeklyKm` is derived from `computeGoalPeakMileage(distance, goalMinutes).high`. `computeGoalPeakMileage` is exported from `@workspace/plan-engine` (see `packages/plan-engine/src/index.ts`) — it is a pure function with no Node.js dependencies and is safe to import in a `"use client"` component. The `.high` value is used because it represents the upper end of the recommended peak volume — the worst-case ramp scenario. If `computeGoalPeakMileage` returns `null` (no goal time set), the warning is not shown.

The warning triggers when `peakWeeklyKm > startingVol * 1.5`.

### Files affected

- `apps/web/components/onboarding/types.ts` — add `mileageConsistency` to `OnboardingData`
- `apps/web/components/onboarding/steps/step-mileage-consistency.tsx` — new step component
- `apps/web/components/onboarding/steps/step-weekly-mileage.tsx` — add gap warning logic
- `apps/web/components/onboarding/onboarding-flow.tsx` — insert new step in flow

---

## Files to Modify

| File | Change |
|------|--------|
| `packages/plan-engine/src/types.ts` | Add `"progression"` to `WorkoutType` union |
| `packages/plan-engine/src/workout-scheduler.ts` | Replace `qualityCountAndTypes` with declarative `PHASE_CONFIG`; add progression long run logic |
| `apps/web/components/onboarding/types.ts` | Add `mileageConsistency` field to `OnboardingData`; add `"mileageConsistency"` to the `getSteps()` return array (after `"weeklyMileage"`) |
| `apps/web/components/onboarding/steps/step-mileage-consistency.tsx` | New step component |
| `apps/web/components/onboarding/steps/step-weekly-mileage.tsx` | Add inline gap warning |
| `apps/web/components/onboarding/onboarding-flow.tsx` | Insert `StepMileageConsistency` step; add `"mileageConsistency"` entry to `STEP_LABELS`; add `case "mileageConsistency": return <StepMileageConsistency {...stepProps} />` to `renderStep()` switch |
| `apps/web/app/plan/` display components | Handle `"progression"` WorkoutType in labels/descriptions |

---

## Out of Scope

- Adaptive plan regeneration based on mileage consistency (future)
- Adjusting ramp rate based on consistency answer (future)
- Changing the 4-week recovery cycle cadence
- Half-marathon plan differences (use same phase config for now)
