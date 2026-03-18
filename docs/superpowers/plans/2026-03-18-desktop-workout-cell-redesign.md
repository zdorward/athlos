# Desktop Workout Cell Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the inline `distance · name` cell layout with a two-zone design: distance top-right, workout name pinned to bottom-left, `+ Strength` as a small supplemental modifier.

**Architecture:** All changes are in `apps/web/app/plan/plan-calendar.tsx`. `WorkoutCellContent` is refactored to render only the bottom zone (workout name + strength modifier). The top row (date, completion check, distance) is rendered directly in each cell button. Three cell sites are updated: main calendar workout cells, main calendar rest/fallback cells, and pre-plan bridge day cells.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Next.js App Router. No new dependencies.

---

## File Map

| File | Change |
|------|--------|
| `apps/web/app/plan/plan-calendar.tsx` | Refactor `WorkoutCellContent`; update all cell button structures |

---

### Task 1: Refactor `WorkoutCellContent` to bottom-zone-only

**Spec:** `docs/superpowers/specs/2026-03-17-desktop-workout-cell-design.md` — "Bottom zone" section.

`WorkoutCellContent` currently renders `distance · name` as one inline paragraph. It needs to become the **bottom zone only**: workout name (with star for race day before it) + optional `+ Strength` line. Distance moves to the cell button's top row (Task 2/3).

**Files:**
- Modify: `apps/web/app/plan/plan-calendar.tsx:36-82`

- [ ] **Step 1: Replace `WorkoutCellContent` implementation**

Replace lines 36–82 with:

```tsx
function WorkoutCellContent({
  primary,
  secondaryEntries,
  isRace = false,
}: {
  primary: WorkoutDay
  secondaryEntries: WorkoutDay[]
  isRace?: boolean
}) {
  const color = getWorkoutColor(primary.type)
  const textClass = WORKOUT_TEXT_CLASS[primary.type]
  const hasStrength = secondaryEntries.some((e) => e.type === "strength")
  return (
    <div className="absolute bottom-2 left-2 right-2">
      <p
        className={`text-[10px] font-semibold leading-snug flex items-center gap-1 ${textClass}`}
        style={color ? { color } : undefined}
      >
        {isRace && <Star className="h-[9px] w-[9px] fill-current shrink-0" />}
        {WORKOUT_NAMES[primary.type]}
      </p>
      {hasStrength && (
        <p
          className="text-[9px] font-medium mt-0.5"
          style={{ color: "oklch(0.65 0.15 300)" }}
        >
          + Strength
        </p>
      )}
    </div>
  )
}
```

The `units` prop is removed from the signature — it was only used internally for `distanceUnit(units)` which now lives in the cell button. All three call sites (`WorkoutCellContent` in Task 2 and Task 3) must **not** pass `units={units}`.

- [ ] **Step 2: Verify typecheck passes**

```bash
cd /Users/zackdorward/dev/athlos && pnpm typecheck 2>&1 | head -40
```

Expected: no new errors in `plan-calendar.tsx`. (Callers in Tasks 2/3 will be updated to match.)

- [ ] **Step 3: Commit**

```bash
cd /Users/zackdorward/dev/athlos
git add apps/web/app/plan/plan-calendar.tsx
git commit -m "refactor: WorkoutCellContent renders bottom zone only"
```

---

### Task 2: Update main calendar cell buttons

**Spec:** `docs/superpowers/specs/2026-03-17-desktop-workout-cell-design.md` — Layout, States, Distance color sections.

The main calendar has three cell sites to update: (a) the normal workout cell button, (b) the defensive fallback for missing days, and (c) the implicit rest path (handled via `isRest` in the same button). All are inside `DAY_ORDER.map(...)` starting at line ~301.

**Files:**
- Modify: `apps/web/app/plan/plan-calendar.tsx:301-361`

- [ ] **Step 1: Add `isLongRun` and `isToday` derivations inside the `DAY_ORDER.map` callback**

After the existing `isFullyComplete` line (currently ~line 321), add:

