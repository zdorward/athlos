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
| `/plan` | Plan generation page (unchanged). On successful save, redirects to `/dashboard`. |
| `/plan/[id]` | Read-only full plan view, loaded from DB by plan ID. |

---

## Dashboard Layout

Single-column, centered layout (max-width ~640px) on both mobile and desktop — intentionally narrow, like a training journal.

### Header
- Athloryx name/logo on the left.
- Profile avatar on the right (Google profile photo if available, otherwise user initials in a circle).
- Avatar click opens a dropdown: user name + email (display only), divider, "Sign out" button.

### Today's Workout (hero card)
- Full-width card with: workout type badge (existing color system), date, distance, full description.
- If today is a rest day: card displays "Rest Day" clearly.
- If today falls outside the plan date range: "No workout scheduled today" empty state.

### Tomorrow (preview card)
- Smaller, visually de-emphasized card below the hero. Same fields as today.

### This Week
- Compact list of remaining days in the current week (days after tomorrow through Sunday).
- Each row: day name, workout type badge, distance.
- Rows are tappable and navigate to `/plan/[id]` scrolled/focused to that day (stretch goal — initially just navigate to full plan).
- "View Full Plan →" link at the bottom navigates to `/plan/[id]`.

---

## Profile Avatar & Dropdown

- Rendered in the dashboard header (and optionally in the plan header for logged-in users).
- Photo from `session.user.image` (Google profile photo). Falls back to initials derived from `session.user.name`.
- Dropdown contents:
  - User display name (bold)
  - User email (muted, smaller)
  - Divider
  - "Sign out" button → calls `authClient.signOut()`, redirects to `/`

---

## Post-Save Flow

1. User clicks "Save Plan" on `/plan`.
2. If not logged in: sign-in sheet appears (existing flow). After OAuth, auto-save runs.
3. `savePlanToServer` succeeds → `router.push("/dashboard")`.
4. Dashboard loads, fetches most recent plan, renders today's workout.
5. No intermediate success screen — the dashboard is the confirmation.

---

## `/plan/[id]` Full Plan View

- New page that fetches `GET /api/plans/[id]` on load.
- Renders existing `PlanCalendar` (desktop) and `PlanFeed` (mobile) components.
- No streaming, no save button (plan is already saved).
- Header: back link to `/dashboard`, plan name, total weeks, total km.
- Returns 404 if plan not found or belongs to a different user.

---

## API Changes

### `GET /api/plans`
- Returns the authenticated user's plans ordered by `createdAt` desc.
- Response: `{ plans: Plan[] }` where each plan includes `id`, `name`, `goal`, `totalWeeks`, `totalKm`, `peakWeekKm`, `days`, `input`, `createdAt`.
- Returns 401 if no session.

### `GET /api/plans/[id]`
- Returns a single plan by ID.
- Returns 401 if no session, 404 if not found or not owned by user.

### `POST /api/plans` (existing)
- No change to request/response shape.
- Callers handle redirect to `/dashboard` after success.

---

## Landing Page Auth Redirect

- `apps/web/app/page.tsx` checks session on load.
- If session exists, `router.replace("/dashboard")`.
- If session is pending, show nothing (or a subtle loading state) until resolved.

---

## Out of Scope

- Multiple saved plans / plan switching (the dashboard shows only the most recent plan for now).
- "This Week" row tap navigating to a specific day (rows navigate to full plan initially).
- Settings page.
- Push notifications or workout reminders.
