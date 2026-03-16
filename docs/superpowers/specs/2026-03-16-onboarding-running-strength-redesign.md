# Onboarding Redesign: Running Days + Strength Training

**Date:** 2026-03-16
**Scope:** Two onboarding steps redesigned for serious runners — `whichDays` and the merged strength step.

---

## Background

The current onboarding asks about running days and strength training in a way that assumes a beginner default: 5 running days selected additively, generic strength day picker with no guidance. The target audience is BQ-chasers running 5–7 days/week who expect the product to understand them. Both steps need to reflect that.

---

## Changes Overview

### 1. Step order

Current order:
```
findRace → goalTime → trainingAge → whichDays → strengthTraining → strengthDays → weeklyMileage
```

New order:
```
findRace → goalTime → trainingAge → whichDays → weeklyMileage → strength
```

- `weeklyMileage` moves before `strength` so the merged strength step can use both goal time and current mileage for its recommendation.
- `strengthTraining` and `strengthDays` collapse into a single `strength` step.

### 2. Data model

No changes to `OnboardingData`. `strengthTraining: boolean` and `strengthDays: Day[]` remain. The merged step sets both at once.

---

## `whichDays` Redesign

### Goal

Flip the framing from additive (select days you run) to subtractive (adjust from a smart default). The default assumption is 6 days/week, not 5.

### Preset tabs

Three tabs appear above the day picker: `5 days | 6 days | 7 days`. Default selection: **6 days**.

Selecting a preset auto-populates the day toggles with a smart default for that count:

| Preset | Default days | Long run default |
|--------|-------------|-----------------|
| 5 days | Mon, Tue, Thu, Fri, Sun | Sunday |
| 6 days | Mon, Tue, Wed, Thu, Fri, Sun | Sunday |
| 7 days | Mon, Tue, Wed, Thu, Fri, Sat, Sun | Sunday |

**6-day rationale:** Rest on Saturday preserves fresh legs before Sunday's long run — the standard Pfitzinger pattern.

Users can toggle individual days after selecting a preset. Switching presets resets to that preset's smart default.

### Long run default

Sunday is pre-selected as the long run day. It remains selected unless the user deselects Sunday or explicitly taps a different day. Behavior of the long run picker is otherwise unchanged.

### Copy changes

Subtitle changes from:
> "Pick the days you're available to run, then choose which one is your long run."

To:
> "Most serious runners train 6 days a week. Adjust to fit your schedule."

---

## Merged Strength Step (`strength`)

### Goal

Replace the two-step yes/no + day picker with a single step that shows a Pfitzinger-based recommendation up front, pre-populates the day picker with smart defaults, and lets the user accept or adjust.

### New helpers in `packages/ai/src`

**`recommendStrengthCount(peakMileageHigh: number | null, weeklyMileageRange: string): 1 | 2`**

Maps implied peak weekly volume to a recommended Base/Build lifting frequency:

| Condition | Recommendation |
|-----------|---------------|
| `peakMileageHigh >= 95` | 1 day |
| `peakMileageHigh < 95` | 2 days |
| `peakMileageHigh` is null, `weeklyMileageRange === "80-plus"` | 1 day |
| `peakMileageHigh` is null, all other ranges | 2 days |

`peakMileageHigh` is derived from `computeGoalPeakMileage(distance, goalMinutes)?.high ?? null`.

**`recommendStrengthDays(longRunDay: Day, count: number): Day[]`**

Returns `count` days maximally far from the long run day using circular distance (extending the logic in `peakStrengthDay`). Days are also spread apart from each other: after picking the first (farthest from long run), subsequent days are picked to maximise distance from both the long run day and already-selected days.

Example — Sunday long run, count 2: returns `["wed", "thu"]` (both 3 days from Sunday).

### UI structure

```
Strength training

Based on your goal, we suggest 2 lifting days during Base and Build.
This drops to 1 day in Peak and stops in Taper automatically.

[Mon]  [Wed ✓]  [Thu ✓]  [Fri]  [Sat]  [Sun]

[Continue]

[Skip strength training →]
```

- The recommendation line references the specific count derived from `recommendStrengthCount`.
- The day picker is pre-populated using `recommendStrengthDays`.
- User can toggle any day freely. Minimum 1 day to enable Continue (0 days → use Skip instead).
- **Continue** → `onNext({ strengthTraining: true, strengthDays: selected })`
- **Skip** → `onNext({ strengthTraining: false, strengthDays: [] })`

### Recommendation copy variants

| Recommended count | Banner text |
|------------------|------------|
| 1 day | "Your goal implies a high-volume peak — we suggest 1 lifting day to protect recovery. This stops in Taper." |
| 2 days | "Based on your goal and training volume, we suggest 2 lifting days during Base and Build. This drops to 1 in Peak and stops in Taper." |

---

## `onboarding-flow.tsx` Changes

### `getSteps()` (in `types.ts`)

```ts
// Before
["findRace", "goalTime", "trainingAge", "whichDays", "strengthTraining", "strengthDays", "weeklyMileage"]

// After
["findRace", "goalTime", "trainingAge", "whichDays", "weeklyMileage", "strength"]
```

### `STEP_LABELS`

- Remove `strengthTraining` and `strengthDays` entries.
- Add `strength: "Strength training"`.

### `advance` / `goBack`

Remove the skip-over logic that skipped `strengthDays` when `strengthTraining === false`. There is now only one strength step; no skipping needed.

### Step render switch

Replace:
```ts
case "strengthTraining": return <StepStrengthTraining {...stepProps} />
case "strengthDays":     return <StepStrengthDays {...stepProps} />
```

With:
```ts
case "strength": return <StepStrength {...stepProps} />
```

---

## Files Affected

| File | Change |
|------|--------|
| `apps/web/components/onboarding/types.ts` | Update `getSteps()` |
| `apps/web/components/onboarding/onboarding-flow.tsx` | Update labels, step render, remove skip logic |
| `apps/web/components/onboarding/steps/step-which-days.tsx` | Add preset tabs, update defaults and copy |
| `apps/web/components/onboarding/steps/step-strength-training.tsx` | Delete |
| `apps/web/components/onboarding/steps/step-strength-days.tsx` | Delete (replaced by StepStrength) |
| `apps/web/components/onboarding/steps/step-strength.tsx` | New file |
| `packages/ai/src/race-prompt.ts` | Add `recommendStrengthCount` and `recommendStrengthDays` |
| `apps/web/e2e/onboarding.spec.ts` | Update E2E test to reflect new step order and merged strength step |
