# Calendar & Feed Workout Item Layout

**Date:** 2026-03-17
**Status:** Approved

## Problem

When a training day has both a run and strength training, the mobile feed renders them as two separate cards (same date, two rows). On desktop, the calendar cell renders distance and workout name on separate lines, wasting vertical space in an already-compact cell.

## Goals

1. **Mobile (PlanFeed):** Combine same-date entries into a single card.
2. **Desktop (PlanCalendar):** Render distance + run name on one line; strength training on the line below.
3. **Shared:** Extract a reusable `groupDaysByDate` utility and hoist `RUN_TYPES` to module scope in `workout-utils.ts`.

---

## Design

### Shared changes — `workout-utils.ts`

**Add `groupDaysByDate`:**

```ts
export function groupDaysByDate(days: WorkoutDay[]): Map<string, WorkoutDay[]>
```

Groups a flat `WorkoutDay[]` into a `Map<date, WorkoutDay[]>`, keyed by ISO date string. The function does not sort — it preserves insertion order. Callers are responsible for passing entries in the desired display order. In `PlanFeed`, input comes from `groupDaysByWeek`, which guarantees chronological order, so map iteration order is also chronological. This utility is exclusively for `PlanFeed`; `PlanCalendar` retains its own DOW-keyed `dayMap`, which is a different access pattern.

**Hoist `RUN_TYPES` to module scope:**

```ts
export const RUN_TYPES = new Set<WorkoutType>([
  "easy", "long", "progression", "medium-long", "mp", "tempo", "intervals", "race", "shakeout"
])
```

Remove the inline `RUN_TYPES` declaration inside `PlanCalendar`'s `DAY_ORDER.map()` callback and import the exported constant instead. `PlanFeed` uses the same constant.

**Rename `WORKOUT_NAMES["strength"]`:**

Change from `"Strength"` to `"Strength Training"`. This is a global display-name change — it will propagate to `PlanDayDetail`'s heading (acceptable side effect, not a regression). Any test fixtures or snapshots that assert the string `"Strength"` must be updated to `"Strength Training"`.

---

### PlanFeed (mobile)

**Current behavior:** `weekDays.map(day => <button>...)` — one card per `WorkoutDay`, so a run + strength day produces two cards with the same date.

**New behavior:** Group `weekDays` by date using `groupDaysByDate`. Iterate via `Array.from(groupedByDate.values())` to preserve chronological order. Render one card per date group.

**Primary entry determination:** Prefer entries whose type is in `RUN_TYPES`. If none, fall back to `entries[0]`.

**Combined card layout (run + strength training):**

```
┌──────────────────────────────────────────────┐
│  25   Easy Run                            5  │  ← single <button>
│ WED                                      km  │    distance: two-line stacked (number + unit)
│       ─────────────────────────────────────  │  ← hairline border-top, ~6% opacity
│       Strength Training                      │
└──────────────────────────────────────────────┘
```

- The entire card is a single `<button>`. Tapping anywhere selects the primary entry.
- Distance (two-line stacked: number above, unit below) is shown on the right for the primary run entry only. Strength Training has no distance.
- Left-border color, selected state, completed state, and race state all derive from the primary entry or the group:
  - **Selected:** `isSelected = selectedKey?.date === primary.date && selectedKey?.type === primary.type`. If `selectedKey` refers to a non-primary entry on the same date (e.g., a previously-selected strength entry), the card is treated as **deselected**.
  - **Completed:** green border/background when all non-rest entries in the group have `completed === true`.
  - **Race:** primary tint when any entry in the group has `type === "race"`.
- "Strength Training" uses `WORKOUT_NAMES["strength"]`, `WORKOUT_TEXT_CLASS["strength"]`, and `getWorkoutColor("strength")` for styling.
- Secondary rows (below the hairline divider) use `entry.type` as their React `key`.
- Days with only a run or only strength render identically to today — no visual change.

**Three-or-more entries:** Primary renders as the top row with inline distance. Each remaining non-rest entry renders on its own line below the hairline divider. In practice the plan engine does not produce three-or-more entries per day, but the implementation should handle it gracefully.

**Accepted trade-off:** Tapping a combined card only surfaces the primary (run) entry in `PlanDayDetail`. The strength entry's detail is not accessible from the feed view in this iteration.

---

### PlanCalendar (desktop)

**Current behavior:** In `entries.map(entry => ...)`, each entry renders distanceKm (if present) on its own `<p>`, then workout name on the next `<p>`. `RUN_TYPES` is currently defined inline inside the `DAY_ORDER.map()` callback.

**New behavior:**

1. Import `RUN_TYPES` from `workout-utils.ts` (remove the inline declaration).
2. Replace the `entries.map()` block with explicit structure:
   - Find the primary entry using `RUN_TYPES`.
   - Render the primary entry as: `5 km · Easy Run` — distance bold/large, literal ` · ` separator, name inline — all in one `<p>`. If the primary has no `distanceKm`, omit the distance and separator and render the name alone.
   - Render each remaining non-rest entry on its own line below, using its `WORKOUT_NAMES` label and color class. No distance is shown for these entries.
3. **Selected state:** `isSelected` checks `selectedDay?.type === primary.type` — unchanged from today. If `selectedKey` refers to a non-primary entry on the same date, the cell is treated as deselected (already correct in the current implementation; no logic change needed).

**Three-or-more entries** follow the same rule: primary inline on line 1, remaining entries each on their own line.

The `dayMap` building (by DOW string, per week), complete checkmark, race star, and rest-day opacity are all **unchanged**.

---

## Out of scope

- Any changes to `PlanDayDetail` beyond the `WORKOUT_NAMES` rename propagating to its heading.
- Rest days, race days with no run companion, or days with only one workout type.
- The pre-plan bridge day row in `PlanCalendar` (the "Now" week shown before the plan starts) — it uses the same old distance-on-separate-line pattern but is low-visibility and not updated in this iteration.
