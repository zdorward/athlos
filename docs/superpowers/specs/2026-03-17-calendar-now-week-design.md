# Calendar "Now" Week Polish

**Date:** 2026-03-17
**Status:** Draft

## Problem

The pre-plan "Now" week row in `PlanCalendar` has four issues:
1. The first phase label (e.g. "General Fitness") renders below the "Now" row instead of above it.
2. Rest/empty day cells show only a date number — no "Rest Day" label.
3. Rest cells look visually smaller than workout cells because they have less content.
4. Bridge days with both a run and strength training only show the run — strength is hidden.

## Goals

1. Render the first phase label above the "Now" row.
2. Label rest/empty cells with "Rest Day".
3. Make rest cell visual weight match workout cells (same content structure).
4. Show strength training entries in bridge day cells using the same primary/secondary layout as the main calendar.

## Scope

All changes are in `apps/web/app/plan/plan-calendar.tsx`. No other files change.

---

## Design

### 1. Phase label above "Now" week

Before the `showPrePlanWeek` block, derive the first week's phase:

```ts
const firstPhase = totalWeeks > 0 ? getPhaseLabel(1, totalWeeks, taperWeeks, phases) : ""
```

When `showPrePlanWeek && firstPhase` is true, render the phase header (same markup as used in the main `weeks.map` phase header) immediately before the "Now" row.

### 2. Rest/empty cells — label + consistent size

The `isRest` branch currently renders a plain `<div>` with just the date number. Change it to also show `WORKOUT_NAMES["rest"]` ("Rest Day") in `text-subtle-foreground`, same position as the workout name in filled cells. The `min-h-[88px]` is already present — adding the label brings the visual weight in line with workout cells.

Past days keep their existing `opacity-25` treatment. Today's dot indicator is retained.

### 3. Strength Training in bridge cells

**Current:** `bridgeDayMap` is `Map<string, WorkoutDay>` (one entry per date). Built by mapping filtered bridge days.

**New:** Change to `Map<string, WorkoutDay[]>` using `groupDaysByDate` (already exported from `workout-utils.ts`):

```ts
const bridgeDayMap = groupDaysByDate(
  days.filter(d => planFirstMonday && d.date < planFirstMonday)
)
```

Update the bridge cell rendering to match the main calendar cell pattern:
- Find primary entry: `RUN_TYPES.has(e.type)` preference, fallback to `entries[0]`
- Primary renders as `5 km · Easy Run` (inline, same as main calendar)
- Secondary (non-primary, non-rest) entries render on their own line below
- Secondary filter: `e.type !== primary.type && e.type !== "rest"`
- Secondary key: `` `${entry.date}-${entry.type}` ``

The `isRest` check becomes `!entries || entries.every(e => e.type === "rest")`.

---

## Out of scope

- Bridge day selection behaviour (already works via primary entry key)
- Any changes to `PlanFeed` or `workout-utils.ts`
