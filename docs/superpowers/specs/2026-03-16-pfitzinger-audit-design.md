# Pfitzinger Prompt Audit Design

**Date:** 2026-03-16
**Status:** Approved

## Problem

The race prompt is Pfitzinger-inspired but has four concrete gaps that BQ-chaser users will notice:

1. **Recovery week every 4th week** — Pfitz uses every 3rd week. The current hard constraint is wrong.
2. **No long run distance ceiling** — without a cap, the LLM may generate a 32 km long run in a 55 km week (58% of weekly volume), which no Pfitz plan does.
3. **Day-after-long-run allows full easy runs** — "rest or easy only" permits an 18 km easy run the day after a 35 km long run. Pfitz's day-after is a short recovery run (7–10 miles).
4. **Medium-long run blocked after long run** — the current "easy only" wording may cause the LLM to exclude medium-long runs from the day after the long run. Pfitz's Sunday-after-Saturday medium-long pattern is a core structural feature for experienced runners.

## Goal

Close the four gaps using computed values injected into the user message (same pattern as `computeTrainingStructure`) plus two minimal system prompt text edits. Target: plans that a runner familiar with Pfitz's 18/55 and 18/70 schedules would recognise as legitimate.

## Approach

**Code-side computation for gaps 2–3.** A new `computeLongRunTargets()` function derives `peakLongRunKm` and `recoveryRunMaxKm` from distance and peak weekly volume. Injected as specific numbers — the LLM reads a value, not a percentage formula.

**System prompt text edits for gaps 1 and 4.** Both are one-line changes.

## `computeLongRunTargets()`

**Location:** `packages/ai/src/pace-calculator.ts`

**Signature:**
```ts
export function computeLongRunTargets(
  distance: string,
  peakWeeklyKm: { low: number; high: number } | null,
  trainingAge: string | undefined,
): { peakLongRunKm: number; recoveryRunMaxKm: number }
```

`peakWeeklyKm` comes from `computeGoalPeakMileage()` which is already called in `buildPrompt()`. No new inputs needed at the call site.

### Full Marathon Lookup (by `peakWeeklyKm.high`)

Derived from Pfitz 18/55 (88 km/week, 22-mile long run) and 18/70 (113 km/week, 24-mile long run):

| peakWeeklyKm.high | peakLongRunKm | recoveryRunMaxKm |
|-------------------|--------------|-----------------|
| < 65              | 29            | 11               |
| < 90              | 35            | 13               |
| < 116             | 38            | 16               |
| ≥ 116             | 38            | 16               |

### Half Marathon Lookup

Derived from Pfitz "Road Racing for Serious Runners":

| peakWeeklyKm.high | peakLongRunKm | recoveryRunMaxKm |
|-------------------|--------------|-----------------|
| < 50              | 19            | 9                |
| < 75              | 22            | 11               |
| ≥ 75              | 26            | 13               |

### 5K / 10K

Use a simplified lookup by `peakWeeklyKm.high`:

| peakWeeklyKm.high | peakLongRunKm | recoveryRunMaxKm |
|-------------------|--------------|-----------------|
| < 45              | 11            | 7                |
| < 65              | 13            | 8                |
| ≥ 65              | 16            | 10               |

### Ultra

Conservative defaults regardless of `peakWeeklyKm`: `peakLongRunKm: 32`, `recoveryRunMaxKm: 14`.

### No Goal Time (peakWeeklyKm is null)

Use the mid-range row for each distance:
- full: `{ peakLongRunKm: 35, recoveryRunMaxKm: 13 }`
- half: `{ peakLongRunKm: 22, recoveryRunMaxKm: 11 }`
- 5k / 10k: `{ peakLongRunKm: 13, recoveryRunMaxKm: 8 }`
- ultra: `{ peakLongRunKm: 32, recoveryRunMaxKm: 14 }`
- unknown distance: `{ peakLongRunKm: 29, recoveryRunMaxKm: 11 }`

### Training Age Modifier

Applied after the distance lookup, before returning:
- `trainingAge === "under-1"`: `peakLongRunKm = Math.max(13, peakLongRunKm - 3)`. No change to `recoveryRunMaxKm`.
- All other values (including `undefined`): no modifier.

## Integration into `buildPrompt()`

**File:** `packages/ai/src/race-prompt.ts`

### Call site

After the existing `computeTrainingStructure` call (around line 234), add:

```ts
// ── Long run targets ─────────────────────────────────────────────────────
const longRunTargets = computeLongRunTargets(
  distance,
  peakMileage,
  input.trainingAge,
)
```

`peakMileage` is already computed on line 225.

### User message injection

Inject immediately after the "Prescribed training structure" block (section 5b), before the "Available running days" line (section 6):

```
Long run targets (Pfitzinger-based — treat as hard constraints):
  Peak long run: ~X km (build toward this in Peak phase — do not exceed)
  Day-after-long-run max: Y km (easy recovery or medium-long — never quality)
```

Where X = `longRunTargets.peakLongRunKm` and Y = `longRunTargets.recoveryRunMaxKm`.

## System Prompt Changes

**File:** `packages/ai/src/race-prompt.ts`, inside `buildSystemPrompt()`

### Change 1 — Recovery week frequency (Hard Constraints, current line 103)

From:
```
- Follow the 10% weekly mileage increase rule; include a recovery week (30% mileage reduction) every 4th week
```
To:
```
- Follow the 10% weekly mileage increase rule; include a recovery week (30% mileage reduction) every 3rd week
```

### Change 2 — Day-after-long-run rule (Weekly Structure Rules, current line 63)

From:
```
- The day after the long run must be rest or easy only
```
To:
```
- The day after the long run must be rest, an easy recovery run (≤ the day-after-long-run max from the user message), or a medium-long run for athletes with 1–3 or 3-or-more years of running — never a quality session
```

## What Does Not Change

- Phase structure, phase-specific workout guidance
- 80/20 rule and quality session limits
- Training age modifiers (those live in `computeTrainingStructure`)
- Pace zones, goal pace, volume targets
- Week schedule format and date handling
