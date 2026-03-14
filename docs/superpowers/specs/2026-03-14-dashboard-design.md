# Dashboard & Post-Save Navigation — Design Spec

**Date:** 2026-03-14
**Status:** Approved

---

## Overview

After a user saves their training plan, they are redirected to a new `/dashboard` route that serves as the authenticated home. The dashboard shows today's workout as a hero card, tomorrow as a preview, and the rest of the week as a compact list. A profile avatar in the top right provides account access and sign-out. Logged-in users who visit `/` are redirected to `/dashboard`.

---

## Routes

| Route | Description |
|---|---|
| `/` | Landing page. Redirects to `/dashboard` if session exists. |
| `/dashboard` | Authenticated home. Redirects to `/` if no session. |
| `/plan` | Plan generation page. Client-side post-save behavior updated (see below). |
| `/plan/[id]` | Read-only full plan view, loaded from DB by plan ID. |

---

## Dashboard Layout

Single-column, centered layout (max-width ~640px) on both mobile and desktop.

### Header
- Athloryx name/logo on the left.
- Profile avatar on the right.
- Avatar click opens a dropdown: user name + email (display only), divider, "Sign out" button.

### Active Plan Selection
`GET /api/plans` returns plans ordered by `createdAt` desc with full `days` arrays included. Dashboard uses `plans[0]` as the active plan.

**Empty state (no plans):** Centered message — "You don't have a saved plan yet." — with a button linking to `/`.

**Fetch error state (non-401 network/server error):** Centered message — "Unable to load your plan. Please try again." — with a retry button that re-fetches.

### Resolving "Today" Against the Plan
Today's ISO date is computed client-side as `new Date().toLocaleDateString("en-CA")` (produces `YYYY-MM-DD` in local time). The dashboard finds all entries in `days` where `day.date === todayISO`. A day with no entries, or where all matching entries have `type === "rest"`, is treated as a rest day.

### Today's Workout (hero card)
- One card per entry for today. Multiple entries on the same date (e.g. run + strength) render multiple cards.
- Each card shows: workout type badge (existing color system), date, `distanceKm` (omitted if absent), `description`.
- **Rest day** (no entries or all `type: "rest"`): single card — "Rest Day — Recovery is part of training."
- **Before plan start** (today < first `date` in `days`): single card — "Your plan starts on [first plan date]."
- **After plan end** (today > last `date` in `days`): single card — "Your plan is complete 🎉"

### Tomorrow (preview card)
- Resolved the same way as Today but with date = today + 1 day.
- Multiple entries tomorrow → multiple smaller, de-emphasized preview cards.
- Applies the same rest/before-start/after-end states as Today, rendered in a de-emphasized style.

### This Week
- Shows days from (today + 2) through the Sunday that ends the current Mon–Sun calendar week (inclusive).
- **Sunday of current week** = today + `(7 - today.getDay()) % 7` days (where `getDay()` returns 0 for Sunday).
- **Omit entirely** if today + 2 > Sunday of current week (i.e. today is Saturday or Sunday).
- If today is Friday, Sunday of current week = today + 2: one row is shown (Sunday only). This is valid.
- Each row: day name, workout type badge, `distanceKm` (omitted for rest days).
- All rows navigate to `/plan/[id]`.
- "View Full Plan →" link always renders below the list and navigates to `/plan/[id]`.

---

## Profile Avatar & Dropdown

- Photo from `session.user.image` (Google profile photo). Falls back to initials.
- **Initials logic:** split `session.user.name` on whitespace; use first character of the first token + first character of the last token, uppercased. If name is one token (including single characters), use its first character only. If name is empty, null, or undefined, use the first character of `session.user.email`, uppercased.
- Dropdown contents:
  - User display name (bold)
  - User email (muted, smaller)
  - Divider
  - "Sign out" button → calls `authClient.signOut()`, then `router.replace("/")` regardless of whether `signOut()` resolves or rejects.

---

## Post-Save Flow

The `savePlanToServer` function in `apps/web/app/plan/page.tsx` is updated as follows:

- **2xx response:** call `router.push("/dashboard")`. The `isSaved` state and the "Saved" button UI are removed — the dashboard serves as the confirmation. The `SavePlanButton` "Saved" state is no longer needed on `/plan`.
- **401 response:** call `setShowSignInSheet(true)` to re-prompt authentication. The function must explicitly check `res.status === 401` before the generic error path.
- **Other non-ok response or network error:** existing `setSaveError(true)` behavior (retry button).

The auto-save path (OAuth redirect return) follows the same logic: on success, redirect to `/dashboard`.

---

## `/plan/[id]` Full Plan View

- New page at `apps/web/app/plan/[id]/page.tsx`.
- On load, calls `GET /api/plans/[id]`.
- **No session:** redirect to `/`.
- **Plan not found or belongs to another user:** render inline within the page layout — "Plan not found." with a back link to `/dashboard`. Both cases surface the same message (no distinction exposed to the user).
- Renders existing `PlanCalendar` (desktop) and `PlanFeed` (mobile) components:
  - `days` from the DB response
  - `units` from `plan.input.units`
  - `totalWeeks` from the DB record
  - `raceDistance` from `plan.input.race?.distance` — a string union `"5k" | "10k" | "half" | "full" | "ultra"`, matching the `PlanGenerationInput` type. Undefined for aerobic base plans.
  - `saveProps` not passed (no save button)
- Uses the existing `PlanHeader` component with `status="complete"` (plan is fully generated and saved), `planName` from `plan.name`, `totalWeeks` and `totalKm` from the DB record.

---

## API Changes

### `GET /api/plans`
- New route. Returns the authenticated user's plans ordered by `createdAt` desc.
- Response: `{ plans: Plan[] }` — each plan includes `id`, `name`, `goal`, `totalWeeks`, `totalKm`, `peakWeekKm`, `days` (full array), `input`, `createdAt`.
- Returns 401 if no session.

### `GET /api/plans/[id]`
- New route. Returns a single plan by ID with all fields listed above.
- Returns 401 if no session, 404 if not found or not owned by the authenticated user.

### `POST /api/plans` (existing — API contract unchanged)
- Request/response shape is not modified.
- Client-side handler updated: 2xx → `router.push("/dashboard")`; 401 → `setShowSignInSheet(true)`; other → `setSaveError(true)`.

---

## Landing Page Auth Redirect

- `apps/web/app/page.tsx` checks session via `authClient.useSession()`.
- While `isPending` is true: render a centered spinner.
- Once resolved: if `sessionData?.session` exists, `router.replace("/dashboard")`; otherwise render landing page normally.

---

## Out of Scope

- Multiple saved plans / plan switching (dashboard shows only the most recently created plan).
- "This Week" row tap navigating to a specific day within the full plan view.
- Settings page.
- Push notifications or workout reminders.
