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

Better Auth generates and manages its own tables (`user`, `session`, `account`, `verification`) via `auth.api.runMigrations()` called once on server startup, or via Drizzle's schema integration. We use Better Auth's Drizzle adapter so all tables live in the same Postgres database and are managed by `drizzle-kit`.

### `plans` table

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key, default `gen_random_uuid()` |
| `user_id` | text | FK → `user.id` (Better Auth user id) |
| `goal` | text | Derived from `input.goal`: `"race"` or `"aerobic_base"` |
| `name` | text | Derived server-side: `input.race.name` if race, else `"Aerobic Base Plan"` |
| `input` | jsonb | Full `PlanGenerationInput` — enables regeneration |
| `days` | jsonb | `WorkoutDay[]` — full plan for display |
| `total_weeks` | integer | |
| `total_km` | numeric | Always km |
| `peak_week_km` | numeric | Always km |
| `created_at` | timestamp | Default `now()` |

`name` and `goal` are derived server-side from `input`; the client does not send them separately.

JSONB columns (`input`, `days`) absorb future shape changes without migrations.

---

## File Structure

**New workspace package:**
- `packages/db/package.json`
- `packages/db/tsconfig.json`
- `packages/db/src/schema.ts` — Drizzle table definitions (Better Auth tables + `plans`)
- `packages/db/src/client.ts` — Neon + Drizzle client singleton
- `packages/db/src/index.ts` — re-exports
- `packages/db/drizzle.config.ts` — migration config (reads `DATABASE_URL` from env)
- `packages/db/.env` — `DATABASE_URL` for local `drizzle-kit` runs (gitignored)

**New app files:**
- `apps/web/lib/auth.ts` — Better Auth server config (Google + magic link + Resend + Drizzle adapter)
- `apps/web/lib/auth-client.ts` — Better Auth client instance (`createAuthClient()`)
- `apps/web/app/api/auth/[...all]/route.ts` — Better Auth catch-all handler
- `apps/web/app/api/plans/route.ts` — POST `/api/plans` to save a plan
- `apps/web/app/plan/save-plan-button.tsx` — 4-state save button (receives `onSave` callback)
- `apps/web/app/plan/sign-in-sheet.tsx` — slide-up sign-in sheet (Google + email)

**Modified app files:**
- `apps/web/app/plan/page.tsx` — add session detection, save state, pass `onSave`/`isSaved` as props
- `apps/web/app/plan/plan-header.tsx` — accept and render `SavePlanButton`-related props
- `apps/web/app/plan/plan-feed.tsx` — accept and render `SavePlanButton` at bottom
- `apps/web/app/plan/plan-calendar.tsx` — accept and render `SavePlanButton` at bottom
- `apps/web/package.json` — add `"@workspace/db": "workspace:*"`

**Monorepo wiring:**
- `packages/db` is automatically discovered via the `packages/*` glob in `pnpm-workspace.yaml` — no changes to that file needed
- No changes to `turbo.json` needed — Turbo's generic pipeline tasks (`build`, `typecheck`, `lint`) apply to all workspace packages automatically
- `DATABASE_URL` lives in both `packages/db/.env` (for drizzle-kit migrations) and `apps/web/.env.local` (for runtime)

**Migration commands** (add to `packages/db/package.json` scripts):
```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push"
  }
}
```

Run from the repo root via: `pnpm --filter @workspace/db db:migrate`

---

## Auth Flow

### OAuth callback + plan state persistence

A Google OAuth redirect is a full cross-origin navigation. React state (the accumulated `WorkoutDay[]`) is destroyed. To survive the redirect:

**Before triggering OAuth**, `page.tsx` writes the full accumulated plan to a second sessionStorage key:
```
sessionStorage.setItem("athloryx_plan", JSON.stringify({
  input,          // PlanGenerationInput (already in state)
  days,           // WorkoutDay[] (accumulated in state)
  totalWeeks,
  totalKm,
  peakWeekKm,
}))
```

