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
  trainingAge: string | undefined,
  selectedDaysCount: number
): { runDaysPerWeek: number; restDaysPerWeek: number; maxQualityPerWeek: number }
```

`trainingAge` may be `undefined` — treat as `"1-3"` (consistent with how `buildPrompt()` already defaults it).

### Full Marathon Goal-Time Table

| Goal time | Run days/wk | Rest days/wk | Max quality/wk |
|-----------|-------------|--------------|----------------|
| Sub-2:30  | 7 | 0 | 3 |
| 2:30–2:45 | 7 | 0 | 2 |
| 2:45–3:10 | 6 | 1 | 2 |
| 3:10–3:45 | 6 | 1 | 2 |
| 3:45–4:30 | 5 | 2 | 1 |
| 4:30+     | 5 | 2 | 1 |

### Half Marathon

| Goal time | Run days/wk | Rest days/wk | Max quality/wk |
|-----------|-------------|--------------|----------------|
| Sub-1:15  | 7 | 0 | 3 |
| 1:15–1:22 | 7 | 0 | 2 |
| 1:22–1:35 | 6 | 1 | 2 |
| 1:35–1:52 | 6 | 1 | 2 |
| 1:52–2:15 | 5 | 2 | 1 |
| 2:15+     | 5 | 2 | 1 |

### 5K / 10K

Use the full marathon goal-time table as a base, then apply:
- `maxQualityPerWeek` +1 (speed events require more intensity work)
- `runDaysPerWeek` capped at 6; if the cap reduces `runDaysPerWeek`, increment `restDaysPerWeek` by 1

### Ultra

Fall through to the mileage-range fallback regardless of whether a goal time is present (consistent with `computeGoalPeakMileage()` returning null for ultra).

### Training Age Modifier

Applied after the goal-time lookup, before the `selectedDaysCount` clamp:
- `"under-1"` (or `undefined` treated as `"1-3"`): subtract 1 from `maxQualityPerWeek` (min 1), cap `runDaysPerWeek` at 6; if the cap reduces `runDaysPerWeek`, increment `restDaysPerWeek` by 1
- `"1-3"` and `"3-or-more"`: no modifier

### `selectedDaysCount` Clamp

After all modifiers, clamp:
```ts
runDaysPerWeek = Math.min(runDaysPerWeek, selectedDaysCount)
```

This handles the case where the athlete selected fewer days than the structure prescribes. `restDaysPerWeek` is not adjusted — the LLM simply has fewer eligible days to work with and the structure constraints still apply as a ceiling.

### No Goal Time Fallback

When goal time is not provided and distance is not ultra, fall back to mileage range:

| Weekly mileage | Run days/wk | Rest days/wk | Max quality/wk |
|----------------|-------------|--------------|----------------|
| under-40 km/wk | 5 | 2 | 1 |
| 40–60 km/wk    | 6 | 1 | 1 |
| 60–80 km/wk    | 6 | 1 | 2 |
| 80+ km/wk      | 7 | 0 | 2 |

## Integration into `buildPrompt()`

**File:** `packages/ai/src/race-prompt.ts`

### User message injection point

Inject the new block **between the pace zones section (section 5) and the `Available running days` line (section 6)**. This gives the LLM the structural constraints before it reads the eligible day list.

```
Prescribed training structure (Pfitzinger-based — treat as hard constraints):
  Running days per week: <N>
  Rest days per week: <N> (place on the day that best aids recovery — typically before a quality session or after the long run; never designate the long run day as rest)
  Max quality sessions per week: <N>