```tsx
const isLongRun = !isRace && primary.type === "long"
const isToday = primary.date === todayISO
const distColor = getWorkoutColor(primary.type)
```

- [ ] **Step 2: Update the defensive fallback (`!entries?.length` branch)**

Replace the fallback `<div>` (currently ~lines 304–313) with:

```tsx
return (
  <div
    key={dow}
    className="relative min-h-[88px] rounded-md border border-border bg-card p-2 opacity-40"
  >
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-subtle-foreground">—</span>
    </div>
    <div className="absolute bottom-2 left-2 right-2">
      <p className="text-[10px] font-semibold text-subtle-foreground">Rest Day</p>
    </div>
  </div>
)
```

- [ ] **Step 3: Update the cell button className to add `relative` and long-run tint**

Replace the `className` array in the `<button>` (currently ~lines 327–339) with:

```tsx
className={[
  "relative min-h-[88px] rounded-md border p-2 text-left transition-colors cursor-pointer",
  isRace
    ? "bg-primary/12 border-primary"
    : isFullyComplete && isSelected
    ? "bg-green-500/10 border-green-500/50"
    : isFullyComplete
    ? "bg-green-500/10 border-green-500/30"
    : isLongRun && isSelected
    ? "bg-muted border-primary/40"
    : isLongRun
    ? "bg-primary/[0.08] border-primary/40"
    : isSelected
    ? "bg-muted border-primary/40"
    : "bg-card border-border hover:border-primary/25",
  isRest ? "opacity-40" : "",
].join(" ")}
```

- [ ] **Step 4: Replace the cell interior (top row + body)**

Replace everything inside the `<button>` (currently ~lines 341–358) with:

```tsx
{/* Top row: date + check left, distance right */}
<div className="flex items-center justify-between">
  <div className="flex items-center gap-1">
    <span
      className={`text-[10px] font-medium ${isToday ? "text-primary" : "text-subtle-foreground"}`}
    >
      {format(parseISO(primary.date), "d")}
    </span>
    {isFullyComplete && (
      <Check className="h-[10px] w-[10px] text-green-500" />
    )}
  </div>
  {!isRest && primary.distanceKm != null && (
    <div className="flex items-baseline gap-[1px]">
      <span
        className={`text-base font-bold tabular-nums ${WORKOUT_TEXT_CLASS[primary.type]}`}
        style={distColor ? { color: distColor } : undefined}
      >
        {formatDistance(primary.distanceKm, units)}
      </span>
      <span className="text-[10px] text-subtle-foreground">{unit}</span>
    </div>
  )}
</div>

{/* Bottom zone */}
{isRest ? (
  <div className="absolute bottom-2 left-2 right-2">
    <p className="text-[10px] font-semibold text-subtle-foreground">Rest Day</p>
  </div>
) : (
  <WorkoutCellContent
    primary={primary}
    secondaryEntries={entries.filter(
      (e) => e.type !== primary.type && e.type !== "rest"
    )}
    isRace={isRace}
  />
)}
```

- [ ] **Step 5: Verify typecheck passes**

```bash
cd /Users/zackdorward/dev/athlos && pnpm typecheck 2>&1 | head -40
```

Expected: no errors (or only pre-existing ones unrelated to this file).

- [ ] **Step 6: Commit**

```bash
cd /Users/zackdorward/dev/athlos
git add apps/web/app/plan/plan-calendar.tsx
git commit -m "feat: B2 cell layout for main calendar — distance top-right, name pinned bottom"
```

---

### Task 3: Update pre-plan bridge day cells

**Spec:** `docs/superpowers/specs/2026-03-17-desktop-workout-cell-design.md` — "Pre-plan 'Now' week rest cells" and "Today" sections.

The pre-plan section (`prePlanDates.map`) has two branches: rest cells (`isRest`) and workout cells. Both need the same two-zone treatment.

**Files:**
- Modify: `apps/web/app/plan/plan-calendar.tsx:192-248` (the `prePlanDates.map` callback)

