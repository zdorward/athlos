# Dashboard Redesign

**Date:** 2026-03-14
**Status:** Approved

## Goal

Redesign the dashboard to drive a daily habit loop: open app → see today's workout → complete it → log effort → feel progress. Every screen visit should reinforce three rewards: completion (checkmark), fitness progress (plan advancing), and goal proximity (race countdown).

## Habit Loop

```
Open app
↓
See today's workout
↓
Complete workout
↓
Log effort (Hard / Good / Easy)
↓
Plan adapts (future)
↓
Projected race time improves (future)
↓
Come back tomorrow
```

## Screen Structure

### 1. Race Countdown Banner

Full-width gradient card at the top of the dashboard. Always visible — the emotional anchor tying every workout to the goal.

**Contents:**
- Race name + date (from `plan.input.race.name` and `plan.input.race.date`)
- Days away — large, prominent number (derived from today vs race date)
- Progress bar — week X of Y through the plan (current week derived from today vs plan start date)
- Phase label — from existing `getPhaseLabel(weekNum, totalWeeks, taperWeeks)` utility; `taperWeeks` from `getTaperWeeks(plan.input.race.distance)`
- Projected finish time — visible slot, locked state ("Coming soon") until the feature is built

**Post-race state:** Once the race date has passed, hide the banner entirely. The dashboard shows today's workout only (or empty state if the plan has ended).

**Pre-plan-start state:** If today is before the plan's first workout date, show the banner with a "Your plan starts on [date]" message where the workout section would be.

### 2. Today's Workouts

"Today's workouts" means the literal entries in the plan whose `date` equals today's ISO date — not a forward scan. Rest entries with `type === "rest"` on today's date trigger the rest day state.

Section label: day name (e.g. "Thursday").

Each non-rest workout for today renders as a card with a left color border:
- Workout type (Easy Run, Tempo, Strength, etc.)
- Distance (km)
- Description
- "Mark Complete" CTA button

If there are multiple workouts on the same day (e.g. run + strength), they stack as separate cards, each with their own independent "Mark Complete".

**Rest days:** If today's only entry is `type === "rest"`, show a muted "Rest day" card with no CTA. The tomorrow preview (see Section 4) appears below it unconditionally.

### 3. Post-Completion State

When the user taps "Mark Complete" on a workout:
1. Card turns green with a checkmark
2. Effort picker appears inline below the card — no new screen, no navigation
3. Three options rendered as buttons with text labels (emoji are decorative only, always accompanied by visible text): 😓 Hard · 😊 Good · ⚡ Easy
4. Tapping an effort option records it and dismisses the picker
5. Skipping: there is no explicit skip button. If the user does not interact with the effort picker, effort remains `undefined` on that workout. The prompt does not reappear on subsequent visits.

**Tomorrow preview trigger:** The tomorrow preview (Section 4) appears once ALL non-rest workouts for today are marked complete. While any workout is still incomplete, the preview does not show.

All completion and effort updates use optimistic state updates with rollback on API failure — same pattern as the existing `handleComplete` in `dashboard/page.tsx`.

### 4. Tomorrow Preview

After all today's workouts are complete (or on a rest day), the next upcoming non-rest workout appears as a muted, read-only preview card below today's section. Label is "Tomorrow" if the next workout is the following calendar day, otherwise the actual day name (e.g. "Saturday"). No "Mark Complete" CTA.

### 5. View Full Plan

A simple text link at the bottom: "View full plan →" navigating to `/plan/{id}`.

## Removed Components

`WeekList` (`dashboard/week-list.tsx`) is removed. It is replaced by the tomorrow preview. The file can be deleted.

## Data Changes

### WorkoutDay type (`@workspace/ai`)

Add optional `effort` field:

```ts
effort?: "hard" | "good" | "easy"
```

### PATCH endpoint (`/api/plans/[id]`)

Add a third update path alongside the existing `isFieldUpdate` and `isCompletionToggle` branches:

**Effort update** — triggered when the body contains `effort` but not `completed` and not `update`:

```json
{ "date": "2026-03-14", "type": "easy", "effort": "good" }
```

Rules:
- `effort` can be sent standalone (does not require `completed: true` to already be set)
- `effort` can also be sent together with `completed: true` in a single request (completion + effort in one call)
- If both `completed` and `effort` are present, apply both to the entry
- `effort` can be updated after the fact by sending a new effort-only payload

The endpoint body type becomes:

```ts
{
  date?: string
  type?: WorkoutType
  completed?: boolean
  effort?: "hard" | "good" | "easy"
  update?: FieldUpdate
}
```

Branching logic:
- `isFieldUpdate`: `body.update !== undefined`
- `isCompletionOrEffort`: `!isFieldUpdate && (body.completed !== undefined || body.effort !== undefined)`
- Both require `date` and `type`

## What Is Not Changing

- The calendar view (`/plan/[id]`) remains unchanged
- The "New plan" button in the plan header remains
- The dashboard header (Athloryx logo + user avatar) remains
- The `WorkoutCard` component is replaced/refactored as needed — the existing component was built for the old dashboard structure and may not map cleanly to the new layout

## Future Placeholders

Two slots are designed into the UI now but show locked/coming-soon state until built:

1. **Projected finish time** — shown in race banner, grayed out with "Coming soon" label
2. **Plan adaptation** — effort data captured now feeds this feature later

## States to Handle

| Situation | What to show |
|---|---|
| Today has non-rest workouts | Workout cards with Mark Complete CTAs |
| Today is a rest day | Muted "Rest day" card + tomorrow preview below |
| All today's workouts complete | All cards green + effort pickers → tomorrow preview |
| Multiple workouts today | Stacked cards, independent completion; tomorrow preview after all complete |
| Before plan start date | Race banner + "Your plan starts on [date]" message |
| After race date | No banner; workout section or empty state |
| Plan complete (no future workouts) | Existing "after-end" state |
| No plan | Redirect to empty state (existing behavior) |
