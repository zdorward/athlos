# Landing Page Redesign — Design Spec

**Date:** 2026-03-14
**Status:** Approved

---

## Overview

Redesign the landing page to lead with the race finder as the primary value proposition. Replace the generic hero with an embedded race search that immediately drops users into the plan generation flow. Remove the aerobic base goal option — the product is race-focused. Add an animated aurora background for a premium, high-performance aesthetic.

---

## Landing Page

### Background

Three slow-moving aurora bloom layers behind a faint dot grid:

- **Grid:** `background-image` using two `linear-gradient` rules at `rgba(80,100,255,0.05)`, `40px` spacing, applied to a full-bleed `position: absolute` div.
- **Blooms:** Three `position: absolute` divs with `border-radius: 50%`, `filter: blur(80px)`, and `radial-gradient` fills in deep blue (`rgba(30,55,200,0.22)`, `rgba(15,80,180,0.18)`, `rgba(40,40,160,0.12)`). Each animates independently via CSS `@keyframes` with durations of 22–34s and `ease-in-out infinite alternate` — translating, scaling, and rotating slightly.
- **Vignette:** A `radial-gradient` overlay (`rgba(1,1,8,0.7)` at edges, transparent at center) keeps the edges very dark and focuses attention on the center.
- Background color: `#020208`.

### Nav

- Logo text `"ATHLORYX"` — `font-size: 15px`, `font-weight: 700`, `letter-spacing: 0.1em`, `color: rgba(255,255,255,0.85)`. Top-left.
- **Log in** button — top-right. On click, opens the existing `SignInSheet`. Pass all three props: `callbackURL="/dashboard"` (the component defaults to `"/plan"` — must override), `onBeforeSignIn={() => {}}`, `onClose={() => setShowSignIn(false)}`. The existing copy ("Save your plan") is acceptable for now — no changes to `SignInSheet` text. Same ghost button style as the existing implementation.
- Nav is `position: absolute` over the background, `z-index: 10`, `padding: 24px 36px`.

### Hero

Centered vertically and horizontally. No eyebrow text. No subtitle.

**Headline:** `"When's your next race?"` — `font-size: clamp(40px, 6vw, 64px)`, `font-weight: 700`, `letter-spacing: -0.04em`, two lines.

**Race search widget** (below headline, `max-width: 480px`, full-width on mobile):

- Search input box: `background: rgba(255,255,255,0.05)`, `border: 1px solid rgba(255,255,255,0.12)`, `border-radius: 14px`, `height: 56px`, `backdrop-filter: blur(12px)`. Contains a search icon and a text input with placeholder `"Search races by name or city…"`.
- When the input has focus or a non-empty value, a dropdown appears below the input. The input's bottom border-radius collapses to 0 and the dropdown picks up with matching border. The dropdown closes when the user clicks outside the widget (use a `useEffect` + `mousedown` listener or equivalent).
- **Dropdown:** `background: rgba(8,8,20,0.95)`, `border: 1px solid rgba(100,140,255,0.25)` (no top border), `border-bottom-left-radius: 14px; border-bottom-right-radius: 14px`, `backdrop-filter: blur(20px)`. Each result row shows race name, city + formatted date, and a distance badge. `race.date` is an ISO string from `@/data/races` — use `parseISO(race.date)` (from `date-fns`) before formatting for display. Hover state: `background: rgba(80,120,255,0.08)`.
- **Footer row:** `"Don't see yours? Add it manually →"` — switches the widget to manual entry mode (reuses the existing manual form from `StepFindRace`).
- Race data comes from the existing `RACES` array in `@/data/races`. Filtering logic: same as `StepFindRace` (name, city, province match).
- **Empty query:** show the full list (same as existing `StepFindRace` behaviour).
- **No results:** show `"No races found for "…""`.

**Remove:** The existing `"Create a Plan"` button is removed. The search widget is the sole CTA.

### Selecting a Race

When the user clicks a race result from the landing page dropdown:

1. Convert the selected `Race` (from `@/data/races`) to `RaceData` — the same shape `StepFindRace.handleRaceSelect` produces:
   ```typescript
   const raceData: RaceData = {
     name: selectedRace.name,
     city: `${selectedRace.city}, ${selectedRace.province}`,
     date: parseISO(selectedRace.date),
     distance: selectedRace.distance,
   }
   ```
2. Set `initialData = { goal: "race", race: raceData }`.
3. Enter the onboarding flow (`setShowOnboarding(true)`), passing `initialData`. The `OnboardingFlow` in `page.tsx` is rendered as:
   ```tsx
   <OnboardingFlow onExit={() => setShowOnboarding(false)} initialData={initialData} />
   ```
4. The flow starts at `StepTimeGoal` (skipping `StepFindRace` and `StepGoal`).

When the user clicks "Add it manually →" from the dropdown footer:

