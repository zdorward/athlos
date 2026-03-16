# Cross-Tab Plan Saved Detection

**Date:** 2026-03-15
**Status:** Approved

## Problem

When a user saves a plan via magic link, the link opens in a new browser tab. The new tab handles auth and saves the plan, then redirects to the dashboard. The original tab is left stale — it still shows "Save Plan" and has no awareness that the plan was saved elsewhere. The result is a confusing two-tab state.

## Goal

When the plan is saved in the new tab, the original tab detects it and updates to show "Plan saved — View dashboard →" in place of the Save Plan button. The sign-in sheet (if still open) is closed automatically.

## Approach

Use the browser's `storage` event, which fires in all tabs sharing the same origin when `localStorage` is written from another tab. This is the standard cross-tab communication pattern — no polling, no websockets.

## How the New Tab Save Is Triggered

The new tab (opened by the magic link) lands on `/plan`. It has no `sessionStorage` data, so the existing auto-save `useEffect` (not `savePlanToServer` directly) drives the save: it finds a fresh `PLAN_KEY` snapshot in `localStorage` (written by the original tab before sign-in), restores plan state, and calls `savePlanToServer`. This is all existing logic — the cross-tab signal is the only new behavior added in this spec.

## Implementation

### Constants

Add a named constant at the top of `page.tsx` alongside the existing `PLAN_KEY`:

```ts
const PLAN_SAVED_KEY = "athlos_plan_saved"
```

Use this constant everywhere — write, listen, and remove — to prevent typos.

### 1. Signal from the new tab (auto-save `useEffect` in `PlanPage`)

After `savePlanToServer` returns successfully in the auto-save `useEffect`, write the cross-tab flag **before** `router.push('/dashboard')` executes. This write must happen only in the auto-save `useEffect` context, not inside the `savePlanToServer` helper itself, to avoid spuriously signalling other open tabs when a logged-in user saves normally from the same tab.

Concretely: the auto-save `useEffect` currently calls:
```ts
void savePlanToServer(snapshot.input, snapshot.days, ...)
```

Change this to await the call so the flag can be written after success. Then in `savePlanToServer`, return a boolean indicating success; the caller writes the flag and redirects. Alternatively, `savePlanToServer` can accept an optional `onSuccess` callback — either approach keeps the write out of the shared helper.

The simplest approach: have `savePlanToServer` return `true` on success instead of calling `router.push` directly, and let the caller decide what to do next. The `handleSave` path (same-tab, logged-in user) calls `router.push('/dashboard')` directly. The auto-save path writes `PLAN_SAVED_KEY` then calls `router.push('/dashboard')`.

### 2. Listener in the original tab (`PlanPage`)

Add a `planSaved` state (boolean, default `false`).

Add a `useEffect` (no dependencies, runs once on mount, client-side only — `localStorage` and `window` are safe inside `useEffect` in Next.js) that registers a `storage` event listener:

```ts
useEffect(() => {
  function onStorage(e: StorageEvent) {
    if (e.key !== PLAN_SAVED_KEY) return
    localStorage.removeItem(PLAN_SAVED_KEY)
    setShowSignInSheet(false)
    setPlanSaved(true)
  }
  window.addEventListener('storage', onStorage)
  return () => window.removeEventListener('storage', onStorage)
}, [])
```

Consuming and removing the key immediately prevents it from affecting future sessions.

### 3. Save button saved state (`SavePlanButton`)

Add `saved: boolean` as a **required** field to `SaveProps`. Required ensures TypeScript enforces that all callsites pass it explicitly, preventing `undefined` from accidentally rendering the button in saved state.

When `saved` is true, render an `<a href="/dashboard">` styled as a button with text "Plan saved — View dashboard →", instead of the normal save/saving/error button. When `saved` is false, render the existing button logic unchanged.

Pass `planSaved` as `saved` in the `saveProps` object constructed in `PlanPage` (line ~378):
```ts
const saveProps = { status, isSaving, saveError, onSave: handleSave, saved: planSaved }
```

`PlanHeader` spreads `saveProps` directly onto `SavePlanButton`, so no changes needed there.

## Data Flow

```
Original tab: handleBeforeSignIn()
                → localStorage.setItem(PLAN_KEY, snapshot)
                → authClient.signIn.magicLink(...)

New tab (magic link click):
              auto-save useEffect fires
                → finds PLAN_KEY in localStorage
                → restores plan state
                → savePlanToServer() returns true
                → localStorage.setItem(PLAN_SAVED_KEY, Date.now())
                → router.push('/dashboard')

Original tab: storage event fires
                → e.key === PLAN_SAVED_KEY
                → localStorage.removeItem(PLAN_SAVED_KEY)
                → setShowSignInSheet(false)
                → setPlanSaved(true)
                → SavePlanButton renders "Plan saved — View dashboard →"
```

## Files Changed

| File | Change |
|------|--------|
| `apps/web/app/plan/page.tsx` | Add `PLAN_SAVED_KEY` constant, `planSaved` state, storage listener `useEffect`, refactor `savePlanToServer` to return `boolean` (remove `router.push` from inside the helper), add `router.push('/dashboard')` explicitly to both call sites (`handleSave` on success, auto-save `useEffect` after writing `PLAN_SAVED_KEY`) |
| `apps/web/app/plan/save-plan-button.tsx` | Add required `saved: boolean` to `SaveProps`; render "Plan saved" link when true |

## Out of Scope

- No changes to `plan-header.tsx` (it spreads `saveProps` as-is)
- No changes to dashboard, API routes, or auth flow
- No toast/notification system
- Google OAuth same-tab save: unaffected — `handleSave` path continues to call `router.push('/dashboard')` directly
