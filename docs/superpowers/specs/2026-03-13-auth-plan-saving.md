# Auth + Plan Saving Design

## Goal

Allow users to save a generated training plan to a persistent database after signing in. Minimum friction: Google OAuth (one tap) and magic link email (passwordless). No auth wall — users see the full plan first, save when ready.

## Tech Stack

- **Neon** — serverless Postgres
- **Better Auth** — session management, Google OAuth, magic link
- **Resend** — transactional email for magic links
- **Drizzle ORM** — TypeScript schema, migrations, query builder
- **`packages/db`** — new workspace package for schema + client

---

## Data Model

### Better Auth tables (auto-managed)

Better Auth generates and manages: `user`, `session`, `account`, `verification`.

### `plans` table

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key, default `gen_random_uuid()` |
| `user_id` | text | FK → `user.id` (Better Auth user id) |
| `goal` | text | `"race"` or `"aerobic_base"` |
| `name` | text | Display name (race name or "Aerobic Base Plan") |
| `input` | jsonb | Full `PlanGenerationInput` — enables regeneration |
| `days` | jsonb | `WorkoutDay[]` — full plan for display |
| `total_weeks` | integer | |
| `total_km` | numeric | Always km |
| `peak_week_km` | numeric | Always km |
| `created_at` | timestamp | Default `now()` |

JSONB columns (`input`, `days`) absorb future shape changes without migrations.

---

## File Structure

**New workspace package:**
- `packages/db/package.json`
- `packages/db/tsconfig.json`
- `packages/db/src/schema.ts` — Drizzle table definitions
- `packages/db/src/client.ts` — Neon + Drizzle client singleton
- `packages/db/src/index.ts` — re-exports
- `packages/db/drizzle.config.ts` — migration config

**New app files:**
- `apps/web/lib/auth.ts` — Better Auth config (Google + magic link + Resend)
- `apps/web/app/api/auth/[...all]/route.ts` — Better Auth catch-all handler
- `apps/web/app/api/plans/route.ts` — POST `/api/plans` to save a plan
- `apps/web/app/plan/save-plan-button.tsx` — 4-state save button
- `apps/web/app/plan/sign-in-sheet.tsx` — slide-up sign-in sheet (Google + email)

**Modified app files:**
- `apps/web/app/plan/page.tsx` — integrate save button + session hook
- `apps/web/app/plan/plan-header.tsx` — render save button in header once complete
- `apps/web/app/plan/plan-feed.tsx` — render save button at bottom of feed
- `apps/web/app/plan/plan-calendar.tsx` — render save button at bottom of calendar

---

## Auth Flow

### Google OAuth

1. User clicks Save → `SignInSheet` slides up
2. User clicks "Continue with Google" → Better Auth redirects to Google
3. Google returns to `/api/auth/callback/google` → Better Auth creates session + sets HTTP-only cookie
4. Better Auth redirects to `/plan` (configured `callbackURL`)
5. Plan page detects session, reads plan from `sessionStorage`, POSTs to `/api/plans`
6. Save button transitions to "Saved ✓"

### Magic Link (email)

1. User clicks "Continue with email" → email input appears in sheet
2. User submits email → Better Auth sends magic link via Resend
3. Sheet shows "Check your inbox"
4. User clicks link → Better Auth validates token, creates session, redirects to `/plan`
5. Same save flow as above (step 5–6)

### Already signed in

If the user arrives at `/plan` with an active session, the Save button is shown immediately once generation completes (no sheet needed).

### Callback resilience

The plan survives OAuth redirects via `sessionStorage`. `sessionStorage` persists within a browser tab across same-origin redirects. The plan page always reads from `sessionStorage` on mount, so after the OAuth round-trip the plan data is still available.

No re-streaming needed after auth. The plan is saved from the `sessionStorage` payload directly.

---

## Save Flow

**Trigger:** User clicks Save button (header or bottom) when status is `"complete"`.

**Client:**
1. Reads full plan state from component state (already accumulated)
2. If not signed in → opens `SignInSheet`
3. If signed in → POSTs to `/api/plans`:
   ```json
   {
     "input": { ...PlanGenerationInput },
     "days": [ ...WorkoutDay[] ],
     "totalWeeks": 16,
     "totalKm": 842,
     "peakWeekKm": 72
   }
   ```

**Server (`POST /api/plans`):**
1. Verifies session via `auth.api.getSession()`
2. Returns 401 if no session
3. Inserts into `plans` table
4. Returns `{ id: "uuid" }`

**Client (success):**
- Save button transitions to "Saved ✓" state
- No navigation

---

## Save Button States

The `SavePlanButton` component accepts `status` and `isSaved` props:

| State | Condition | Display |
|---|---|---|
| Hidden | `status !== "complete"` | Not rendered |
| Ready | `status === "complete"`, not saved | "Save Plan" button |
| Saving | Save in progress | Spinner |
| Saved | Save succeeded | "Saved ✓" (disabled) |
| Error | Save failed | "Save failed — retry" |

---

## Sign-In Sheet

A bottom sheet (`fixed inset-x-0 bottom-0`) that slides up over the plan. Two sub-states:

**Initial:**
- "Continue with Google" button (Google icon)
- "Continue with email" button → switches to email sub-state
- Dismiss by tapping backdrop

**Email sub-state:**
- Email input + "Send link" button
- On success: "Check your inbox" message
- Back button to return to initial state

Uses the same bottom sheet pattern as the existing workout detail sheet in `plan-feed.tsx`.

---

## Environment Variables

```
# apps/web/.env.local
DATABASE_URL=postgresql://...          # Neon connection string
BETTER_AUTH_SECRET=...                 # Random 32+ char secret
BETTER_AUTH_URL=http://localhost:3000  # App base URL
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
RESEND_API_KEY=...
```

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Save fails (network/server error) | Button shows "Save failed — retry", user can click again |
| Auth redirect fails | User lands back on `/plan`, sheet can be reopened |
| Magic link expired | Better Auth returns error, sheet shows "Link expired — try again" |
| Session expired mid-save | 401 from `/api/plans` → open sign-in sheet again |

---

## Out of Scope

- Saved plans list / `/plans` page
- Plan deletion
- Plan sharing
- Email verification on sign-up (magic link is inherently verified)
- Role-based access control
