# Units Propagation Design

**Date:** 2026-03-15
**Status:** Approved

## Problem

Two distinct issues:

1. **Settings save is broken.** The settings page calls a custom `PATCH /api/user` route which calls `auth.api.updateUser` server-side. This updates the DB but never refreshes Better Auth's client-side `useSession()` cache. All pages read `units` from `sessionData?.user?.units`, so they stay stale until a hard refresh.

2. **No locale-based default.** New users always get `"km"` (the DB default) regardless of locale. `en-US` users should default to miles.

## Scope

- Fix unit preference saving so changes in Settings propagate immediately everywhere
- Auto-detect locale on first visit and use it as the default unit preference
- Thread detected units through onboarding so labels (weekly mileage step, race distance displays) show correctly
- Persist the locale-inferred preference to DB on plan save

Out of scope: React context for units, changing the Account section in Settings.

## Design

### 1. Fix Settings Save

**File:** `apps/web/app/(app)/settings/page.tsx`

Replace the custom `fetch("/api/user", { method: "PATCH" })` call with Better Auth's client SDK:

```ts
await authClient.updateUser({ units: value })
```

`authClient.updateUser` hits Better Auth's own `/api/auth/update-user` endpoint, updates the DB, and re-issues the session token in one operation. `useSession()` reflects the new value immediately on all pages without a page reload.

The custom `/api/user` PATCH route is retained (used for other fields), just no longer called for units.

### 2. Units Utility File

**New file:** `apps/web/lib/units.ts`

This file contains two exports used across onboarding:

```ts
export function detectUnits(): "km" | "miles" {
  if (typeof navigator === "undefined") return "km"
  return navigator.language === "en-US" ? "miles" : "km"
}

export function formatRaceDistance(
  distance: "5k" | "10k" | "half" | "full" | "ultra",
  units: "km" | "miles"
): string {
  if (units === "miles") {
    const milesMap: Record<string, string> = {
      "5k": "3.1 mi", "10k": "6.2 mi",
      "half": "13.1 mi", "full": "26.2 mi", "ultra": "Ultra",
    }
    return milesMap[distance] ?? distance
  }
  const kmMap: Record<string, string> = {
    "5k": "5 km", "10k": "10 km",
    "half": "21.1 km", "full": "42.2 km", "ultra": "Ultra",
  }
  return kmMap[distance] ?? distance
}
```

- `detectUnits` is client-side only; SSR returns `"km"` safely
- Only `en-US` maps to miles; all other locales (including `en-GB`) default to km
- Detection is based on `navigator.language` (browser UI language). This is an acceptable v1 heuristic.
- `formatRaceDistance` is co-located here so both `onboarding-flow.tsx` and `final-screen.tsx` import from one place — no duplication

### 3. Thread Units Through Onboarding

**Files:**
- `apps/web/components/onboarding/types.ts`
- `apps/web/components/onboarding/onboarding-flow.tsx`
- `apps/web/components/onboarding/steps/step-weekly-mileage.tsx`
- `apps/web/components/onboarding/final-screen.tsx`

#### `types.ts`
Add `units?: "km" | "miles"` to `OnboardingData`.

#### `onboarding-flow.tsx`
Add `authClient.useSession()` to read the user's existing preference. On mount, initialize `formData.units` using this priority order:

1. Already set in the restored draft (returning mid-onboarding user)
2. Current session units (signed-in user with an explicit preference)
3. `detectUnits()` (new/unauthenticated user)

This must happen in a `useEffect` (not the `useState` initializer) to avoid SSR/hydration mismatches. Use `isPending` from `useSession` to defer until the session is resolved — otherwise a signed-in user whose session hasn't loaded yet could have their DB preference silently overridden by `detectUnits()`:

