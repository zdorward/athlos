---
name: Bridge Runs Server-Side Generation
description: Move bridge day generation from client to the generate-plan API route so the plan response is complete and self-contained.
type: spec
---

# Bridge Runs Server-Side Generation

## Problem

Bridge days (gap-fill runs between today and the first Monday of the plan) are currently generated client-side in `apps/web/app/plan/page.tsx` after the API response arrives. This means:

- The API returns an incomplete plan — it starts on next Monday, not today.
- The client is responsible for stitching together two separate outputs before rendering or saving.
- `planStartDate` must be tracked separately from `days[]` to allow the calendar to distinguish bridge days from plan weeks.
- "Today" is derived from the server clock, which misaligns with the user's local date near midnight or across timezones.

## Goal

The `generate-plan` API returns a complete, self-contained plan: bridge days prepended, plan weeks following, and `planStartDate` explicitly in the response. The client becomes a pure renderer.

## Design

### `PlanGenerationInput` — new `today` field

Add an optional `today?: string` (ISO date, e.g. `"2026-03-18"`) to `PlanGenerationInput` in `packages/plan-engine/src/types.ts`. Optional so existing callers (tests, direct API calls) don't break — the route falls back to `new Date()` if absent.

### `generate-plan/route.ts` — call `buildBridgeRuns` server-side

After `scheduleWorkouts` produces `days` and the race-day replacement block runs (both operate on the raw plan days):

1. Capture `planStartDate = days[0]?.date` — this is the first Monday of the generated plan. **Capture this before prepending bridge days.** `days[0]` is a string (captured by value), so the subsequent race-day mutation of the array does not affect it; `planStartDate` must still be captured in step 1, not after step 4.
2. Resolve `todayISO` from `input.today ?? new Date().toISOString().slice(0, 10)`.
3. Call `buildBridgeRuns(input, days, new Date(todayISO + "T00:00:00Z"))`. The `T00:00:00Z` suffix is intentional — it constructs a UTC midnight `Date`, which is consistent with how `buildBridgeRuns` normalizes its `today` argument internally.
4. If bridge days exist, prepend and sort: `finalDays = [...bridgeDays, ...days].sort((a, b) => a.date.localeCompare(b.date))`.
5. Return `{ days: finalDays, planStartDate, totalWeeks, totalKm, peakWeekKm, phases }`.

### `plan/page.tsx` — remove client-side bridge logic

- Pass `today: new Date().toLocaleDateString("en-CA")` in the generate request body. This sends the user's local date (in `YYYY-MM-DD` format) rather than relying on the server clock, which may disagree with the user's timezone near midnight.
- Remove `buildBridgeRuns` import and call.
- Remove the `finalDays` construction block.
- Use `result.planStartDate` directly for `setPlanStartDate`.

**Snapshot restore path:** The auto-save-after-OAuth path restores from `localStorage` and bypasses generation. After this change, `snapshot.days` already includes bridge days (they were saved in the original session). The `SavedPlanSnapshot` type gains a `planStartDate` field (string). When saving the snapshot in `handleBeforeSignIn`, set `planStartDate` from the current `planStartDate` state. When restoring, call `setPlanStartDate(snapshot.planStartDate)`. Fallback for legacy snapshots without the field: derive it by finding the first Monday in `snapshot.days` (same logic used in the saved plan view).

### `SavedPlanSnapshot` — add `planStartDate`

```ts
interface SavedPlanSnapshot {
  input: PlanGenerationInput
  days: WorkoutDay[]
  totalWeeks: number
  totalKm: number
  peakWeekKm: number
  phases?: PhaseEntry[]
  planStartDate?: string   // optional for backward compat with existing snapshots
  savedAt: number
}
```

### Save body — no change

`current.days` naturally includes bridge days. The saved plan view already derives `planStartDate` by finding the first Monday in `plan.days`.

## Affected Files

| File | Change |
|------|--------|
| `packages/plan-engine/src/types.ts` | Add `today?: string` to `PlanGenerationInput` |
| `apps/web/app/api/generate-plan/route.ts` | Call `buildBridgeRuns`, prepend bridge days, return `planStartDate` |
| `apps/web/app/plan/page.tsx` | Remove client-side bridge logic; pass `today` in request body; use `result.planStartDate`; update `SavedPlanSnapshot` and snapshot restore path |

## Out of Scope

- Saving `planStartDate` explicitly to the DB (already handled by the saved plan view deriving it from the first Monday in `plan.days`).
- Moving bridge run logic into `scheduleWorkouts` itself.
- Any changes to the saved plan view (`(app)/plan/[id]/page.tsx`) — already fixed separately.
