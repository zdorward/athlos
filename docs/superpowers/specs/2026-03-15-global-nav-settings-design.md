# Global Nav & Settings Design

**Date:** 2026-03-15
**Status:** Approved

## Overview

Introduce a persistent global navigation shell for authenticated pages, replacing the current per-page header approach. Add a `/settings` page with a km/miles units preference. Nav is a top bar on desktop (`md+`) and a bottom tab bar on mobile. The landing page and plan generation flow are unaffected.

---

## Section 1: Routing & Layout Shell

### Route Group

Introduce a Next.js route group `app/(app)/` with a shared `layout.tsx`. This groups authenticated pages under one layout without changing their URLs.

```
app/
  (app)/
    layout.tsx           ← new: auth guard + global nav shell
    dashboard/
      page.tsx           ← moved (URL unchanged: /dashboard)
    plan/
      [id]/
        page.tsx         ← moved (URL unchanged: /plan/[id])
    settings/
      page.tsx           ← new page (/settings)
    plan-empty/
      page.tsx           ← new: empty state for Plan tab
  plan/
    page.tsx             ← stays (generation flow, no global nav)
  page.tsx               ← landing page (no global nav)
```

### `(app)/layout.tsx`

Responsibilities:
1. Check session using the Server Component pattern:
   ```ts
   import { headers } from "next/headers"
   const session = await auth.api.getSession({ headers: await headers() })
   if (!session) redirect("/")
   ```
2. Fetch the user's most recent plan ID from the DB (for the Plan nav tab link).
3. Render `<AppNav>` passing session user and plan href.
4. Render `{children}` in the main content area.

**Layout cache and the Plan tab link:** After a user creates their first plan, the post-save redirect to `/plan/[id]` triggers a full layout re-render, which picks up the new plan ID automatically. No explicit cache invalidation is needed.

This replaces the per-page auth redirect currently duplicated in `dashboard/page.tsx` and `plan/[id]/page.tsx`.

### Moving Files

`app/dashboard/` and `app/plan/[id]/` are physically moved into `app/(app)/`. Next.js route groups do not affect the URL — `/dashboard` and `/plan/[id]` remain unchanged.

---

## Section 2: Desktop Top Nav (`md+`)

### Component: `AppNav`

Located at `app/(app)/components/app-nav.tsx`. A Client Component (needs `usePathname()`). Renders differently at different breakpoints:
- `md+`: fixed top bar, full width
- `<md`: fixed bottom tab bar

### Desktop Layout (top bar)

Three zones in a single row:

| Zone | Content |
|------|---------|
| Left | `<Wordmark />` wrapped in `<Link href="/dashboard">` |
| Center-left | Nav links: Dashboard · Plan · Settings |
| Right | User avatar button → dropdown (name, email, Sign out) |

Active link is determined by `usePathname()`. A link is active when the current path starts with its href (e.g. `/plan/123` → Plan tab active).

**Plan tab behavior:**
- User has a saved plan → links to `/plan/[id]` of their most recent plan
- User has no plan → links to `/plan-empty`

The user's most recent plan ID is fetched server-side in `(app)/layout.tsx` and passed as a prop to `AppNav`.

### User Dropdown

Triggered by clicking the avatar. Contains:
- User name (bold)
- User email (muted, small)
- Divider
- Sign out button (calls `authClient.signOut()`, redirects to `/`)

This replaces `DashboardHeader` which is retired.

### `PlanHeader` stays

On `/plan/[id]`, the existing `PlanHeader` renders as a **sub-header** directly below the global top nav. It continues to show plan name, week count, distance, and the "New plan" button. No changes to `PlanHeader` itself.

---

## Section 3: Mobile Bottom Tabs (`<md`)

### Bottom Tab Bar

Fixed to the bottom of the viewport. Three tabs:

| Tab | Icon | Route |
|-----|------|-------|
| Dashboard | `LayoutDashboard` | `/dashboard` |
| Plan | `CalendarDays` | `/plan/[id]` or `/plan-empty` |
| Settings | `Settings` | `/settings` |

Active tab: filled/colored icon + label. Inactive: muted icon + label.

Bottom bar uses `pb-safe` (CSS `env(safe-area-inset-bottom)`) to respect device home indicators.

### Mobile content area

Main content area gets `pb-16` (or equivalent) so content doesn't scroll behind the bottom bar.

### Sign out on mobile

Lives on the Settings page (bottom of page), not in the tab bar.

### Plan generation page (`/plan`)

Stays completely unchanged. It is outside the `(app)` route group — no global nav, no bottom tabs.

---

## Section 4: Plan Tab Empty State

**Route:** `/plan-empty` (inside `(app)/`)

