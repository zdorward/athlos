# Onboarding Flow Design

**Date:** 2026-03-13
**Status:** Approved

## Overview

Replace the existing Athloryx landing page with a Runna-style onboarding flow. Users answer a series of questions that collect the information needed to generate a personalized training plan. The page replaces all existing landing content.

## Date Formatting

Use `date-fns/format` (already a transitive dependency via shadcn's Calendar). Import as:

```ts
import { format } from "date-fns"
// Display in trigger: format(date, "MMMM d, yyyy")   → "October 12, 2025"
// Display in summary: format(date, "MMM d, yyyy")     → "Oct 12, 2025"
```

## Prerequisites

Install these shadcn components before implementation:

```bash
pnpm dlx shadcn@latest add calendar -c apps/web
pnpm dlx shadcn@latest add popover -c apps/web
pnpm dlx shadcn@latest add select -c apps/web
```

These will be added to `packages/ui/src/components/`.

## Architecture

### Approach: Single-page state machine (Option A)

`apps/web/app/page.tsx` mounts a single `<OnboardingFlow />` component. All existing landing components (`/components/landing/`) are deleted.

`OnboardingFlow` owns three pieces of state:
- `currentStep: number` — the active step index (0-based)
- `direction: 1 | -1` — animation direction; `1` = advancing (slide from right), `-1` = going back (slide from left). Updated before every step transition.
- `formData: OnboardingData` — accumulated answers across all steps

Step routing and skip logic live exclusively in `OnboardingFlow`. Individual step components are stateless — they receive `formData`, `onNext(data: Partial<OnboardingData>)`, and `onBack()` as props. `OnboardingFlow` merges each `Partial<OnboardingData>` into `formData` via `setFormData(prev => ({ ...prev, ...data }))`.

Framer Motion (already available via Magic UI) handles slide transitions. The `direction` state drives the initial/exit animation direction passed to Framer Motion variants.

## State Machine

`currentStep` is a number. The `STEPS` array is derived from `formData.goal`:

```ts
const STEPS_RACE     = ["goal", "findRace", "daysPerWeek", "whichDays", "longRunDay", "units", "strength"]
const STEPS_AEROBIC  = ["goal", "daysPerWeek", "whichDays", "longRunDay", "units", "strength"]
```

`STEPS` defaults to `STEPS_AEROBIC` until `goal` is set. When `currentStep === STEPS.length`, render the final screen.

### Animation key

Use `key={STEPS[currentStep]}` (the step name string) as the Framer Motion key — not `key={currentStep}`. This ensures a re-animation triggers correctly when the STEPS array changes length due to a goal switch at the same index.

### Goal change side effects

Triggered when `onNext({ goal: newGoal })` is called from Step 0 **and `newGoal !== formData.goal`**:
- `formData.race` clears to `undefined`

`currentStep` always advances on any goal tap, regardless of whether the value changed.

Step 0 revisit behavior: Step 0 does **not** auto-advance when revisited (i.e., when `formData.goal !== undefined` at mount). It renders with the current goal card pre-selected and waits for the user to tap. When the user taps any card (same or different), `onNext` is called, side effects fire only if the value changed, and the step advances.

### daysPerWeek change side effects

Triggered when `onNext({ daysPerWeek: n })` is called **and `n !== formData.daysPerWeek`**:
- `formData.selectedDays` resets to `[]`
- `formData.longRunDay` resets to `undefined`

Auto-advance guard: the Days Per Week step auto-advances **if and only if `formData.daysPerWeek === undefined` at mount**. On revisit (value already set), it renders the current value pre-highlighted and waits for an explicit tap. Any tap calls `onNext`, applies side effects if the value changed, and advances.

### selectedDays change side effects

When `selectedDays` changes and `formData.longRunDay` is not in the new `selectedDays` array:
- `formData.longRunDay` resets to `undefined`

## Step Sequence

| Step name | Race path index | Aerobic path index | Shown when |
|-----------|----------------|-------------------|-----------|
| `goal` | 0 | 0 | Always |
| `findRace` | 1 | — | Goal = "race" only |
| `daysPerWeek` | 2 | 1 | Always |
| `whichDays` | 3 | 2 | Always |
| `longRunDay` | 4 | 3 | Always |
| `units` | 5 | 4 | Always |
| `strength` | 6 | 5 | Always |
| Final screen | 7 | 6 | After last step |

## Data Model

```ts
type Goal = "race" | "aerobic_base"
type Day = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"
type Distance = "5k" | "10k" | "half" | "full" | "ultra"
type Units = "km" | "miles"

const DISTANCE_LABELS: Record<Distance, string> = {
  "5k":   "5K",
  "10k":  "10K",
  "half": "Half Marathon",
  "full": "Full Marathon",
  "ultra":"Ultra",
}

const DAY_LABELS: Record<Day, { short: string; full: string }> = {
  mon: { short: "Mon", full: "Monday" },
  tue: { short: "Tue", full: "Tuesday" },
  wed: { short: "Wed", full: "Wednesday" },
  thu: { short: "Thu", full: "Thursday" },
  fri: { short: "Fri", full: "Friday" },
  sat: { short: "Sat", full: "Saturday" },
  sun: { short: "Sun", full: "Sunday" },
}

interface RaceData {
  name: string
  city: string
  date: Date        // must satisfy: date > today (tomorrow is the minimum)
  distance: Distance
}

interface OnboardingData {
  goal?: Goal
  race?: RaceData
  daysPerWeek?: 1 | 2 | 3 | 4 | 5 | 6 | 7
  selectedDays?: Day[]
  longRunDay?: Day
  units?: Units
  strengthTraining?: boolean
}
```

## File Structure

```
apps/web/
  app/page.tsx                          ← mounts <OnboardingFlow />
  components/onboarding/
    onboarding-flow.tsx                 ← state machine, step router, animations
    onboarding-progress.tsx             ← progress bar + "Step X of Y" label
    onboarding-card.tsx                 ← reusable selectable card (single-select only)
    day-toggle.tsx                      ← individual day pill toggle for whichDays step
    steps/
      step-goal.tsx
      step-find-race.tsx
      step-days-per-week.tsx
      step-which-days.tsx
      step-long-run-day.tsx
      step-units.tsx
      step-strength-training.tsx
```

## Layout

All steps and the final screen share the same page layout:
- Full-page centered column, `max-w-md` (448px), `mx-auto`, `px-4`, `py-12`
- `OnboardingProgress` renders at the top of this column, above the step content, on every step except the final screen
- Step content renders below the progress bar
- Back button is positioned at the top-left of the `max-w-md` column (column-relative, not viewport-fixed), visible from step index 1 onward

## Step UX Details

### Slide Animation
- `direction = 1` (advancing): new step enters from right (`x: 60 → 0`), old step exits to left (`x: 0 → -60`)
- `direction = -1` (going back): new step enters from left (`x: -60 → 0`), old step exits to right (`x: 0 → 60`)
- Duration: 300ms, ease-in-out
- Use Framer Motion `AnimatePresence` with `mode="wait"` and `key={STEPS[currentStep]}`

### Step — Goal
- Question: "What is your goal?"
- Two `OnboardingCard`s: **Race** / **Build Aerobic Base**
- On first visit: auto-advances on selection
- On revisit (goal already set): pre-selects current goal, waits for user to tap; advances only on explicit tap
- No back button

### Step — Find Race (race path only)
- Question: "Tell us about your race"
- Four fields stacked vertically:
  - **Race Name** — text input, placeholder "e.g. Boston Marathon", required non-empty
  - **City** — text input, placeholder "e.g. Boston, MA", required non-empty
  - **Date** — shadcn Calendar + Popover. Trigger shows "Pick a date" or "MMMM D, YYYY" when set. Past dates and today are disabled in the Calendar via the `disabled` prop (`(date) => date <= new Date()`). Must be set and valid (future) to enable Next.
  - **Distance** — shadcn Select. Placeholder: "Select a distance". Options: 5K, 10K, Half Marathon, Full Marathon, Ultra. Maps to `Distance` values via `DISTANCE_LABELS`.
- Explicit **Next** button, disabled until all four fields are valid
- Back button returns to Step 0

### Step — Days Per Week
- Question: "How many days per week would you like to run?"
- Row of 7 pill buttons labeled 1–7
- On first visit: auto-advances on selection
- On revisit (daysPerWeek already set): pre-highlights current value, waits for explicit tap; advances only on tap. If a different value is tapped, applies side effects (reset selectedDays/longRunDay).

### Step — Which Days
- Question: "Which days are you free to run?"
- 7 `DayToggle` components in a row: Mon Tue Wed Thu Fri Sat Sun
- Helper text: "Select {N} days ({selected.length} selected)"
- Over-selection is prevented: once N days are selected, unselected `DayToggle`s are disabled
- Explicit **Next** button, enabled only when `selectedDays.length === daysPerWeek`

### Step — Long Run Day
- Question: "Which day would you like your long run?"
- One `OnboardingCard` per day in `formData.selectedDays`, showing full day name (e.g., "Monday")
- Guard: if `selectedDays` is empty/undefined, show "Something went wrong — please go back" with back button
- Auto-advances on selection

### Step — Units
- Question: "Do you prefer km or miles?"
- Two `OnboardingCard`s: **km** / **miles**
- Auto-advances on selection

### Step — Strength Training
- Question: "Would you like to include strength training?"
- Two `OnboardingCard`s: **Yes** / **No**
- Auto-advances on selection

### Final Screen
- No progress indicator, no back button
- Same max-w-md centered column as all other steps
- Centered summary card (`rounded-xl`, `border`, `p-6`) with labeled rows:
  - **Goal:** "Race" or "Build Aerobic Base"
  - **Race** (race path only): "{name} · {city} · {date formatted as 'MMM D, YYYY'} · {DISTANCE_LABELS[distance]}"
  - **Training days:** "{N} days/week — {selectedDays.map(d => DAY_LABELS[d].short).join(', ')}"
  - **Long run:** "{DAY_LABELS[longRunDay].full}"
  - **Units:** "km" or "miles"
  - **Strength training:** "Yes" or "No"
- **"Generate Plan"** button below the card, full width, prominent. Handler is a no-op stub.

## Components

### `OnboardingCard`
Single-select card. No icons (MVP). Selected state: `ring-2 ring-primary bg-primary/5`. Unselected: default border.

```ts
interface OnboardingCardProps {
  label: string
  description?: string
  selected: boolean
  onClick: () => void
}
```

### `DayToggle`
Pill-style toggle for the Which Days step.

```ts
interface DayToggleProps {
  day: Day
  label: string      // short label, e.g. "Mon"
  selected: boolean
  onClick: () => void
  disabled: boolean  // true when N days already selected and this day is not selected
}
```

Selected state: `bg-primary text-primary-foreground`. Disabled+unselected: `opacity-40 cursor-not-allowed`.

### `OnboardingProgress`
Renders at the top of the step column, above step content.

```ts
interface OnboardingProgressProps {
  currentStep: number   // 0-based index
  totalSteps: number    // STEPS.length (final screen excluded)
}
```

- Text: `"Step {currentStep + 1} of {totalSteps}"`
- Progress bar fill: `(currentStep + 1) / totalSteps` (100% on the last question step)
- `totalSteps` is always derived from the live `STEPS` array length. On Step 0 before goal is selected, `STEPS` defaults to `STEPS_AEROBIC` (length 6), so the bar shows "Step 1 of 6". After the user picks "Race", the array becomes length 7 and subsequent steps show "Step X of 7". This live recalculation is intentional.

## Deleted Files

All files in `apps/web/components/landing/` are removed. `page.tsx` is rewritten from scratch.

## Out of Scope

- Backend integration / plan generation (wired up in a future iteration)
- Authentication
- Saving progress / resuming onboarding
- Icons on `OnboardingCard`
