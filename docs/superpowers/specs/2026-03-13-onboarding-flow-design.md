# Onboarding Flow Design

**Date:** 2026-03-13
**Status:** Approved

## Overview

Replace the existing Athloryx landing page with a Runna-style onboarding flow. Users answer a series of questions that collect the information needed to generate a personalized training plan. The page replaces all existing landing content.

## Architecture

### Approach: Single-page state machine (Option A)

`apps/web/app/page.tsx` mounts a single `<OnboardingFlow />` component. All existing landing components (`/components/landing/`) are deleted.

`OnboardingFlow` owns two pieces of state:
- `currentStep: number` — the active step index
- `formData: OnboardingData` — accumulated answers across all steps

Step routing and skip logic live exclusively in `OnboardingFlow`. Individual step components are stateless — they receive `formData`, `onNext(data)`, and `onBack()` as props.

Framer Motion (already available via Magic UI) handles slide transitions between steps.

## Step Sequence

| # | Step | Shown when |
|---|------|-----------|
| 1 | Goal | Always |
| 2 | Find Race | Goal = "race" only |
| 3 | Days Per Week | Always |
| 4 | Which Days | Always |
| 5 | Long Run Day | Always |
| 6 | Units | Always |
| 7 | Strength Training | Always |

Total steps: **6** (aerobic base) or **7** (race). Progress indicator reflects the correct count dynamically.

## Data Model

```ts
type Goal = "race" | "aerobic_base"
type Day = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"
type Distance = "5k" | "10k" | "half" | "full" | "ultra"
type Units = "km" | "miles"

interface OnboardingData {
  goal?: Goal
  race?: {
    name: string
    city: string
    date: Date | null
    distance: Distance
  }
  daysPerWeek?: number          // 1–7
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
    onboarding-card.tsx                 ← reusable selectable card (single/multi)
    steps/
      step-goal.tsx                     ← Race | Build Aerobic Base
      step-find-race.tsx                ← name, city, date, distance
      step-days-per-week.tsx            ← 1–7 day selector
      step-which-days.tsx               ← Mon–Sun toggle grid
      step-long-run-day.tsx             ← pick one from selected days
      step-units.tsx                    ← km | miles
      step-strength-training.tsx        ← yes | no
```

## Step UX Details

### Layout
Every step uses the same centered layout: question title at top, answer options below. Back button (top-left) is visible from step 2 onward.

### Step 1 — Goal
- Question: "What is your goal?"
- Two large selectable cards: **Race** and **Build Aerobic Base**
- Auto-advances on selection

### Step 2 — Find Race (race path only)
- Question: "Tell us about your race"
- Four fields:
  - **Race Name** — text input
  - **City** — text input
  - **Date** — shadcn Calendar + Popover. Clicking opens a calendar overlay; month/year headers are tappable to jump quickly. Selected date displayed as plain text (e.g., "October 12, 2025"). Handles races months in advance without excessive navigation.
  - **Distance** — dropdown: 5K, 10K, Half Marathon, Full Marathon, Ultra
- Explicit Next button (all fields required)

### Step 3 — Days Per Week
- Question: "How many days per week would you like to run?"
- Row of 7 numbered buttons (1–7)
- Auto-advances on selection

### Step 4 — Which Days
- Question: "Which days are you free to run?"
- Mon–Sun toggle grid
- User must select exactly N days (N = answer from step 3)
- Explicit Next button (enforces correct count)

### Step 5 — Long Run Day
- Question: "Which day would you like your long run?"
- Single-select from the days chosen in step 4
- Auto-advances on selection

### Step 6 — Units
- Question: "Do you prefer km or miles?"
- Two selectable cards: **km** and **miles**
- Auto-advances on selection

### Step 7 — Strength Training
- Question: "Would you like to include strength training?"
- Two selectable cards: **Yes** and **No**
- Auto-advances on selection, then shows final screen

### Final Screen
- Brief summary of user's selections
- "Generate Plan" button (behavior wired up later)

## Components

### `OnboardingCard`
Reusable selectable card used across multiple steps. Accepts:
- `label: string`
- `description?: string`
- `selected: boolean`
- `onClick: () => void`

### `OnboardingProgress`
- Displays "Step X of Y" text
- Progress bar showing completion percentage
- Positioned at the top of every step

## Deleted Files

All files in `apps/web/components/landing/` are removed. `page.tsx` is rewritten from scratch.

## Out of Scope

- Backend integration / plan generation (wired up in a future iteration)
- Authentication
- Saving progress / resuming onboarding
