# New Plan Route in App Shell

**Date:** 2026-03-16
**Status:** Approved

## Problem

When an authenticated user clicks "New plan" on `/plan/[id]`, the current flow deletes their plan and redirects to `/?new=1`. If they exit the onboarding on that page, they land on the public landing page — visually appearing logged out, even though their session is intact. This is caused by a `?new=1` URL param hack that suppresses the redirect-to-dashboard effect on the landing page.

## Solution

Move the new-plan flow inside the authenticated app shell via a dedicated `/new-plan` route. Unauthenticated users continue to use the existing landing page onboarding.

## Changes

### 1. New page: `app/(app)/new-plan/page.tsx`

A new client page inside the `(app)` layout group. Renders the existing `OnboardingFlow` component with:
- `onExit` → `router.replace("/dashboard")`
- No `initialData` (user always starts fresh from this route)

The `(app)` layout already enforces authentication server-side, so no additional auth checks are needed.

### 2. Update `app/(app)/plan/[id]/page.tsx`

In `handleStartNewPlan()`, change the redirect from `/?new=1` to `/new-plan`.

### 3. Update `app/(app)/plan-empty/page.tsx`

Change the "Create a plan" link from `/` to `/new-plan`. This page is only rendered inside the authenticated shell, so sending users to `/` was incorrect (it would redirect them back to dashboard anyway).

### 4. Update `app/page.tsx`

- Remove `isNewPlan` (the `searchParams.get("new") === "1"` check)
- Remove `useState(isNewPlan)` initialization — `showOnboarding` always starts as `false`
- Remove the `!isNewPlan` guard from the redirect-to-dashboard effect, simplifying it to: redirect to `/dashboard` whenever session exists and `isPending` is false

The race-selection-triggered onboarding (`setShowOnboarding(true)` from `handleRaceSelect`) is unchanged — unauthenticated users still flow through the landing page onboarding as before.

## What Does Not Change

- `OnboardingFlow` component — no modifications
- `final-screen.tsx` — still calls `router.push("/plan")` to trigger generation
- `/plan` generation page — works the same from any entry point
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