```

The existing `Available running days` line stays — it tells the LLM which days are eligible. The structure block tells it how many to actually use. If `runDaysPerWeek` is less than `selectedDaysCount`, the LLM designates surplus days as rest, placed for optimal recovery.

### System prompt change

Update the existing hard constraint (line 101) from:

> "Only schedule runs on the athlete's available running days — days that are neither running days nor strength days must be type 'rest'"

To:

> "Only schedule runs on the athlete's available running days. Assign rest days to achieve the prescribed rest days per week — you may designate any available running day as rest if needed to hit this target, except the long run day which must always remain a run day. Days not in the available running days list (and not strength days) are always rest."

This removes the conflict where "available = must fill with a run."

## Strength Days: Remove from LLM Output, Merge in Code

Currently the LLM emits `type: "strength"` lines for each strength day. This is unnecessary — the user already defined the strength schedule explicitly, so the LLM is just repeating it back, introducing a source of potential errors (skipped days, wrong placement).

### Change

**Remove strength day output from the LLM entirely.** The LLM still receives the strength schedule as input (so it can avoid placing quality sessions on heavy strength days), but it no longer outputs `type: "strength"` lines.

**Post-generation merge in code** (in the plan save/parse logic): after streaming the LLM response, inject `type: "strength"` entries for each strength day in each week. The strength day entries have no `distanceKm` and a fixed description of "Strength training".

For days that are both a running day and a strength day, the run entry comes from the LLM as normal — the strength entry is appended by the merge step.

### Files affected

**`packages/ai/src/race-prompt.ts` — two changes:**

1. **System prompt:** Remove lines 103–104 entirely. Current text (from `packages/ai/src/race-prompt.ts`):
   ```
   - Strength training NEVER replaces a run. If a day appears in both the running days list AND the strength days list, emit TWO lines for that date: the run workout first, then a strength line. The run is determined by the training plan as normal; strength is always additive.
   - If a strength day is NOT a running day, emit a single "strength" type line for that date (no run, no distanceKm)
   ```
   Delete both lines entirely — no replacement text. The LLM simply no longer emits strength entries.

2. **User message:** The current strength schedule block (lines 306–317) reads:
   ```
   Strength training days: Monday, Wednesday
     → Days with BOTH a run AND strength: Wednesday — emit TWO JSON lines...
     → Strength-only days (no run): Monday — emit ONE strength JSON line...
   ```
   Replace with:
   ```
   Strength training days: Monday, Wednesday — treat these as heavy days; do not schedule quality running sessions (tempo, intervals, race pace) on these days. The strength schedule is already defined and will be merged into the final output separately — do not emit any strength type lines.
   ```
   This retains quality-session-placement context while removing the output instruction.

**`apps/web/app/plan/page.tsx` — one new function:**

Add `mergeStrengthDays(days: WorkoutDay[], strengthDays: string[], startDate: Date, endDate: Date): WorkoutDay[]` as a module-level pure function (non-async, returns a new array — does not mutate `days`). If `strengthDays` is empty, return `days` unchanged.

**Call site:** Inside the `stream()` function's `done` block (around line 278), after `buildBridgeRuns` is applied and before `setStatus("complete")`. At that point `localDays` is the final set of LLM days (merged with any bridge runs). Call:

```ts
const finalDays = mergeStrengthDays(
  mergedDays,  // or localDays if no bridge runs
  planInput.strengthDays ?? [],
  new Date(localDays[0]!.date + "T00:00:00"),
  new Date(localDays[localDays.length - 1]!.date + "T00:00:00"),
)
```

`localDays` is accumulated in chronological order so `localDays[0].date` is the start and `localDays[localDays.length-1].date` is the end. Both `localDays[0].date` and the last element's `.date` are ISO strings (e.g. "2026-06-16"); append `T00:00:00` to force local-time parsing. Pass `finalDays` to both `setPlan` (replacing the days field) and `savePlanToServer` (as the `days` argument).

**`strengthDays` format:** Each element is a 3-letter lowercase day key ("mon", "tue", "wed", "thu", "fri", "sat", "sun") — this is the existing format used throughout the codebase (see `PlanGenerationInput.strengthDays` in `packages/ai/src/types.ts` and the `DAY_NAMES` map in `race-prompt.ts`). No normalization needed inside `mergeStrengthDays`.

**Date iteration algorithm:** Use a `for` loop with a local `Date` variable (do not mutate the `startDate` parameter): `const d = new Date(startDate.getTime())`. Increment with `d.setDate(d.getDate() + 1)` each iteration until `d > endDate`. For each date, map `d.getDay()` (0–6) to a key using `["sun","mon","tue","wed","thu","fri","sat"][d.getDay()]`. If the key is in `strengthDays`, inject a strength entry for that date. Format the ISO date string with `d.toLocaleDateString("en-CA")` (same pattern used throughout the codebase). Invalid or unrecognized keys in `strengthDays` are silently skipped.

**Strength day + long run day collision:** If a strength day coincides with the long run day, both entries exist in the output (run first, strength second). This is acceptable — the long run remains the primary workout; strength is supplemental. No special handling needed.

### Strength entry format

```ts
{
  date: "YYYY-MM-DD",   // ISO date string
  type: "strength",
  description: "Strength training"
  // distanceKm, targetPace, targetHR are optional in WorkoutDay and are omitted here
  // (confirmed: WorkoutDay in packages/ai/src/types.ts marks these fields as optional with ?)
}
```

## What Does Not Change

- `selectedDays` collection in onboarding — no UI changes
- Starting volume logic — current mileage range stays as the week 1 volume signal
- Phase structure, pace zones, 80/20 rule, quality session spacing rules
- Recovery week logic (every 4th week, 30% reduction)
