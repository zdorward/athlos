---
title: Landing Page Plan Preview — Responsive & Dynamic
date: 2026-03-16
status: approved
---

## Problem

The plan preview mockup on the landing page (`apps/web/app/page.tsx`) has two issues:

1. **Stale dates** — `MOCK_WEEKS` is a static constant with hardcoded dates (e.g. "Mar 16", "Mar 23") that become stale immediately after launch.
2. **No responsive layout** — the calendar grid is illegible on mobile and doesn't reflect what the app actually looks like on a phone.

Additionally, workout labels use shortened text ("Easy", "Str", "M-Long") rather than the full names shown in the real app ("Easy Run", "Strength", "Medium-Long"). Rest days show no label.

## Decision

Replace the static mock data and single-layout preview with:

1. **Dynamic dates** computed at render time starting from the next upcoming Monday. If today is Monday, use today; otherwise use the next Monday.
2. **Responsive layout**: calendar grid on desktop (≥640px), vertical list cards on mobile (<640px), controlled via a CSS `@media` rule in the existing `<style>` block.
3. **Full workout labels** in both views — no abbreviations.
4. **Rest Day label** shown explicitly in both views.

## Design

### Types

Update `WorkoutType` to add `"medium-long"` and `"intervals"`. Keep `"tempo"` in the union — it is used in `WORKOUT_STYLES` and may be needed later.

Simplify `MockDay` — remove `sub` and `extra`, replace with `desc` (used as the subtitle in the list view) and `km` (the distance string, empty for strength/rest):

```ts
type MockDay = {
  dayLabel: string        // "Mon", "Tue", etc.
  date: number            // day-of-month, filled in by buildMockWeeks()
  type: WorkoutType
  title: string           // full name, e.g. "Easy Run", "Rest Day"
  km: string              // "10 km", "" for strength/rest
  desc: string            // subtitle for mobile list, e.g. "Easy aerobic run."
}
```

Update `WORKOUT_STYLES` with exact color values:

```ts
"medium-long": { color: "rgba(120,200,255,0.80)" },
intervals:     { color: "oklch(0.72 0.18 40 / 0.90)" },
```

### Data

Replace `MOCK_WEEKS` with two separate constants:

**`WEEK_TEMPLATES`** — static workout structure, no date fields:

```ts
const WEEK_TEMPLATES: Array<{
  phase: string | null
  km: string
  days: Array<Pick<MockDay, "type" | "title" | "km" | "desc">>
}> = [ /* two weeks below */ ]
```

**Week 1 (`phase: "Base"`, 72 km):**

| Day | Type | Title | km | desc |
|-----|------|-------|----|------|
| Mon | easy | Easy Run | 10 km | Easy aerobic run. |
| Tue | strength | Strength | — | Strength training. |
| Wed | easy | Easy Run | 12 km | Easy aerobic run. |
| Thu | medium-long | Medium-Long | 16 km | 16 km medium-long run. |
| Fri | easy | Easy Run | 10 km | Easy run with strides. |
| Sat | rest | Rest Day | — | — |
| Sun | long | Long Run | 24 km | 24 km long run at easy pace. |

**Week 2 (`phase: null`, 90 km):**

| Day | Type | Title | km | desc |
|-----|------|-------|----|------|
| Mon | easy | Easy Run | 12 km | Easy recovery run. |
| Tue | intervals | Intervals | 14 km | 6 × 1 km at 5K pace. |
| Wed | strength | Strength | — | Strength training. |
| Thu | medium-long | Medium-Long | 18 km | 18 km medium-long run. |
| Fri | easy | Easy Run | 10 km | Easy recovery run. |
| Sat | easy | Easy Run | 8 km | Easy shakeout run. |
| Sun | long | Long Run | 28 km | 28 km long run — last 8 km at marathon pace. |

**`buildMockWeeks()`** — called via `useMemo` inside `PageContent`, no arguments, returns `Array<{ label: string; dateLabel: string; km: string; phase: string | null; days: MockDay[] }>`:

```ts
function buildMockWeeks() {
  const today = new Date()
  const day = today.getDay()                         // 0 = Sun
  const daysToMonday = day === 1 ? 0 : day === 0 ? 1 : 8 - day
  const monday = new Date(today)
  monday.setDate(today.getDate() + daysToMonday)
  monday.setHours(0, 0, 0, 0)

  return WEEK_TEMPLATES.map((template, wi) => {
    const weekStart = new Date(monday)
    weekStart.setDate(monday.getDate() + wi * 7)
    const dateLabel = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    return {
      label: `W${wi + 1}`,
      dateLabel,
      km: template.km,
      phase: template.phase,
      days: template.days.map((d, i) => {
        const date = new Date(weekStart)
        date.setDate(weekStart.getDate() + i)
        return { ...d, date: date.getDate(), dayLabel: DAY_SHORT[i] }
      }),
    }
  })
}

const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
```

### Layout

**Desktop (≥640px):** Calendar grid with:
- Week label column (W1/W2, date, total km)
- MON–SUN column headers
- Phase label as a horizontal rule spanning all 7 day columns, rendered only when `week.phase` is non-null (W1 shows "Base", W2 shows nothing)
- Day cells: date number (top left), full workout title (colored), km below title (omitted for rest/strength)
- Rest Day cells: dimmed (opacity 0.4), show "Rest Day" label

**Mobile (<640px):** Vertical list of day cards with:
- Week header row: "Week N — Phase" (e.g. "Week 1 — Base") left-aligned, total km pill right-aligned. Phase appears inline in the header text only — no separate horizontal rule.
- Each day card: colored left accent bar | large date number + day abbreviation below | workout title (colored) + desc subtitle | km right-aligned (omitted for rest/strength)
- Rest Day cards: dimmed (opacity 0.4), left bar uses `rgba(255,255,255,0.12)`, title "Rest Day" in muted white

Both views end with a fade-out gradient hinting at more weeks below.

### CSS

Add to the existing `<style>` block in `PageContent`:

```css
.mock-plan-desktop { display: block }
.mock-plan-mobile  { display: none }
@media (max-width: 639px) {
  .mock-plan-desktop { display: none }
  .mock-plan-mobile  { display: block }
}
```

Two sibling `<div className="mock-plan-desktop">` and `<div className="mock-plan-mobile">` inside the browser chrome mockup render the respective layouts.

### Files changed

- **Modify only:** `apps/web/app/page.tsx`
  - Add `useMemo` to React imports
  - Add `"medium-long"` and `"intervals"` to `WorkoutType`; update `WORKOUT_STYLES` with exact color values
  - Replace `MockDay` type (remove `sub`/`extra`, add `km`/`desc`)
  - Add `DAY_SHORT` constant and `WEEK_TEMPLATES` constant
  - Add `buildMockWeeks()` function
  - In `PageContent`: call `const mockWeeks = useMemo(buildMockWeeks, [])`
  - Replace plan preview JSX with responsive desktop/mobile layouts
  - Add `.mock-plan-desktop`/`.mock-plan-mobile` CSS to `<style>` block

## What does not change

- Hero section, aurora animations, race search widget, "Why Athlos" section, bottom CTA
- OG image (`opengraph-image.tsx`)
- Any other page or component
