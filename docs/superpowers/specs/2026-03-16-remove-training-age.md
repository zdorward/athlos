# Remove Training Age from Onboarding

**Date:** 2026-03-16
**Scope:** Remove the `trainingAge` onboarding step and all downstream usage.

---

## Background

The `trainingAge` step asks users "How long have you been running consistently?" with options `under-1 / 1-3 / 3-or-more`. The app targets advanced runners chasing a qualifying time. In practice:

- `"1-3"` and `"3-or-more"` produce **identical output** in both `computeTrainingStructure` and `computeLongRunTargets`.
- Only `"under-1"` triggers modifiers (−1 quality session, cap at 6 run days, −3 km peak long run).
- No advanced runner targeting a BQ will answer `"under-1"`.

The step adds onboarding friction with zero effect on plan output for the target audience.

---

## Changes

### Step order

Before:
```
findRace → goalTime → trainingAge → whichDays → weeklyMileage → strength
```

After:
```
findRace → goalTime → whichDays → weeklyMileage → strength
```

### Data model

Remove `trainingAge` from `OnboardingData` in `apps/web/components/onboarding/types.ts`.

Remove `trainingAge` from `PlanGenerationInput` in `packages/ai/src/types.ts`.

### `computeTrainingStructure` and `computeLongRunTargets` tests (`packages/ai/src/pace-calculator.test.ts`)

Delete all `describe` blocks and individual test cases that:
- Pass a `trainingAge` argument to `computeTrainingStructure` or `computeLongRunTargets`, or
- Assert behavior specific to the `"under-1"` modifier (e.g. reduced `maxQualityPerWeek`, capped `runDaysPerWeek`, reduced `peakLongRunKm`).

This includes any equivalence tests that prove `"1-3"` and `"3-or-more"` produce the same output — those tests will be meaningless once the parameter is removed. Delete them rather than updating them.

Update remaining test calls to omit the `trainingAge` argument.

### `computeTrainingStructure` (`packages/ai/src/pace-calculator.ts`)

Remove `trainingAge: string | undefined` parameter. Remove the `"under-1"` branch entirely:

```ts
// Before
if (trainingAge === "under-1") {
  quality = Math.max(1, quality - 1)
  if (run > 6) { run = 6; rest += 1 }
}

// After — block removed
```

Update all call sites to omit the argument.

### `computeLongRunTargets` (`packages/ai/src/pace-calculator.ts`)

Remove `trainingAge: string | undefined` parameter. Remove the `"under-1"` branch:

```ts
// Before
if (trainingAge === "under-1") {
  peakLongRunKm = Math.max(13, peakLongRunKm - 3)
}

// After — block removed
```

Update all call sites to omit the argument.

### Plan page input parser (`apps/web/app/plan/page.tsx`)

Remove the `rawTrainingAge` block (lines 117–121) from the `parsePlanInput` function:

```ts
// Before
const rawTrainingAge = raw["trainingAge"] as string | undefined
const validTrainingAges = ["under-1", "1-3", "3-or-more"]
if (rawTrainingAge && validTrainingAges.includes(rawTrainingAge)) {
  input.trainingAge = rawTrainingAge as PlanGenerationInput["trainingAge"]
}

// After — block removed
```

### LLM prompt (`packages/ai/src/race-prompt.ts`)

Remove `trainingAgeLabel` lookup and the `Training age:` line from the Athlete profile section.

Remove `input.trainingAge` reference from the prompt builder.

### Onboarding UI

- Delete `apps/web/components/onboarding/steps/step-training-age.tsx`.
- Remove `trainingAge` from `getSteps()` in `apps/web/components/onboarding/types.ts`.
- Remove `trainingAge` from `STEP_LABELS` in `apps/web/components/onboarding/onboarding-flow.tsx`.
- Remove the `case "trainingAge":` from the step render switch in `onboarding-flow.tsx`.
- Remove the `StepTrainingAge` import.

---

## Files Affected

| File | Change |
|------|--------|
| `apps/web/components/onboarding/types.ts` | Remove `trainingAge` from `OnboardingData` and `getSteps()` |
| `apps/web/components/onboarding/onboarding-flow.tsx` | Remove from `STEP_LABELS`, step switch, and import |
| `apps/web/components/onboarding/steps/step-training-age.tsx` | Delete |
| `packages/ai/src/types.ts` | Remove `trainingAge` from `PlanGenerationInput` |
| `packages/ai/src/pace-calculator.ts` | Remove param + `"under-1"` branches from both functions |
| `packages/ai/src/pace-calculator.test.ts` | Delete `under-1` and equivalence describe blocks; update remaining calls to omit `trainingAge` |
| `apps/web/app/plan/page.tsx` | Remove `rawTrainingAge` block from input parser |
| `packages/ai/src/race-prompt.ts` | Remove `trainingAge` from prompt builder |
