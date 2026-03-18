# Calendar "Now" Week Polish Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the pre-plan "Now" week row in `PlanCalendar`: show phase label above it, label rest cells, and render bridge days with the same primary/secondary pattern as the main calendar.

**Architecture:** All changes are in `plan-calendar.tsx`. The `bridgeDayMap` changes from `Map<string, WorkoutDay>` to `Map<string, WorkoutDay[]>` using the already-exported `groupDaysByDate`. The first week's phase label is computed before the "Now" row and rendered above it using the same phase header markup already used in `weeks.map`. Rest cells gain a "Rest Day" label. No other files change.

**Tech Stack:** React 19, Next.js 16, TypeScript, Tailwind CSS v4

---

## File Map

| File | Change |
|------|--------|
| `apps/web/app/plan/plan-calendar.tsx` | All four changes (phase label, rest labels, cell size, bridge multi-entry) |

---

## Task 1: Show phase label above the "Now" week row

**Files:**
- Modify: `apps/web/app/plan/plan-calendar.tsx` (around lines 83–120)

- [ ] **Step 1: Add `groupDaysByDate` to the import**

In the import from `./workout-utils` (lines 7–17), add `groupDaysByDate`:

```ts
import {
  groupDaysByWeek,
  getPhaseLabel,
  getTaperWeeks,
  WORKOUT_NAMES,
  WORKOUT_TEXT_CLASS,
  getWorkoutColor,
  formatDistance,
  distanceUnit,
  RUN_TYPES,
  groupDaysByDate,
} from "./workout-utils"
```

- [ ] **Step 2: Compute `firstPhase` and update `bridgeDayMap` to use `groupDaysByDate`**

Replace lines 83–90 (the `showPrePlanWeek`, `prePlanDates`, and `bridgeDayMap` declarations):

```ts
const showPrePlanWeek = planFirstMonday !== null && currentWeekMonday < planFirstMonday
const prePlanDates = showPrePlanWeek ? getWeekDates(currentWeekMonday) : []
// First plan week's phase label — shown above the "Now" row
const firstPhase = totalWeeks > 0 ? getPhaseLabel(1, totalWeeks, taperWeeks, phases) : ""
// Bridge days grouped by date (supports multiple entries per day, e.g. run + strength)
const bridgeDayMap = groupDaysByDate(
  days.filter(d => planFirstMonday && d.date < planFirstMonday)
)
```

- [ ] **Step 3: Render the phase header above the "Now" row**

Inside the `{showPrePlanWeek && ( ... )}` block, insert the phase header immediately before the `<div className="grid ...">` row. Replace:

```tsx
{showPrePlanWeek && (
  <div className="grid grid-cols-[64px_repeat(7,1fr)] gap-1 mb-1">
```

With:

```tsx
{showPrePlanWeek && (
  <>
    {firstPhase && (
      <div className="grid grid-cols-[64px_repeat(7,1fr)] gap-1 mb-1 mt-3">
        <div />
        <div className="col-span-7 flex items-center gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle-foreground whitespace-nowrap">
            {firstPhase}
          </span>
          <div className="flex-1 h-px bg-border" />
        </div>
      </div>
    )}
    <div className="grid grid-cols-[64px_repeat(7,1fr)] gap-1 mb-1">
```

And close the fragment by replacing the closing `)}` of the pre-plan block:

```tsx
    </div>
  </>
)}
```

- [ ] **Step 4: Verify typecheck**

```bash
pnpm typecheck
```

Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/plan/plan-calendar.tsx
git commit -m "feat: show phase label above Now week in calendar"
```

---

## Task 2: Label rest/empty cells and update bridge cell rendering

**Files:**
- Modify: `apps/web/app/plan/plan-calendar.tsx` (the `prePlanDates.map` block, lines 127–188)

This task replaces the entire `prePlanDates.map((dateISO) => { ... })` callback. The new version:
- Looks up `WorkoutDay[]` (not single entry) from the new `bridgeDayMap`
- Determines `isRest` from the array
- Rest cells: show "Rest Day" label
- Workout cells: primary/secondary rendering matching the main calendar

- [ ] **Step 1: Replace the `prePlanDates.map` callback**

Replace the entire `{prePlanDates.map((dateISO) => { ... })}` block (lines 127–188) with:

```tsx
{prePlanDates.map((dateISO) => {
  const isToday = dateISO === todayISO
  const isPast = dateISO < todayISO
  const entries = bridgeDayMap.get(dateISO) ?? []
  const isRest = entries.length === 0 || entries.every(e => e.type === "rest")

  if (isRest) {
    return (
      <div
        key={dateISO}
        className={[
          "min-h-[88px] rounded-md border p-2",
          isPast
            ? "bg-muted/10 border-border/20 opacity-25"
            : "bg-muted/30 border-border/40",
        ].join(" ")}
      >
        <p className={`text-[10px] font-medium ${isToday ? "text-primary" : "text-subtle-foreground"}`}>
          {format(parseISO(dateISO), "d")}
        </p>
        {isToday && (
          <div className="w-1 h-1 rounded-full bg-primary mt-1" />
        )}
        <p className="text-[10px] mt-0.5 text-subtle-foreground">
          {WORKOUT_NAMES["rest"]}
        </p>
      </div>
    )
  }

  const primary = entries.find(e => RUN_TYPES.has(e.type)) ?? entries[0]!
  const secondaryEntries = entries.filter(e => e.type !== primary.type && e.type !== "rest")
  const isSelected = selectedDay?.date === primary.date && selectedDay?.type === primary.type
  const color = getWorkoutColor(primary.type)
  const textClass = WORKOUT_TEXT_CLASS[primary.type]

  return (
    <button
      key={dateISO}
      onClick={() => onSelectedKeyChange(isSelected ? null : { date: primary.date, type: primary.type })}
      className={[
        "min-h-[88px] rounded-md border p-2 text-left transition-colors cursor-pointer",
        isSelected
          ? "bg-muted border-primary/40"
          : "bg-card border-border hover:border-primary/25",
      ].join(" ")}
    >
      <p className={`text-[10px] font-medium ${isToday ? "text-primary" : "text-subtle-foreground"}`}>
        {format(parseISO(dateISO), "d")}
      </p>
      {isToday && (
        <div className="w-1 h-1 rounded-full bg-primary mt-1" />
      )}
      <p
        className={`text-[10px] font-semibold leading-snug mt-0.5 ${textClass}`}
        style={color ? { color } : undefined}
      >
        {primary.distanceKm != null && (
          <>
            <span className="text-sm font-bold tabular-nums">
              {formatDistance(primary.distanceKm, units)}
            </span>
            <span className="text-[9px] font-normal text-muted-foreground ml-0.5">
              {unit}
            </span>
            {" · "}
          </>
        )}
        {WORKOUT_NAMES[primary.type]}
      </p>
      {secondaryEntries.map(entry => {
        const secColor = getWorkoutColor(entry.type)
        const secTextClass = WORKOUT_TEXT_CLASS[entry.type]
        return (
          <p
            key={`${entry.date}-${entry.type}`}
            className={`text-[10px] mt-0.5 font-medium ${secTextClass}`}
            style={secColor ? { color: secColor } : undefined}
          >
            {WORKOUT_NAMES[entry.type]}
          </p>
        )
      })}
    </button>
  )
})}
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm typecheck
```

Expected: 0 errors

- [ ] **Step 3: Run tests**

```bash
pnpm test
```

Expected: 17/17 passing

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/plan/plan-calendar.tsx
git commit -m "feat: label rest cells and show strength training in Now week"
```
