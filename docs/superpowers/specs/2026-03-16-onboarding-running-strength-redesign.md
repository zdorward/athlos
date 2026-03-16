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

Users can toggle individual days after selecting a preset. Switching presets resets both the day toggles **and the long run day** to that preset's smart default (Sunday).

### Long run default

Sunday is pre-selected as the long run day on every preset. If the user manually moves the long run to a different day and then switches presets, the long run resets to Sunday along with the day toggles.

### Copy changes

Subtitle changes from:
> "Pick the days you're available to run, then choose which one is your long run."

To:
> "Most serious runners train 6 days a week. Adjust to fit your schedule."

---

## Merged Strength Step (`strength`)

### Goal

Replace the two-step yes/no + day picker with a single step that shows a Pfitzinger-based recommendation up front, pre-populates the day picker with smart defaults, and lets the user accept or adjust.

### New helpers in `packages/ai/src/strength-recommendation.ts`

These are training recommendation utilities, kept separate from `race-prompt.ts` to maintain single responsibility.

---

**`recommendStrengthCount`**

```ts
function recommendStrengthCount(
  peakMileageHigh: number | null,
  weeklyMileageRange: "under-40" | "40-60" | "60-80" | "80-plus",
): 1 | 2
```

Maps implied peak weekly volume to a recommended Base/Build lifting frequency:

| Condition | Recommendation |
|-----------|---------------|
| `peakMileageHigh !== null && peakMileageHigh >= 95` | 1 day |
| `peakMileageHigh !== null && peakMileageHigh < 95` | 2 days |
| `peakMileageHigh === null && weeklyMileageRange === "80-plus"` | 1 day |
| `peakMileageHigh === null`, all other ranges | 2 days |

**Caller derivation:** `peakMileageHigh` is obtained as:
```ts
const goalMinutes = goalTime ? goalTime.hours * 60 + goalTime.minutes : null
const peakMileageHigh = goalMinutes !== null
  ? (computeGoalPeakMileage(race.distance, goalMinutes)?.high ?? null)
  : null
```

---

**`recommendStrengthDays`**

```ts
function recommendStrengthDays(longRunDay: Day, count: number): Day[]
```

Returns `count` days from the full 7-day week, ranked by circular distance from `longRunDay`, descending. Ties broken by `DAY_INDEX` value (Sun=0, Mon=1 … Sat=6 — lower index wins).

**Algorithm:**
1. Compute circular distance for each of the 7 days: `min(|idx - longIdx|, 7 - |idx - longIdx|)`.
2. Sort all days descending by circular distance; break ties by ascending day index.
3. Return the first `count` days from the sorted list.

**Example — Sunday long run (`longIdx = 0` per `DAY_INDEX`), count 2:**

| Day | DAY_INDEX | Circular distance from Sun (idx=0) |
|-----|-----------|-----------------------------------|
| Thu | 4 | 3 |
| Wed | 3 | 3 |
| Tue | 2 | 2 |
| Fri | 5 | 2 |
| Mon | 1 | 1 |
| Sat | 6 | 1 |
| Sun | 0 | 0 |

Top 2 by distance desc, tiebreak by `DAY_INDEX` asc: **Wed (idx=3, dist=3), Thu (idx=4, dist=3)** → returns `["wed", "thu"]`.

---

### UI structure

```
Strength training

Based on your goal, we suggest 2 lifting days during Base and Build.
This drops to 1 day in Peak and stops in Taper automatically.

[Mon]  [Wed ✓]  [Thu ✓]  [Fri]  [Sat]  [Sun]

[Continue]

[Skip strength training →]
```

- The recommendation line references the specific count from `recommendStrengthCount`.
- The day picker is pre-populated using `recommendStrengthDays`.
- User can toggle any day freely.
- **Continue button** is disabled (greyed out, no tooltip needed) when 0 days are selected. Helper text below the picker reads: *"Select at least one day, or skip strength training below."* — visible only when 0 days are selected.
- **Continue** → `onNext({ strengthTraining: true, strengthDays: selected })`
- **Skip** → `onNext({ strengthTraining: false, strengthDays: [] })`

### Recommendation copy variants

| Recommended count | Banner text |
|------------------|------------|
| 1 day | "Your goal implies a high-volume peak — we suggest 1 lifting day to protect recovery. This stops in Taper." |
| 2 days | "Based on your goal and training volume, we suggest 2 lifting days during Base and Build. This drops to 1 in Peak and stops in Taper." |

---

## `types.ts` Changes

### `getSteps()`

```ts
// Before
["findRace", "goalTime", "trainingAge", "whichDays", "strengthTraining", "strengthDays", "weeklyMileage"]

// After
["findRace", "goalTime", "trainingAge", "whichDays", "weeklyMileage", "strength"]
```

## `onboarding-flow.tsx` Changes

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
| `apps/web/components/onboarding/onboarding-flow.tsx` | Update `STEP_LABELS`, step render, remove skip logic |
| `apps/web/components/onboarding/steps/step-which-days.tsx` | Add preset tabs, update defaults and copy |
| `apps/web/components/onboarding/steps/step-strength-training.tsx` | Delete |
| `apps/web/components/onboarding/steps/step-strength-days.tsx` | Delete (replaced by StepStrength) |
| `apps/web/components/onboarding/steps/step-strength.tsx` | New file |
| `packages/ai/src/strength-recommendation.ts` | New file — `recommendStrengthCount` and `recommendStrengthDays` |
| `apps/web/e2e/onboarding.spec.ts` | Update E2E test to reflect new step order and merged strength step |