A simple centered page:
- Heading: "No plan yet"
- Subtext: "Build a training plan tailored to your race and schedule."
- CTA button: "Create a plan" → navigates to `/`

The landing page (`/`) does not redirect authenticated users, so this CTA works correctly.

---

## Section 5: Settings Page

**Route:** `/settings` (inside `(app)/`)

### Layout

Single-column, max-width-constrained page with the global nav. Two card sections.

### Preferences section

**Units**
- Label: "Distance units"
- Control: segmented toggle — `km` / `miles`
- On change: immediately fires `PATCH /api/user` with `{ units: "km" | "miles" }`. No save button.
- Visual: selected option is highlighted

### Account section

- Displays user name and email (read-only)
- "Sign out" button — calls `authClient.signOut()`, redirects to `/`

### Data model

**DB schema** — add `units` column to the `user` table in `packages/db/src/schema.ts`:
```ts
units: text("units").notNull().default("km"),
```

**Better Auth server config** — add `additionalFields` to `auth.ts` so `units` appears on `session.user` with correct TypeScript types:
```ts
user: {
  additionalFields: {
    units: {
      type: "string",
      defaultValue: "km",
      required: false,
    },
  },
},
```

Without this, Better Auth will not include `units` in the session user object and TypeScript will not recognise `session.user.units`.

**Better Auth client config** — add `inferAdditionalFields` to `auth-client.ts` so the client-side `useSession()` also types `session.user.units` correctly:
```ts
import { inferAdditionalFields } from "better-auth/client/plugins"
import type { auth } from "./auth"

export const authClient = createAuthClient({
  plugins: [magicLinkClient(), inferAdditionalFields<typeof auth>()],
})
```

Without this, `session.user.units` will be `undefined` at runtime and a TypeScript error on the client even if the server config is correct.

DB migration required:
```bash
cd packages/db && pnpm drizzle-kit generate && pnpm drizzle-kit migrate
```

### API endpoint: `PATCH /api/user`

Uses Better Auth's `auth.api.updateUser` to update the user record. This goes through Better Auth's own layer, ensuring the active session reflects the new value on subsequent `useSession()` calls without requiring a manual session refresh.

```ts
import { headers } from "next/headers"

// In the PATCH handler:
const session = await auth.api.getSession({ headers: await headers() })
if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

// Validate body with Zod, then:
await auth.api.updateUser({
  body: { units },
  headers: await headers(),
})
return Response.json({ units })
```

Do NOT update the `user` table directly via Drizzle — that bypasses Better Auth's session layer and the new value will not appear in subsequent `useSession()` calls until the session token is reissued.

### Units propagation

| Context | Source | Notes |
|---------|--------|-------|
| Saved plan view (`/plan/[id]`) | `session.user.units` | Read from layout session |
| Dashboard workout display | `session.user.units` | `dashboard/page.tsx` updated to read from `authClient.useSession()` instead of `plan.input.units` |
| Plan generation (`/plan`) | sessionStorage `units` | Unchanged — set during onboarding |

**Dashboard units change:** Currently `dashboard/page.tsx` reads `units` from `plan.input.units` (the stored generation input). After this change it reads from `authClient.useSession()` → `session.user.units`. This ensures the dashboard reflects the user's current preference, not the one set at plan creation time.

---

## Files Created or Modified

| File | Change |
|------|--------|
| `app/(app)/layout.tsx` | New: auth guard (with `headers()` pattern) + AppNav shell |
| `app/(app)/components/app-nav.tsx` | New: top bar (desktop) + bottom tabs (mobile) |
| `app/(app)/dashboard/page.tsx` | Moved from `app/dashboard/page.tsx`; units source changed to `session.user.units` via `authClient.useSession()` |
| `app/(app)/plan/[id]/page.tsx` | Moved from `app/plan/[id]/page.tsx` |
| `app/(app)/settings/page.tsx` | New: settings page |
| `app/(app)/plan-empty/page.tsx` | New: empty state for Plan tab |
| `app/api/user/route.ts` | New: PATCH endpoint for user preferences |
| `app/dashboard/dashboard-header.tsx` | Deleted (replaced by AppNav) |
| `packages/db/src/schema.ts` | Add `units` column to `user` table |
| `apps/web/lib/auth.ts` | Add `user.additionalFields` for `units` to `betterAuth()` config |
| `apps/web/lib/auth-client.ts` | Add `inferAdditionalFields<typeof auth>()` to `createAuthClient` plugins |

---

## Out of Scope

- The landing page (`/`) is unchanged
- The plan generation page (`/plan`) is unchanged
- Onboarding flow is unchanged (still sets `units` in sessionStorage)
- No changes to how plans are generated or saved
- No notification settings or other preferences beyond units
- No profile editing (name/avatar)
