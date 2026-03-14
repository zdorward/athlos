# Dashboard — Next Workout Redesign Spec

**Date:** 2026-03-14
**Status:** Approved

---

## Overview

Replace the fixed Today/Tomorrow sections on `/dashboard` with two dynamic sections — **Next Workout** (hero) and **Then** (preview) — that always show the next actionable workout regardless of whether the plan has started, there are rest days, or there are gaps in the schedule.

---

## Forward-Scan Logic

### `findNextWorkoutDay(days, fromDateISO)`

Scans `days` forward starting from `fromDateISO` (inclusive). Returns the first date string that has at least one entry with `type !== "rest"`. Returns `null` if no such date exists.

- `days` is the full `WorkoutDay[]` array from the plan.
- `fromDateISO` is an ISO date string (`YYYY-MM-DD`).
- Dates are compared as strings — ISO format sorts correctly lexicographically.
- Implementation: iterate `days`, group by date (or use the existing `byDate` map), check each date >= `fromDateISO` in ascending order for at least one non-rest entry.

### Hero date

`findNextWorkoutDay(plan.days, todayISO)`

### Then date

`findNextWorkoutDay(plan.days, addDays(heroDate, 1))` — use the existing `addDays` helper already present in `page.tsx`. Only computed if hero date is non-null.

---

## Label Logic

Import `format` and `parseISO` from `date-fns`. Given a date ISO string, compute the display label:

| Condition | Label |
|---|---|
| date === todayISO | `"Today"` |
| date === tomorrowISO | `"Tomorrow"` |
| otherwise | `format(parseISO(date), "EEEE, MMM d")` — e.g. `"Thursday, Mar 20"` |

`tomorrowISO` is `addDays(todayISO, 1)` (existing helper).

---

## Rendering

### No upcoming workout (hero date is null)

Render a single `WorkoutCard` with `state={{ kind: "after-end" }}`, `dateISO={todayISO}`, `units={units}`, `variant="hero"`. No section heading. No "Then" section. "This Week" and "View Full Plan →" still render below.

### Hero section

- Section heading: the label string for the hero date.
- Filter the hero date's entries to `type !== "rest"` before rendering (use the same pattern as the current `todayWorkouts` filter).
- One `WorkoutCard` per filtered entry, `variant="hero"`, `key={entry.date + "-" + entry.type}`.

### Then section

- Only rendered if a then date is found.
- Section heading: the label string for the then date.
- Filter the then date's entries to `type !== "rest"` before rendering.
- One `WorkoutCard` per filtered entry, `variant="preview"`, `key={entry.date + "-" + entry.type}`.
- If no then date found: section omitted entirely.

### This Week

Unchanged — see `WeekList` component for exact behaviour.

### View Full Plan →

Unchanged — always rendered when a plan is resolved.

---

## DayCardState

The `before-start` variant is no longer produced by the dashboard page. The `after-end` variant IS used for the plan-complete card (see above). Both variants remain in the `DayCardState` type with no changes to `WorkoutCard`.

---

## Files Changed

- **Modify:** `apps/web/app/dashboard/page.tsx` — add `findNextWorkoutDay` helper, replace Today/Tomorrow logic with hero/then scan, update render sections.

No other files need to change.

---

## Edge Cases

| Scenario | Behaviour |
|---|---|
| Plan starts next Monday | Hero shows Monday's workout with label "Monday, Mar 17" |
| Today is a rest day | Hero skips to next workout day |
| Multiple rest days in a row | Hero skips all of them |
| Today has a workout + tomorrow has a workout | Hero = "Today", Then = "Tomorrow" |
| Today has a workout, next workout is 5 days away | Hero = "Today", Then = full date label |
| Plan has not started and starts in 10 days | Hero shows first plan workout with its date label |
| Only one workout left in the plan | Hero shows it, Then section omitted |
| Plan is complete (no future non-rest days) | Single `WorkoutCard` with `after-end` state, no Then section |
| Multiple entries on hero date (run + strength) | Multiple hero cards, all `variant="hero"` |

---

## Out of Scope

- Changing the This Week section logic.
- Any changes to `WorkoutCard`, `WeekList`, or `DashboardHeader`.