**After the OAuth redirect**, `page.tsx` checks for `athloryx_plan` in sessionStorage on mount. If it exists and `totalWeeksRef.current === 0` (stream hasn't started), it restores state from sessionStorage instead of re-streaming, then immediately triggers the save.

`sessionStorage` persists across same-tab same-origin navigations. Google OAuth redirects back to the same origin, so the data survives.

### Google OAuth

1. User clicks Save → `SignInSheet` slides up
2. User clicks "Continue with Google"
3. `SignInSheet` triggers `page.tsx` to write plan state to `athloryx_plan` in sessionStorage (via a callback prop `onBeforeSignIn`)
4. `authClient.signIn.social({ provider: "google", callbackURL: "/plan" })`
5. Browser redirects to Google → returns to `/api/auth/callback/google` → Better Auth creates session + sets HTTP-only cookie → redirects to `/plan`
6. `page.tsx` mounts, detects session via `authClient.useSession()`, finds `athloryx_plan` in sessionStorage, restores state, POSTs to `/api/plans`
7. Save button transitions to "Saved ✓", sessionStorage key `athloryx_plan` is deleted

### Magic Link (email)

1. User clicks "Continue with email" → email input appears in sheet
2. User submits email → `authClient.signIn.magicLink({ email, callbackURL: "/plan" })`
3. Better Auth sends magic link via Resend; sheet shows "Check your inbox"
4. User clicks link in email → Better Auth validates token, creates session, redirects to `/plan`
5. Same save flow as OAuth (step 6–7 above)

Note: Magic link is a same-tab redirect only if clicked in the same browser. If the user opens the link in a different tab, sessionStorage from the original tab is not accessible. In that case, the plan re-streams from `athloryx_onboarding` (which is already in sessionStorage). No automatic save occurs — the Save button appears normally after streaming completes and the user must click it to save.

### Already signed in

If `authClient.useSession()` returns an active session on mount, the Save button is shown immediately once generation completes. No sheet needed. `athloryx_plan` is not used — plan state is already in React state.

### `callbackURL`

`callbackURL: "/plan"` is passed at the **call site** on the client (`authClient.signIn.social(...)` and `authClient.signIn.magicLink(...)`). It is not a server-side config option.

---

## Save Flow

**Trigger:** User clicks Save button when status is `"complete"` and not yet saved.

**Save state lives in `page.tsx`** and is passed down as props:
- `isSaved: boolean`
- `isSaving: boolean`
- `onSave: () => void` — callback that triggers the save
- `status: "generating" | "complete" | "error"`

All three save button placements (header, feed bottom, calendar bottom) receive these same props from `page.tsx`, ensuring they stay in sync.

**Client (`onSave` callback in `page.tsx`):**
1. If not signed in → opens `SignInSheet`
2. If signed in → sets `isSaving = true`, POSTs to `/api/plans`:
   ```json
   {
     "input": { ...PlanGenerationInput },
     "days": [ ...WorkoutDay[] ],
     "totalWeeks": 16,
     "totalKm": 842,
     "peakWeekKm": 72
   }
   ```
3. On success: sets `isSaved = true`, `isSaving = false`
4. On failure: sets `isSaving = false`, shows retry state

**Server (`POST /api/plans`):**
```typescript
const session = await auth.api.getSession({ headers: request.headers })
if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

// Derive name and goal from input
const name = body.input.goal === "race" && body.input.race?.name
  ? body.input.race.name
  : "Aerobic Base Plan"

await db.insert(plans).values({
  userId: session.user.id,
  goal: body.input.goal,
  name,
  input: body.input,
  days: body.days,
  totalWeeks: body.totalWeeks,
  totalKm: body.totalKm,
  peakWeekKm: body.peakWeekKm,
})
```

---

## Save Button States

`SavePlanButton` props: `isSaved`, `isSaving`, `onSave`, `status`

| State | Condition | Display |
|---|---|---|
| Hidden | `status !== "complete"` | Not rendered |
| Ready | `status === "complete"`, not saved, not saving | "Save Plan" button |
| Saving | `isSaving === true` | Spinner |
| Saved | `isSaved === true` | "Saved ✓" (disabled) |
| Error | Save failed | "Save failed — retry" |

---

## Sign-In Sheet

A bottom sheet (`fixed inset-x-0 bottom-0`) that slides up over the plan. Receives `onBeforeSignIn` callback from `page.tsx` to trigger sessionStorage write before the OAuth redirect.

**Initial sub-state:**
- "Continue with Google" → calls `onBeforeSignIn()` then `authClient.signIn.social({ provider: "google", callbackURL: "/plan" })`
- "Continue with email" → switches to email sub-state
- Dismiss by tapping backdrop

**Email sub-state:**
- Email input + "Send link" button → calls `authClient.signIn.magicLink({ email, callbackURL: "/plan" })`
- On success: "Check your inbox" message
- Back button to return to initial sub-state

Uses the same `fixed inset-0 z-50 flex items-end` bottom sheet pattern as the existing workout detail sheet in `plan-feed.tsx`.

---

## Environment Variables

```
# apps/web/.env.local  (runtime)
DATABASE_URL=postgresql://...
BETTER_AUTH_SECRET=...                 # Random 32+ char secret
BETTER_AUTH_URL=http://localhost:3000  # Full app base URL (BETTER_AUTH_URL is the correct var name)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
RESEND_API_KEY=...

# packages/db/.env  (drizzle-kit migrations only, gitignored)
DATABASE_URL=postgresql://...          # Same value as above
```

Better Auth version: pin to `^1.0.0` in package.json. The env var `BETTER_AUTH_URL` (not `AUTH_URL`) is correct for v1.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Save fails (network/server error) | Button shows "Save failed — retry", user can click again |
| Auth redirect fails | User lands back on `/plan`, sheet can be reopened |
| Magic link expired | Better Auth returns error, sheet shows "Link expired — try again" |
| Session expired mid-save | 401 from `/api/plans` → open sign-in sheet again |
| Magic link opened in different tab | Plan re-streams from `athloryx_onboarding`; Save button shown after completion, user must click manually |

---

## Out of Scope

- Saved plans list / `/plans` page
- Plan deletion
- Plan sharing
- Role-based access control
