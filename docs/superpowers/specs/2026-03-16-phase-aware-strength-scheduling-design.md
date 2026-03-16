# Phase-Aware Strength Scheduling — Design Spec

**Date:** 2026-03-16
**Status:** Approved

---

## Overview

Two related fixes:

1. **Prompt contradiction fix** — `strength` is listed as a valid workout type in the system prompt but the LLM is explicitly told never to emit it. Remove the contradiction.

2. **Phase-aware strength scheduling** — Pfitzinger prescribes reducing supplementary (strength) training as the race approaches: full program in Base/Build, one session in Peak, eliminated in Taper. The current `mergeStrengthDays` stamps the same strength days every week regardless of phase. Update it to match Pfitzinger's prescription.

The prompt and the merge function must stay in sync — the LLM is told exactly what the merge function will produce.

---

## Changes

### `packages/ai/src/race-prompt.ts`

#### 1. System prompt — remove `strength` from valid types

Remove the `strength` entry from "Valid Workout Types":

Old:
```
- strength    — no distanceKm
- rest        — full rest, no distanceKm
```

New:
```
- rest        — full rest, no distanceKm
```

#### 2. System prompt — fix `targetPace` exception line

Old:
```
Every workout except rest and strength MUST have a targetPace matching the zone label exactly as given in the user message.
```

New:
```
Every workout except rest MUST have a targetPace matching the zone label exactly as given in the user message.
```

#### 3. User message — replace single-line strength constraint with phase-specific block

Old (when athlete has strength training):
```
Strength training days: Wednesday, Saturday — treat these as heavy days; do not schedule quality running sessions (tempo, intervals, race pace) on these days. The strength schedule is already defined and will be merged into the final output separately — do not emit any strength type lines.
```

New (phase-specific):
```
Strength training (managed externally — do not emit strength type lines):
  General Fitness, Base, Build: Wednesday, Saturday — heavy days; no quality sessions (tempo, intervals, mp) on these days
  Peak: Wednesday only — heavy day; no quality sessions on this day
  Taper: no strength training — all days available for quality sessions
```

The days shown depend on the athlete's chosen strength days and race. The "Peak" line shows only the day furthest from the long run day (see `peakStrengthDay` helper below). If the athlete has only one strength day, the Peak line shows that same day (no change).

When the athlete has no strength training, the existing `"Strength training: none"` line is unchanged.

#### 4. New exported helper — `peakStrengthDay`

Add and export a pure function:

```ts
export function peakStrengthDay(strengthDays: string[], longRunDay: string): string | null {
  if (strengthDays.length === 0) return null
  if (strengthDays.length === 1) return strengthDays[0]!

  const DAY_INDEX: Record<string, number> = {
    sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
  }
  const longIdx = DAY_INDEX[longRunDay] ?? 0

  function circularDistance(day: string): number {
    const idx = DAY_INDEX[day] ?? 0
    const diff = Math.abs(idx - longIdx)
    return Math.min(diff, 7 - diff)
  }

  return strengthDays.reduce((best, day) =>
    circularDistance(day) >= circularDistance(best) ? day : best
  )
}
```

This is exported so `apps/web/app/plan/page.tsx` can import and use the same logic as the prompt builder — single source of truth.

---

### `apps/web/app/plan/page.tsx`

#### 5. Update `mergeStrengthDays` to be phase-aware

Add `phases` and `longRunDay` parameters. For each date, compute the week number, look up the phase, and apply the Pfitzinger schedule:

- **General Fitness, Base, Build** — all user-specified strength days
- **Peak** — `peakStrengthDay(strengthDays, longRunDay)` only (1 day, furthest from long run)
- **Taper** — no strength days

New signature:
```ts
function mergeStrengthDays(
  days: WorkoutDay[],
  strengthDays: string[],
  longRunDay: string,
  startDate: Date,
  endDate: Date,
  phases: PhaseEntry[],
): WorkoutDay[]
```

Phase lookup: given a date `d` and `startDate`, `weekNum = Math.floor((d.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1`. Find the `PhaseEntry` where `startWeek <= weekNum <= endWeek`. If no phase matches (shouldn't happen), default to including all strength days.

Phase name matching is case-insensitive. Recognised taper names: `"Taper"`. Recognised peak names: `"Peak"`. All other phases (General Fitness, Base, Build) use the full strength schedule.

#### 6. Update call site

The call to `mergeStrengthDays` (line ~314) currently passes 4 arguments. Add `planInput.longRunDay` and `trainingPlan.phases` (both already in scope). If `trainingPlan.phases` is undefined (backward compatibility with old snapshots), fall back to all strength days every week (current behaviour).

---

## Files

- Modify: `packages/ai/src/race-prompt.ts`
- Modify: `apps/web/app/plan/page.tsx`

---

## Out of Scope

- DB schema changes
- Changes to `WorkoutType` — `"strength"` stays (needed for display and logging)
- Saved plans are not retroactively updated
- Strength description text ("Strength training") is unchanged
- `apps/web/app/(app)/plan/[id]/page.tsx` — saved plans already have strength merged in; no changes needed there