```ts
const { data: sessionData, isPending: sessionPending } = authClient.useSession()

useEffect(() => {
  if (formData.units) return       // already set in restored draft — skip
  if (sessionPending) return       // wait for session to resolve before deciding
  const sessionUnits = (sessionData?.user as { units?: "km" | "miles" } | undefined)?.units
  setFormData((prev) => ({ ...prev, units: sessionUnits ?? detectUnits() }))
}, [sessionData, sessionPending, formData.units])
```

Note: the draft already includes `units` once the user has progressed past mount (serialized via the existing `sessionStorage.setItem(DRAFT_KEY, ...)` effect). On draft restore, `formData.units` is already populated, so the early-return guard at the top of the effect skips re-detection.

Add `units: "km" | "miles"` to `LeftPanel`'s props. Pass `formData.units ?? "km"` when rendering `<LeftPanel>`. Inside `LeftPanel`, replace `DISTANCE_KM[race.distance]` with `formatRaceDistance(race.distance, units)` from `lib/units.ts`.

Delete the `DISTANCE_KM` constant at lines 27–33 of `onboarding-flow.tsx` — it is no longer needed after this migration.

#### `step-weekly-mileage.tsx`
Receive `units` from `formData` and render dynamic options:

| Value | km label | miles label |
|---|---|---|
| under-40 | Under 40 km/week | Under 25 mi/week |
| 40-60 | 40–60 km/week | 25–37 mi/week |
| 60-80 | 60–80 km/week | 37–50 mi/week |
| 80-plus | 80+ km/week | 50+ mi/week |

The heading also changes: "How many kilometres…" → "How many miles…" for miles users.

#### `final-screen.tsx`
Replace the local `DISTANCE_KM` map with `formatRaceDistance(race.distance, formData.units ?? "km")` from `lib/units.ts`.

#### Plan generation
`plan/page.tsx` `mapToInput` already reads `units` from sessionStorage (line 52). No changes needed — units flows through automatically.

### 4. Persist Preference to DB on Plan Save

**File:** `apps/web/app/plan/page.tsx`

After `savePlanToServer` succeeds and the user is signed in, always call:

```ts
await authClient.updateUser({ units: input.units })
```

This is safe because:
- For **existing users** who already have a preference, onboarding initializes `formData.units` from their session (Section 3), so `input.units` already matches their preference — writing it back is a no-op in practice.
- For **new users**, `input.units` is the locale-detected value. This call persists it to the DB so Settings shows the correct value on first open and all pages display correctly from session.

This applies to both save code paths: the inline `handleSave()` and the auto-save effect after OAuth/magic-link redirect (line 181).

## Data Flow (After Fix)

```
Session units (if signed in) ─────┐
                                   ▼
Browser locale → detectUnits() → formData.units (onboarding)
                                   │
                         sessionStorage (athlos_onboarding)
                                   │
                         mapToInput() → PlanGenerationInput.units
                                   │
               ┌───────────────────┴──────────────────┐
               ▼                                       ▼
       plan generation                   authClient.updateUser({ units })
       (AI uses units)                         │
                                         DB user.units updated
                                               │
                                         session token refreshed
                                               │
                                   useSession() → units correct everywhere

Settings change → authClient.updateUser({ units }) → session refreshed → all pages update
```

## Files Changed

| File | Change |
|---|---|
| `apps/web/lib/units.ts` | New — `detectUnits` + `formatRaceDistance` utilities |
| `apps/web/components/onboarding/types.ts` | Add `units` to `OnboardingData` |
| `apps/web/components/onboarding/onboarding-flow.tsx` | Init units from session/locale; `LeftPanel` units prop; dynamic race distance labels |
| `apps/web/components/onboarding/steps/step-weekly-mileage.tsx` | Dynamic labels based on units |
| `apps/web/components/onboarding/final-screen.tsx` | Dynamic race distance labels via `formatRaceDistance` |
| `apps/web/app/(app)/settings/page.tsx` | Use `authClient.updateUser` instead of custom PATCH |
| `apps/web/app/plan/page.tsx` | Persist units to DB after plan save |