- [ ] **Step 1: Replace the pre-plan rest cell branch**

Replace the `if (isRest)` block (currently ~lines 198–220) with:

```tsx
if (isRest) {
  return (
    <div
      key={dateISO}
      className={[
        "relative min-h-[88px] rounded-md border bg-card border-border p-2",
        isPast ? "opacity-25" : "opacity-40",
      ].join(" ")}
    >
      <div className="flex items-center justify-between">
        <span
          className={`text-[10px] font-medium ${isToday ? "text-primary" : "text-subtle-foreground"}`}
        >
          {format(parseISO(dateISO), "d")}
        </span>
      </div>
      {!isPast && (
        <div className="absolute bottom-2 left-2 right-2">
          <p className="text-[10px] font-semibold text-subtle-foreground">Rest Day</p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Replace the pre-plan workout cell button**

The existing pre-plan workout button (~lines 228–247) renders date + dot + `WorkoutCellContent`. Replace the entire `return (...)` after the `isRest` guard with:

```tsx
const isSelected = selectedDay?.date === primary.date && selectedDay?.type === primary.type
const distColor = getWorkoutColor(primary.type)

return (
  <button
    key={dateISO}
    onClick={() =>
      onSelectedKeyChange(
        isSelected ? null : { date: primary.date, type: primary.type }
      )
    }
    className={[
      "relative min-h-[88px] rounded-md border p-2 text-left transition-colors cursor-pointer",
      isSelected
        ? "bg-muted border-primary/40"
        : "bg-card border-border hover:border-primary/25",
      isPast ? "opacity-25" : "",
    ].join(" ")}
  >
    {/* Top row: date + check left, distance right */}
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1">
        <span
          className={`text-[10px] font-medium ${isToday ? "text-primary" : "text-subtle-foreground"}`}
        >
          {format(parseISO(dateISO), "d")}
        </span>
        {primary.completed && (
          <Check className="h-[10px] w-[10px] text-green-500" />
        )}
      </div>
      {primary.distanceKm != null && (
        <div className="flex items-baseline gap-[1px]">
          <span
            className={`text-base font-bold tabular-nums ${WORKOUT_TEXT_CLASS[primary.type]}`}
            style={distColor ? { color: distColor } : undefined}
          >
            {formatDistance(primary.distanceKm, units)}
          </span>
          <span className="text-[10px] text-subtle-foreground">{unit}</span>
        </div>
      )}
    </div>

    {/* Bottom zone */}
    <WorkoutCellContent
      primary={primary}
      secondaryEntries={secondaryEntries}
    />
  </button>
)
```

**Important:** Before inserting the snippet above, delete these three lines from the existing code (~lines 224–226):
```tsx
const isSelected = selectedDay?.date === primary.date && selectedDay?.type === primary.type
const color = getWorkoutColor(primary.type)
const textClass = WORKOUT_TEXT_CLASS[primary.type]
```
If you don't remove line 224 first, TypeScript will error on the duplicate `const isSelected` declaration in the new snippet.

- [ ] **Step 3: Verify typecheck passes cleanly**

```bash
cd /Users/zackdorward/dev/athlos && pnpm typecheck 2>&1 | head -40
```

Expected: no errors.

- [ ] **Step 4: Smoke-test in browser**

```bash
cd /Users/zackdorward/dev/athlos && pnpm dev
```

Open the plan page. Verify:
- Distance appears top-right in each workout cell as a bold number + muted unit
- Workout name appears pinned to the bottom-left
- `+ Strength` appears below the workout name on bridge days that have strength
- Today's date is in primary color (no dot)
- Completed cells show a green check inline after the date number
- Long run cells have a subtle primary background tint
- Rest cells show "Rest Day" pinned to the bottom (future only)

- [ ] **Step 5: Commit**

```bash
cd /Users/zackdorward/dev/athlos
git add apps/web/app/plan/plan-calendar.tsx
git commit -m "feat: B2 cell layout for pre-plan Now week"
```