1. Enter the onboarding flow with `initialData = { goal: "race", manualRaceEntry: true }`.
2. The flow starts at `StepFindRace`. `StepFindRace` should accept an `initialMode?: "search" | "manual"` prop; when `"manual"`, it initialises its internal `mode` state to `"manual"` instead of `"search"`. `OnboardingFlow` reads `initialData.manualRaceEntry` and passes `initialMode="manual"` to `StepFindRace`.

---

## Onboarding Changes

### Remove `StepGoal`

- Delete `apps/web/components/onboarding/steps/step-goal.tsx`.
- Remove `"goal"` from the step sequence in `getSteps()`.
- `getSteps()` always returns the race path. Signature simplifies to `getSteps(timeGoal?: boolean, strengthTraining?: boolean)`.
- The `aerobic_base` branch in `getSteps()` is removed entirely.

### Remove `"aerobic_base"` from types

- In `types.ts`: `Goal` type becomes `type Goal = "race"` (or remove `Goal` entirely and replace with a literal). Keep `goal?: Goal` in `OnboardingData` — it will continue to be set via `initialData` from the landing page and consumed by the plan generation API call.
- Remove the `aerobicSteps` array from `getSteps()`.
- Add `manualRaceEntry?: boolean` to `OnboardingData`.

### `OnboardingFlow` — `initialData` prop

```typescript
interface OnboardingFlowProps {
  onExit: () => void
  initialData?: Partial<OnboardingData>
}
```

- `formData` is initialized from `initialData ?? {}` instead of `{}`.
- `currentStep` starts at `0` against the computed `steps` array. Since steps are derived from `formData` (which includes `goal: "race"` and optionally `race`), the first step rendered is already correct — if `race` is pre-filled, `getSteps()` returns `["timeGoal", ...]` and step 0 is `StepTimeGoal`.

### Step sequence after removal

For all users (race goal only):

```
findRace → timeGoal → [goalTime] → whichDays → longRunDay → units → strength → [strengthDays]
```

When `initialData.race` is provided (landing page entry), `findRace` is skipped:

```
timeGoal → [goalTime] → whichDays → longRunDay → units → strength → [strengthDays]
```

This is handled naturally: `getSteps()` no longer includes `"goal"`. The `"findRace"` step remains in the sequence for direct `/plan` navigation. When `race` is pre-filled via `initialData`, the computed steps array omits `"findRace"`, so `currentStep` 0 is already `StepTimeGoal`.

**Implementation note:** `getSteps()` currently does not take `race` as a parameter; it only branches on `goal`, `timeGoal`, and `strengthTraining`. To skip `findRace` when race is pre-filled, add a `hasRace?: boolean` parameter:

```typescript
export function getSteps(
  timeGoal?: boolean,
  strengthTraining?: boolean,
  hasRace?: boolean
): readonly string[]
```

Return `["findRace", "timeGoal", ...]` when `!hasRace`, and `["timeGoal", ...]` when `hasRace`. `OnboardingFlow` passes `!!formData.race` as `hasRace`.

The updated call site in `onboarding-flow.tsx` becomes:

```typescript
const steps = getSteps(formData.timeGoal, formData.strengthTraining, !!formData.race)
```

The `goal` positional argument is removed entirely (it was previously position 1). Update this call site explicitly — do not add `hasRace` as a 4th argument. Before changing the signature, search the codebase for all call sites of `getSteps` and update each one.

---

## Files Changed

| File | Change |
|---|---|
| `apps/web/app/page.tsx` | Full rewrite: aurora background, race search hero, Log in button wired to SignInSheet |
| `apps/web/components/onboarding/onboarding-flow.tsx` | Accept `initialData` prop; initialize `formData` from it; pass `!!formData.race` to `getSteps()`; remove `StepGoal` import and `case "goal"` branch from `renderStep`; pass `initialMode` to `StepFindRace` based on `formData.manualRaceEntry`; remove the now-dead `goal` change guard in `handleNext` |
| `apps/web/components/onboarding/types.ts` | Remove `aerobic_base` from `Goal`; update `getSteps()` signature to remove `goal`, add `hasRace`; add `manualRaceEntry?: boolean` to `OnboardingData` |
| `apps/web/components/onboarding/steps/step-goal.tsx` | Delete |
| `apps/web/components/onboarding/steps/step-find-race.tsx` | Add `initialMode?: "search" \| "manual"` prop; initialise internal `mode` state from it |

---

## Out of Scope

- Mobile-specific landing page layout changes beyond responsive sizing
- Animations on the hero text or CTA
- Keyboard navigation / ARIA accessibility for the landing page race search dropdown
- Animated transition from the landing page into the onboarding flow (hard swap is fine)
- Saving the race selection to local storage before sign-in
- Any dashboard or plan view changes
