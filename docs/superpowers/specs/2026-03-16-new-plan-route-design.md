# New Plan Route in App Shell

**Date:** 2026-03-16
**Status:** Approved

## Problem

When an authenticated user clicks "New plan" on `/plan/[id]`, the current flow deletes their plan and redirects to `/?new=1`. If they exit the onboarding on that page, they land on the public landing page — visually appearing logged out, even though their session is intact. This is caused by a `?new=1` URL param hack that suppresses the redirect-to-dashboard effect on the landing page.

## Solution

Create a dedicated `/new-plan` route outside the `(app)` layout group, with client-side auth enforcement. Placing it outside `(app)` avoids the AppNav bar overlapping the full-screen onboarding layout. Unauthenticated users continue to use the existing landing page onboarding unchanged.

## Changes

### 1. New page: `app/new-plan/page.tsx`

A new client page placed at `app/new-plan/` (outside the `(app)` layout group, alongside `app/plan/`).

- **Auth enforcement:** Client-side. Use `authClient.useSession()`. If `!isPending && !sessionData?.session`, call `router.replace("/")`. Show a spinner while `isPending` is true.
- **Draft clearing:** Call `sessionStorage.removeItem("athlos_onboarding_draft")` inside a `useState` initializer (not a `useEffect`) so the key is cleared synchronously before `OnboardingFlow` mounts and reads from sessionStorage. This ensures the user always starts fresh.
- **`onExit`:** `router.replace("/dashboard")`
- **`initialData`:** Not passed — user always starts fresh.
- **No AppNav:** Since the page is outside `(app)`, no nav bar is rendered, matching the full-screen layout of the landing page onboarding.

```tsx
// Rough structure
"use client"

export default function NewPlanPage() {
  const router = useRouter()
  const { data: sessionData, isPending } = authClient.useSession()

  // Clear any stale draft BEFORE OnboardingFlow mounts and reads from sessionStorage
  const [_cleared] = useState(() => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("athlos_onboarding_draft")
    }
    return true
  })

  useEffect(() => {
    if (!isPending && !sessionData?.session) router.replace("/")
  }, [isPending, sessionData, router])

  if (isPending || !sessionData?.session) {
    return <spinner />
  }

  return (
    <main className="min-h-svh">
      <OnboardingFlow onExit={() => router.replace("/dashboard")} />
    </main>
  )
}
```

### 2. Update `app/(app)/plan/[id]/page.tsx`

In `handleStartNewPlan()` at line 95, change:
```ts
router.push("/?new=1")
```
to:
```ts
router.push("/new-plan")
```

### 3. Update `app/(app)/plan-empty/page.tsx`

Change the "Create a plan" link at line 14 from:
```tsx
<Link href="/">Create a plan</Link>
```
to:
```tsx
<Link href="/new-plan">Create a plan</Link>
```
This page is only rendered inside the authenticated shell, so sending users to `/` was routing them through an unnecessary redirect.

### 4. Update `app/page.tsx`

Remove the `?new=1` mechanism entirely:

- Remove `isNewPlan` (`searchParams.get("new") === "1"`)
- Remove `useState(isNewPlan)` initialization — `showOnboarding` always starts as `false`
- Simplify the redirect effect (line 207–211) by removing the `!isNewPlan` guard:
  ```ts
  useEffect(() => {
    if (!isPending && sessionData?.session) {
      router.replace("/dashboard")
    }
  }, [isPending, sessionData?.session, router])
  ```
- Update the loading guard (line 223) from:
  ```ts
  if (isPending || (sessionData?.session && !isNewPlan))
  ```
  to:
  ```ts
  if (isPending || sessionData?.session)
  ```

The race-selection-triggered onboarding (`setShowOnboarding(true)` from `handleRaceSelect`) is unchanged — unauthenticated users still flow through the landing page onboarding.

## What Does Not Change

- `OnboardingFlow` component — no modifications
- `final-screen.tsx` — still calls `router.push("/plan")` to trigger generation
- `/plan` generation page (`app/plan/page.tsx`) — works the same from any entry point. Note: its fallback redirect on missing sessionStorage data goes to `/`, which then redirects authenticated users to `/dashboard` — this redirect chain is pre-existing and out of scope for this change.
- All APIs — no changes
- Auth configuration — no changes

## Data Flow

**Before (broken):**
```
/plan/[id] → delete plan → /?new=1 → onboarding → exit → public landing page (looks logged out)
```

**After:**
```
/plan/[id] → delete plan → /new-plan → onboarding → exit → /dashboard
                                                   → complete → /plan (generate) → /dashboard
```

**Unauthenticated flow (unchanged):**
```
/ → select race → onboarding → /plan (generate) → sign in → /dashboard
```
