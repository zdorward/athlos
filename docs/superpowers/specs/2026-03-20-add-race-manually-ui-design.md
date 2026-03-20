# Add Race Manually — UI Redesign

**Date:** 2026-03-20
**Status:** Approved

## Problem

Two entry points exist for manually adding a race:

1. `apps/web/app/manual-race-sheet.tsx` — used on the landing page as a bottom-sheet overlay
2. `apps/web/components/onboarding/steps/step-find-race.tsx` → `ManualRaceForm` — used inline within the onboarding flow

Both share the same issues with fields:
- **Calendar height jump on mobile:** The `Popover` + `Calendar` pattern causes the sheet to shift up and down as the user navigates between months with different week counts (4 vs 5 rows).
- **Distance selector UX:** A `Select` dropdown is overkill for 2 mutually exclusive options. One tap should suffice.

Additionally, `ManualRaceSheet` renders as a bottom drawer on all screen sizes, which looks out of place on desktop.

## Design

### Shared field improvements (both entry points)

| Field | Current | New |
|---|---|---|
| Race name | Text input | Text input (unchanged) |
| City | Text input | Text input (unchanged) |
| Distance | `Select` dropdown (Half / Full) | Segmented control — two buttons: "Half · 21.1 km" / "Full · 42.2 km", **defaults to Full** |
| Race date | `Popover` trigger → floating `Calendar` | Inline `Calendar` rendered directly in the form — no trigger button |

**Inline calendar details:**
- Always renders a fixed 6-row grid (padding empty cells at start/end of month as needed). This ensures the calendar height never changes when navigating months.
- Selected date is highlighted in the grid.
- Month navigation arrows remain above the grid.
- No popover — the calendar is part of the form layout.

**Segmented control details:**
- Two-segment pill: `Half · 21.1 km` | `Full · 42.2 km`
- Full Marathon selected by default.
- Active segment uses primary accent background; inactive is muted.

### `ManualRaceSheet` — responsive container

The landing-page sheet becomes responsive using a `useMediaQuery("(min-width: 768px)")` hook.

**Mobile (< 768px):** Existing bottom-sheet pattern — `fixed inset-0 items-end`, drag handle, rounded top corners, dimmed backdrop, click-outside to dismiss. Form scrolls within the sheet if content overflows.

**Desktop (≥ 768px):** Renders a shadcn `Dialog` — centered modal, ~400px wide, rounded corners, dimmed backdrop, click-outside to dismiss. No drag handle.

The form fields are extracted into a shared internal component (`ManualRaceFormFields`) rendered identically inside both shells. No field logic is duplicated.

### `ManualRaceForm` (onboarding) — fields only

No container changes. The inline form that replaces the step view already sits correctly in the layout. Apply field improvements only:
- Distance `Select` → segmented control (Full default)
- Date `Popover`/`Calendar` → inline calendar (fixed 6-row grid)

Back button and Continue button unchanged.

## Files to change

| File | Change |
|---|---|
| `apps/web/app/manual-race-sheet.tsx` | Responsive container (sheet → dialog on desktop) + field improvements |
| `apps/web/components/onboarding/steps/step-find-race.tsx` | Field improvements to `ManualRaceForm` only |

## Out of scope

- City field: text input stays as-is (manual entry path, free-form location)
- Any changes to the race search flow or `StepFindRace` component beyond `ManualRaceForm`
- Adding more distance options
