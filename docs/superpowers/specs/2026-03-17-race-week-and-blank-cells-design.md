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
- Change `totalWeeks = weeksBetween(startDate, raceDate) + 1`. This assignment must happen before `computePhases` and `scheduleWorkouts` are called — both must receive the updated `totalWeeks` so the phase boundaries and volume progression cover the race week.
- Pass `raceDateISO: input.race.date` in the `SchedulerInput`.
- Add minimum guard: `totalWeeks = Math.max(5, weeksBetween(startDate, raceDate) + 1)` to ensure there are enough weeks for `computePhases` to allocate valid phases (full/half marathon requires at least 3 taper + 3 peak + 1 other = 7, but 5 is a safe lower bound given existing validation that the race must be far enough out).

**`packages/plan-engine/src/workout-scheduler.ts`**
- Add `raceDateISO: string` to `SchedulerInput`.
- Detect the race week as `week === totalWeeks` (since `totalWeeks = weeksBetween + 1`, the race always falls in the last scheduled week).
- Derive `raceDayOfWeek` inside the race week loop by finding which entry in `weekDays` has `date === raceDateISO`. This is the date that must be excluded from easy run assignment.
- In the race week:
  - Skip the long run entirely. Without this, a long run lands on `longRunDay`, which may be 1–2 days before the race.
  - Skip quality sessions (explicit — do not rely solely on the taper phase config).
  - Distribute easy volume across selected days **excluding race day and the day immediately before race day** (running the day before a marathon is not acceptable).
  - Assign a `{ type: "rest" }` entry to race day. The API route's existing race injection (`days[raceDayIndex] = raceEntry`) will replace this rest with the race entry.
  - Non-selected days and the day before race day get rest entries as normal.

### Volume in race week

With `totalWeeks + 1`, `computePhases` allocates taper with `endWeek = totalWeeks` (3 weeks for full/half). The race week is the 4th taper week (taperIndex = 3). In `computeWeeklyVolumes`, the `else` branch in the taper logic (`pct = taperIndex === 0 ? 0.8 : taperIndex === 1 ? 0.6 : 0.4`) returns 0.4 for any `taperIndex >= 2`, including 3. So race week volume = 40% of peak, e.g. ~40km for a 100km/week plan. After excluding race day and the pre-race day, this distributes across 3–4 selected days as ~6–8km easy runs each — correct for race week.

### Impact on peakWeekKm

`peakWeekKm = Math.max(...weeklyVolumes)` is unaffected — race week volume (~40km) is below peak training weeks.

---

## Fix 2 — Blank Cells

### Root cause

Two separate places:

1. **`buildBridgeRuns`** only iterates `selectedDays`. Non-selected days in the bridge period are skipped entirely, leaving gaps in `days[]`.
2. **`plan-calendar.tsx`** renders a bare `<div>` when `dayMap[dow]` is undefined — a leftover from streaming-era code that should show a rest day cell.

### Solution

**`packages/plan-engine/src/bridge-runs.ts`**
- For each day in the bridge period that is NOT in `selectedDays`, emit a `{ date, type: "rest" }` entry — same as the scheduler does for plan days.

**`apps/web/app/plan/plan-calendar.tsx`**
- Replace the empty `<div>` placeholder (rendered when `!entries?.length`) with a non-interactive `<div>` styled identically to assigned rest day cells: `opacity-40`, border, date number visible, "Rest Day" label. Do not use a `<button>` — there is no workout to select.
- Retain this branch as a defensive fallback even after both upstream fixes are applied, since future changes could reintroduce gaps.
- The comment `"// Day not in plan yet (still streaming)"` is vestigial — update it to `"// Defensive fallback: day missing from plan data"`.

---

## Files Changed

| File | Change |
|------|--------|
| `apps/web/app/api/generate-plan/route.ts` | `totalWeeks + 1` with minimum guard; pass `raceDateISO` |
| `packages/plan-engine/src/workout-scheduler.ts` | Add `raceDateISO` to input; race week logic |
| `packages/plan-engine/src/bridge-runs.ts` | Emit rest for non-selected bridge days |
| `apps/web/app/plan/plan-calendar.tsx` | Show "Rest Day" `<div>` for missing days |

---

## Out of Scope

- Taper volume percentages (80/60/40) — current values are correct per the science doc
- Recovery week depth (70% of linear target) — science doc explicitly states this is acceptable
- Quality session types per phase — current PHASE_CONFIG matches the science doc

---

## Testing

- Unit test: race week (last week) contains no long run and no quality sessions
- Unit test: race day and the day immediately before race day in race week both get `type: "rest"` entries
- Unit test: easy runs in race week are distributed only across selected days excluding race day and pre-race day
- Unit test: race week total running volume (excluding the race entry) ≈ `peakWeeklyKm * 0.4` (within 2km rounding tolerance)
- Unit test: bridge runs include `type: "rest"` entries for non-selected days in bridge period
- Unit test: race on Monday — Sunday (day before race) is not assigned an easy run
- Integration: regenerate plan, verify last week has easy runs before race day
- Visual: verify no blank cells in bridge week or race week
