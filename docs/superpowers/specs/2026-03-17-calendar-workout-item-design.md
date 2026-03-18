# Calendar & Feed Workout Item Layout

**Date:** 2026-03-17
**Status:** Approved

## Problem

When a training day has both a run and strength training, the mobile feed renders them as two separate cards (same date, two rows). On desktop, the calendar cell renders distance and workout name on separate lines, wasting vertical space in an already-compact cell.

## Goals

1. **Mobile (PlanFeed):** Combine same-date entries into a single card.
2. **Desktop (PlanCalendar):** Render distance + run name on one line; strength training on the line below.
3. **Shared:** Extract a reusable `groupDaysByDate` utility to avoid duplicating grouping logic.

## Design

### Shared utility — `workout-utils.ts`

Add:

```ts
export function groupDaysByDate(days: WorkoutDay[]): Map<string, WorkoutDay[]>
```

Groups a flat `WorkoutDay[]` into a `Map<date, WorkoutDay[]>`. Used by both `PlanFeed` and `PlanCalendar`.

---

### PlanFeed (mobile)

**Current behavior:** `weekDays.map(day => <button>...)` — one card per `WorkoutDay`, so a run + strength day produces two cards with the same date.

**New behavior:** Group `weekDays` by date using `groupDaysByDate`. Render one card per date group.

**Combined card layout (run + strength training):**

```
┌──────────────────────────────────────────────┐
│  25   Easy Run                            5  │
│ WED                                      km  │
│       ─────────────────────────────────────  │  ← hairline border (border/6%)
│       Strength Training                      │
└──────────────────────────────────────────────┘
```

- Left-border color and selection key derived from the primary entry (run type preferred over strength/rest).
- Distance shown only on the run row (strength has no distance).
- Hairline divider: `border-top: 1px solid` at ~6% opacity.
- "Strength Training" uses the existing `WORKOUT_TEXT_CLASS["strength"]` / `getWorkoutColor("strength")` styling.
- Days with only a run or only strength render identically to today — no visual change.

**Selection:** Tapping the card selects the primary entry (run preferred). `selectedKey` type and shape unchanged.

---

### PlanCalendar (desktop)

**Current behavior:** Each entry renders distance on its own `<p>`, then workout name on the next `<p>`.

**New behavior:**

- **Run entry line:** `5 km · Easy Run` — distance bold/large, `·` separator, name inline. All on one `<p>`.
- **Strength Training line:** rendered on the next line, no distance, muted purple color.
- Replace the inline `dayMap` building logic in the week loop with `groupDaysByDate`.

Everything else (selected state, complete checkmark, race star, rest-day opacity, bridge days) is unchanged.

---

## Out of scope

- Clicking the combined mobile card to open a detail sheet for strength specifically — the existing single-primary-entry selection model is unchanged.
- Any changes to `PlanDayDetail`.
- Rest days, race days, or days with only one workout type.
