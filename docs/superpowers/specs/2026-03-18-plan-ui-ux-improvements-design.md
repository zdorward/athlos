---
name: Plan UI/UX Improvements
description: Six targeted UI/UX improvements to the plan view, nav, color scheme, and workout type definitions.
type: spec
---

# Plan UI/UX Improvements

## Problem

Several small but meaningful UX issues in the plan view and nav:

1. The saved plan header has a redundant back button and border — the global nav already provides navigation.
2. Phase labels are visually closer to the week below than the week above, creating a misleading grouping.
3. Settings occupies a primary nav slot despite being a low-frequency action.
4. Workout cells are monochromatic — you can't scan training stress at a glance.
5. "Progression Run" is not a useful label for runners — "MP Finish" describes what the session actually does.
6. `medium-long` is a dead `WorkoutType` that is defined but never scheduled — it is unreachable dead code.

## Goal

A plan calendar that communicates training stress at a glance, a nav that reflects usage frequency, and a plan header that doesn't waste space on redundant controls.

## Design

### 1 — Saved plan header (flat layout)

`PlanHeader` gains a `variant` prop: `"generation"` (default, existing behavior) | `"saved"` (new flat layout).

**`"saved"` variant:**
- Single row, no `border-b`.
- `py-5` vertical padding.
- Left side: plan name in `text-base font-semibold`, meta string (`29 weeks · 1911 km · Goal 3:20`) stacked below in `text-xs text-muted-foreground`.
- Right side: "New plan" button only. `saveProps` and error/rate-limited status messages are not rendered in this variant — they are only relevant during generation.
- No back button, no border-bottom, no centered absolute layout.

**`"generation"` variant:** unchanged — back button, centered absolute title, border-bottom.

`apps/web/app/(app)/plan/[id]/page.tsx` passes `variant="saved"` to `PlanHeader`.

### 2 — Phase label spacing

`PhaseHeader` component in `plan-calendar.tsx`:

```
mt-3 mb-1  →  mt-5 mb-2
```

Gives the label balanced breathing room above and below, so it visually belongs between the two week rows rather than hugging the one below.

### 3 — Settings — temporary dashboard link

Remove `Settings` from `AppNav`'s `tabs` array. This removes it from both the desktop top nav and the mobile bottom tab bar, leaving two tabs: **Dashboard · Plan**.

Add a plain `<Link href="/settings">` to the dashboard page — small, unobtrusive (e.g., `text-sm text-muted-foreground` at the bottom of the dashboard content area). This is explicitly a temporary placement until a mobile avatar/profile pattern is designed.

> **Out of scope:** mobile avatar/top-bar for accessing settings on mobile. Deferred to a separate spec.

### 4 — Intensity zone color scheme

Update `getWorkoutColor` and `WORKOUT_TEXT_CLASS` in `apps/web/app/plan/workout-utils.ts` to reflect training stress zones:

| Type | Zone | Color |
|------|------|-------|
| `easy` | Aerobic | Green |
| `long` | Aerobic | Green |
| `progression` | Aerobic | Green |
| `shakeout` | Aerobic | Green |
| `tempo` | Threshold | Amber |
| `mp` | Threshold | Amber |
| `intervals` | VO2max / Hard | Red |
| `strength` | Accessory | Purple |
| `rest` | — | Muted (no color) |
| `race` | — | Primary accent (unchanged) |

**oklch values (dark-mode optimised):**
- Green: `oklch(0.72 0.17 150)` (text), `oklch(0.28 0.06 150)` (cell bg)
- Amber: `oklch(0.76 0.17 75)` (text), `oklch(0.28 0.07 75)` (cell bg)
- Red: `oklch(0.68 0.20 25)` (text), `oklch(0.24 0.07 25)` (cell bg)
- Purple: `oklch(0.70 0.14 285)` (text), `oklch(0.26 0.06 285)` (cell bg)

`getWorkoutColor` returns the text/icon color (oklch string or `""` for muted/uncolored types). For all newly colored types (`easy`, `long`, `progression`, `shakeout`, `tempo`, `mp`, `intervals`, `strength`), `WORKOUT_TEXT_CLASS` must be set to `""` so the Tailwind class does not conflict with the inline oklch `style` color. The inline `style` wins specificity, but leaving stale Tailwind color classes behind is a code smell.

The cell background tints (green/amber/red bg on completed cells, race cell, etc.) already use Tailwind green/primary classes and are not driven by `getWorkoutColor` — no change needed there.

### 5 — Rename "progression" → "MP Finish"

In `WORKOUT_NAMES` in `workout-utils.ts`:

```ts
"progression": "MP Finish"
```

The internal type key stays `"progression"` — no DB migration, no type changes elsewhere.

### 6 — Remove `medium-long` dead type

`medium-long` is defined in `WorkoutType` but never produced by any scheduler. Remove it from:

- `WorkoutType` union in `packages/plan-engine/src/types.ts`
- `WORKOUT_NAMES` in `workout-utils.ts`
- `WORKOUT_TEXT_CLASS` in `workout-utils.ts`
- `getWorkoutColor` in `workout-utils.ts`
- `getHRZone` in `workout-utils.ts`
- `getWorkoutNote` in `workout-utils.ts` (if present)
- `RUN_TYPES` set in `workout-utils.ts`
- `WORKOUT_STYLES` in `apps/web/app/plan-preview.tsx` (has its own local type map)
- `WEEK_TEMPLATES` mock data in `apps/web/app/plan-preview.tsx` — two day entries use `type: "medium-long"`; replace both with `"easy"`
- Any `WorkoutType` reference in `apps/web/app/api/generate-plan/route.test.ts`

Run `pnpm typecheck` after to confirm no references remain.

## Affected Files

| File | Change |
|------|--------|
| `apps/web/app/plan/plan-header.tsx` | Add `variant` prop; implement `"saved"` flat layout |
| `apps/web/app/(app)/plan/[id]/page.tsx` | Pass `variant="saved"` |
| `apps/web/app/plan/plan-calendar.tsx` | `PhaseHeader` spacing: `mt-3 mb-1` → `mt-5 mb-2` |
| `apps/web/app/(app)/components/app-nav.tsx` | Remove Settings tab |
| `apps/web/app/(app)/dashboard/dashboard-client.tsx` | Add temporary Settings link |
| `apps/web/app/plan/workout-utils.ts` | Rename progression, new colors, remove medium-long from all maps including `RUN_TYPES` |
| `packages/plan-engine/src/types.ts` | Remove `medium-long` from `WorkoutType` |
| `apps/web/app/plan-preview.tsx` | Remove `medium-long` from local `WORKOUT_STYLES` map |
| `apps/web/app/api/generate-plan/route.test.ts` | Remove `medium-long` from any `WorkoutType` references |

## Out of Scope

- Mobile avatar/profile pattern for accessing Settings on mobile (separate spec)
- Any changes to plan generation logic
- DB schema changes
