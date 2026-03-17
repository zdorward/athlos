# Design: Race Week Generation & Blank Cell Fixes

**Date:** 2026-03-17
**Status:** Approved

---

## Problem

Two bugs in the training plan generator:

1. **Race week is empty.** The scheduler generates exactly `N = floor((raceDate - startDate) / 7)` weeks. The race date always falls 1–7 days after the last scheduled week. The race entry is injected as a single entry; the preceding 6 days of that week have no workouts or rest entries, producing a blank final week in the UI.

2. **Blank cells in bridge week.** `buildBridgeRuns` only emits easy runs for `selectedDays`. Non-selected days in the bridge period have no entry in `days[]`, so the calendar renders them as bare empty boxes instead of rest days.

---

## Fix 1 — Race Week

### Root cause

`totalWeeks = weeksBetween(startDate, raceDate)` excludes the week containing the race date. The scheduler never generates that week.

### Solution

**`apps/web/app/api/generate-plan/route.ts`**
- Change `totalWeeks = weeksBetween(startDate, raceDate) + 1`
- Pass `raceDateISO: input.race.date` in the `SchedulerInput`

**`packages/plan-engine/src/workout-scheduler.ts`**
- Add `raceDateISO: string` to `SchedulerInput`
- Detect the race week as `week === totalWeeks` (since `totalWeeks = weeksBetween + 1`, the race always falls in the last week)
- In the race week:
  - Skip the long run entirely (do not assign one to `longRunDay`). Without this, a long run falls 1–7 days before the race, which may be 1–2 days prior — not acceptable.
  - Skip quality sessions (already 0 for taper weeks, but make it explicit)
  - Distribute the remaining easy volume across all selected days except the race day
  - Race day gets assigned a rest entry, which the API route's existing race injection replaces with the race entry

### Why this works naturally

With `totalWeeks + 1`, `computePhases` assigns the last week to the Taper phase (taperIndex 2), giving it 40% of peak weekly volume (~40km for a 100km/week plan). Distributed across 4–5 selected days as easy runs (~6–8km each), this is correct race week tapering per the science doc ("Taper W2+: easy only").

The existing race entry injection in `route.ts` already replaces the race day workout with the race entry — no changes needed there.

### Impact on peakWeekKm

`peakWeekKm = Math.max(...weeklyVolumes)` takes the maximum across all weeks. The race week volume (~40km) is lower than peak training weeks, so it does not affect this value.

---

## Fix 2 — Blank Cells

### Root cause

Two separate places:

1. **`buildBridgeRuns`** only iterates `selectedDays`. Non-selected days in the bridge period are skipped entirely, leaving gaps in `days[]`.
2. **`plan-calendar.tsx`** renders an empty `<div>` when `dayMap[dow]` is undefined — a leftover from streaming-era code. It should show a rest day cell.

### Solution

**`packages/plan-engine/src/bridge-runs.ts`**
- For each day in the bridge period that is NOT in `selectedDays`, emit a `{ date, type: "rest" }` entry (same as the scheduler does for plan days).

**`apps/web/app/plan/plan-calendar.tsx`**
- Replace the empty placeholder `<div>` (rendered when `!entries?.length`) with a styled rest day cell showing "Rest Day" at `opacity-40`. This matches how assigned rest days are already styled.

---

## Files Changed

| File | Change |
|------|--------|
| `apps/web/app/api/generate-plan/route.ts` | `totalWeeks + 1`; pass `raceDateISO` |
| `packages/plan-engine/src/workout-scheduler.ts` | Add `raceDateISO` to input; race week logic |
| `packages/plan-engine/src/bridge-runs.ts` | Emit rest for non-selected bridge days |
| `apps/web/app/plan/plan-calendar.tsx` | Show "Rest Day" for missing days |

---

## Out of Scope

- Taper volume percentages (80/60/40) — current values are correct per the science doc
- Recovery week depth (70% of linear target) — science doc explicitly states this is acceptable
- Quality session types per phase — current PHASE_CONFIG matches the science doc

---

## Testing

- Unit test: race week (last week) contains 3–5 easy runs + no long run + no quality sessions
- Unit test: race day in race week gets a rest entry (replaced by race injection)
- Unit test: bridge runs include rest entries for non-selected days
- Integration: regenerate plan, verify last week has easy runs before race day
- Visual: verify no blank cells in bridge week or race week
