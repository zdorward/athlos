# Training Structure Design

**Date:** 2026-03-16
**Status:** Approved

## Problem

When a user selects all 7 available running days during onboarding, the plan generator honors that literally — scheduling runs every day except during recovery weeks. This violates best-practice marathon training structure (Pfitzinger, Daniels, Hansons), which prescribes rest days based on target mileage and goal time, not athlete availability.

The root cause: `buildPrompt()` passes `selectedDays` verbatim to the LLM, and the system prompt treats available days as days that must be filled. There is no mechanism to derive optimal weekly structure from goal time.

## Goal

Add a `computeTrainingStructure()` function that derives optimal weekly structure (run days/week, rest days/week, max quality sessions/week) from goal time and training age. Inject this as a "Prescribed training structure" block in the LLM user message, overriding raw availability with sport-science-backed constraints.

## Approach

**Goal time is the primary driver** of training structure. Current mileage remains the starting volume signal only. `selectedDays` remains the list of eligible days — the new structure block constrains how many of those days are actually used.

## `computeTrainingStructure()`

**Location:** `packages/ai/src/pace-calculator.ts`

**Signature:**
```ts
export function computeTrainingStructure(
  goalMinutes: number | null,
  distance: string,
  trainingAge: string
): { runDaysPerWeek: number; restDaysPerWeek: number; maxQualityPerWeek: number }
```

### Full Marathon Goal-Time Table

| Goal time | Run days/wk | Rest days/wk | Max quality/wk |
|-----------|-------------|--------------|----------------|
| Sub-2:30  | 7 | 0 | 3 |
| 2:30–2:45 | 7 | 1 | 2 |
| 2:45–3:10 | 6 | 1 | 2 |
| 3:10–3:45 | 6 | 1 | 2 |
| 3:45–4:30 | 5 | 2 | 1 |
| 4:30+     | 5 | 2 | 1 |

### Half Marathon

Same table with goal times scaled ~50% (e.g. sub-1:15 maps to the sub-2:30 full row).

| Goal time | Run days/wk | Rest days/wk | Max quality/wk |
|-----------|-------------|--------------|----------------|
| Sub-1:15  | 7 | 0 | 3 |
| 1:15–1:22 | 7 | 1 | 2 |
| 1:22–1:35 | 6 | 1 | 2 |
| 1:35–1:52 | 6 | 1 | 2 |
| 1:52–2:15 | 5 | 2 | 1 |
| 2:15+     | 5 | 2 | 1 |

### 5K / 10K

Same structure as full marathon by goal time bucket, but `maxQualityPerWeek` +1 (speed events require more intensity work), `runDaysPerWeek` capped at 6.

### Training Age Modifier

Applied after the goal-time lookup:
- `"under-1"`: subtract 1 from `maxQualityPerWeek` (min 1), cap `runDaysPerWeek` at 6
- `"1-3"` and `"3-or-more"`: no modifier

### No Goal Time Fallback

When goal time is not provided (finish-only objective), fall back to mileage range:

| Weekly mileage | Run days/wk | Rest days/wk | Max quality/wk |
|----------------|-------------|--------------|----------------|
| under-40 km/wk | 5 | 2 | 1 |
| 40–60 km/wk    | 6 | 1 | 1 |
| 60–80 km/wk    | 6 | 1 | 2 |
| 80+ km/wk      | 7 | 1 | 2 |

## Integration into `buildPrompt()`

**File:** `packages/ai/src/race-prompt.ts`

### User message

After the pace zones section, inject a new block:

```
Prescribed training structure (Pfitzinger-based — treat as hard constraints):
  Running days per week: <N>
  Rest days per week: <N> (place on the day that best aids recovery — typically before a quality session or after the long run)
  Max quality sessions per week: <N>
```

The existing `Available running days` line stays — it tells the LLM which days are eligible. The structure block tells it how many to actually use. If `runDaysPerWeek` is less than the number of `selectedDays`, the LLM designates the surplus days as rest, placed for optimal recovery.

### System prompt change

Update the existing hard constraint (line 101) from:

> "Only schedule runs on the athlete's available running days — days that are neither running days nor strength days must be type 'rest'"

To:

> "Only schedule runs on the athlete's available running days. Assign rest days to achieve the prescribed rest days per week — you may designate any available running day as rest if needed to hit this target. Days not in the available running days list (and not strength days) are always rest."

This removes the conflict where "available = must fill with a run."

## What Does Not Change

- `selectedDays` collection in onboarding — no UI changes
- Starting volume logic — current mileage range stays as the week 1 volume signal
- Phase structure, pace zones, 80/20 rule, quality session spacing rules
- Recovery week logic (every 4th week, 30% reduction)
