# Session Notes — 2026-03-13

## What Was Built

### Auth + Plan Saving (`packages/db`, `apps/web`)

Full auth + plan persistence flow. Users generate a plan freely (no wall), then sign in to save it.

**New workspace package — `packages/db`:**
- Drizzle ORM schema: Better Auth tables (`user`, `session`, `account`, `verification`) + `plans` table
- Neon serverless Postgres client singleton
- `drizzle-kit` config with `dotenv/config` (required — drizzle-kit does not auto-load `.env`)
- Migration files committed at `packages/db/drizzle/`

**New app files:**
- `apps/web/lib/auth.ts` — Better Auth v1 server config (Google OAuth + magic link via Resend + Drizzle adapter)
- `apps/web/lib/auth-client.ts` — Better Auth client (`createAuthClient` + `magicLinkClient` plugin)
- `apps/web/app/api/auth/[...all]/route.ts` — Better Auth catch-all handler
- `apps/web/app/api/plans/route.ts` — `POST /api/plans`: validates session, derives name/goal from input, inserts to DB
- `apps/web/app/plan/save-plan-button.tsx` — 4-state save button (hidden / ready / saving / saved / error)
- `apps/web/app/plan/sign-in-sheet.tsx` — Bottom sheet: Google OAuth + magic link email flow

**Modified app files:**
- `apps/web/app/plan/page.tsx` — Session detection via `authClient.useSession()`, plan state persistence to `sessionStorage["athloryx_plan"]` before OAuth redirect, auto-save after redirect, `SavePlanButton` wired up
- `apps/web/app/plan/plan-header.tsx`, `plan-feed.tsx`, `plan-calendar.tsx` — Accept and render `SavePlanButton`

### Multi-Workout-Per-Day + Configurable AI Model (merged from main)

- AI prompt updated: run + strength on the same day now emit as two separate JSON lines with the same date
- `plan-calendar.tsx` updated to render multiple entries per calendar cell
- `plan-feed.tsx` updated to key by `date-type` (not just `date`)
- `packages/ai/src/config.ts` — new: reads `AI_PROVIDER` and `AI_MODEL` env vars; defaults to `claude-haiku-4-5-20251001`
- `ClaudeProvider` now accepts `model` as constructor arg

---

## Env Vars Required

Add to `apps/web/.env.local` before testing:

```
DATABASE_URL=postgresql://...          # Neon connection string
BETTER_AUTH_SECRET=<openssl rand -base64 32>
BETTER_AUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
RESEND_API_KEY=<from resend.com>
```

For local migrations only — `packages/db/.env` (gitignored):
```
DATABASE_URL=postgresql://...          # Same value
```

---

## What to Test Tomorrow

### Happy paths

- [ ] **Google OAuth — new user:** Generate plan → click Save → click "Continue with Google" → Google consent → redirected back → plan auto-saves → "Saved ✓"
- [ ] **Google OAuth — returning user:** Sign in again, confirm session is restored, Save button appears immediately after plan completes
- [ ] **Magic link:** Click Save → "Continue with email" → enter email → "Check your inbox" → click link → redirected → plan auto-saves
- [ ] **Already signed in:** Generate plan while session is active → Save button appears automatically when generation completes, no sheet needed
- [ ] **Plan in DB:** After saving, check Neon console to confirm a row exists in `plans` with correct `user_id`, `goal`, `name`, `input`, `days`

### Edge cases

- [ ] **Magic link in different tab:** Send magic link, open it in a new tab → plan should re-stream from `athloryx_onboarding` sessionStorage → Save button appears after streaming, user must click manually
- [ ] **Save button states:** Confirm all 5 states render correctly — hidden (generating), "Save Plan" (complete), spinner (saving), "Saved ✓" (done), "Save failed — retry" (error)
- [ ] **Session expiry mid-save:** Expire the session cookie manually, click Save → should get 401 → sign-in sheet reopens
- [ ] **Dismiss sheet:** Tap backdrop on sign-in sheet → sheet closes, plan is still there

### Multi-workout-per-day

- [ ] Enable strength training on a day that overlaps a run → confirm calendar shows both entries in the same cell
- [ ] Click a calendar cell with both run + strength → detail sheet shows the run (primary entry)

---

## Things to Take a Closer Look At

### Security / credentials

- **Rotate the Neon database password.** The full connection string was pasted in chat during this session. Do this at [neon.tech](https://neon.tech) before going to production.
- **Spend cap:** Set an Anthropic API spend cap immediately if not already done. The plan generation endpoint is unauthenticated — a bot can hit it repeatedly. IP rate limiting is a future concern; the spend cap is the immediate safety net.

### Google Cloud Console setup

Before OAuth will work:
1. Create OAuth 2.0 credentials at [console.cloud.google.com](https://console.cloud.google.com)
2. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google` (dev) and your production URL
3. Add authorized JavaScript origin: `http://localhost:3000`

### Resend domain verification

Magic link emails send from `noreply@athloryx.com`. You need to verify the `athloryx.com` domain in Resend before emails will deliver. Until then, use a Resend sandbox/test address.

### AI model default changed

`packages/ai/src/config.ts` defaults `AI_MODEL` to `claude-haiku-4-5-20251001`. Previously the app was hardcoded to `claude-sonnet-4-6`. Haiku is faster and cheaper but lower quality. Set `AI_MODEL=claude-sonnet-4-6` in `.env.local` if you want to restore the original model for testing.

### Plan state after OAuth redirect

The OAuth redirect survival relies on `sessionStorage["athloryx_plan"]`. This works when Google returns to the same tab/browser. If Something goes wrong mid-redirect (e.g., user navigates away, closes tab), the plan is lost and they'd need to regenerate. Acceptable for now.

### Numeric columns return strings from Drizzle/Neon

`totalKm` and `peakWeekKm` in the `plans` table are `numeric` (Postgres), which Drizzle returns as strings in JS. The `/api/plans` route casts them with `String()` before insert and the column types reflect this. If you query plans later for display, remember to `parseFloat()` these fields.
