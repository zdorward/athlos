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

### Design

Replace the imperative switch with a declarative `PHASE_CONFIG` constant:

```ts
const PHASE_CONFIG = {
  "General Fitness": { sessions: 0, types: [] },
  "Base":            { sessions: 1, types: ["tempo"] },
  "Build":           {
    early: { sessions: 2, types: ["tempo", "intervals"] },
    late:  { sessions: 2, types: ["tempo", "mp"] },
  },
  "Peak":            { sessions: 2, types: ["mp", "tempo"] },
  "Taper":           {
    first: { sessions: 1, types: ["tempo"] },
    rest:  { sessions: 0, types: [] },
  },
}
```

**Build split:** Determined by the week's position within the Build phase. Weeks in the first half of Build are "early"; second half are "late". This implements the threshold-first, VO2max-as-sharpener, then MP-enters-late-Build arc from the science doc.

**Recovery weeks:** Advanced runners (Athlos target) get 1 short quality session (tempo) on recovery weeks during Base and early/late Build. Recovery weeks in Peak and Taper get 0 quality sessions.

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

The user can proceed; this is advisory only.

**Computation:** `peakWeeklyKm` is derived from `computeGoalPeakMileage(distance, goalMinutes)`. The warning triggers when `startingVol * 1.5 < peakWeeklyKm`.

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
| `apps/web/components/onboarding/types.ts` | Add `mileageConsistency` field to `OnboardingData` |
| `apps/web/components/onboarding/steps/step-mileage-consistency.tsx` | New step component |
| `apps/web/components/onboarding/steps/step-weekly-mileage.tsx` | Add inline gap warning |
| `apps/web/components/onboarding/onboarding-flow.tsx` | Insert `StepMileageConsistency` step |
| `apps/web/app/plan/` display components | Handle `"progression"` WorkoutType in labels/descriptions |

---

## Out of Scope

- Adaptive plan regeneration based on mileage consistency (future)
- Adjusting ramp rate based on consistency answer (future)
- Changing the 4-week recovery cycle cadence
- Half-marathon plan differences (use same phase config for now)
