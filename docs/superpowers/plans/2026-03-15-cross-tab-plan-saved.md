# Cross-Tab Plan Saved Detection Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a magic-link save completes in a new tab, the original plan tab detects it via a `localStorage` storage event and updates the Save Plan button to "Plan saved — View dashboard →".

**Architecture:** The new tab (post-magic-link) writes a `PLAN_SAVED_KEY` flag to `localStorage` after a successful save. The original tab listens for `window.storage` events and transitions to a `planSaved` state when the flag is detected. `savePlanToServer` is refactored to return a boolean so callers control navigation and cross-tab signalling independently.

**Tech Stack:** Next.js 16, React 19, TypeScript, localStorage Storage API

---

## Chunk 1: Refactor `savePlanToServer` + Add Cross-Tab Signal

## Task 1: Refactor `savePlanToServer` to return a boolean and move `router.push` to callers

**Files:**
- Modify: `apps/web/app/plan/page.tsx`

The current `savePlanToServer` calls `router.push('/dashboard')` internally on success. We need to move that call to the two callers so the auto-save path can write the cross-tab flag before navigating.

- [ ] **Step 1: Add `PLAN_SAVED_KEY` constant**

At the top of `apps/web/app/plan/page.tsx`, alongside the existing constants, add:

```ts
const PLAN_SAVED_KEY = "athlos_plan_saved"
```

- [ ] **Step 2: Refactor `savePlanToServer` to return `boolean`**

Find `savePlanToServer` (around line 296). Change its return type and remove the `router.push` call inside it. The full updated function:

```ts
async function savePlanToServer(
  planInput: PlanGenerationInput,
  days: WorkoutDay[],
  totalWeeks: number,
  totalKm: number,
  peakWeekKm: number,
): Promise<boolean> {
  setIsSaving(true)
  setSaveError(false)
  try {
    const res = await fetch("/api/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: planInput, days, totalWeeks, totalKm, peakWeekKm }),
    })
    if (res.status === 401) {
      setShowSignInSheet(true)
      return false
    }
    if (!res.ok) throw new Error("Save failed")
    return true
  } catch {
    setSaveError(true)
    return false
  } finally {
    setIsSaving(false)
  }
}
```

- [ ] **Step 3: Update `handleSave` to call `router.push` after save**

Find `handleSave` (around line 339). Update the `savePlanToServer` call:

```ts
function handleSave() {
  if (isSaving) return
  if (!sessionData?.session) {
    setShowSignInSheet(true)
    return
  }
  const current = planRef.current
  if (!input || !current.days?.length) return
  void savePlanToServer(
    input,
    current.days,
    current.totalWeeks ?? 0,
    current.totalKm ?? 0,
    current.peakWeekKm ?? 0,
  ).then((saved) => {
    if (saved) router.push("/dashboard")
  })
}
```

- [ ] **Step 4: Update auto-save `useEffect` to write cross-tab flag then navigate**

Find the auto-save `useEffect` (around line 114). The last line currently calls `void savePlanToServer(...)`. Replace it with an awaited call that writes `PLAN_SAVED_KEY` before navigating:

```ts
// Replace this line:
void savePlanToServer(snapshot.input, snapshot.days, snapshot.totalWeeks, snapshot.totalKm, snapshot.peakWeekKm)

// With:
savePlanToServer(snapshot.input, snapshot.days, snapshot.totalWeeks, snapshot.totalKm, snapshot.peakWeekKm)
  .then((saved) => {
    if (saved) {
      localStorage.setItem(PLAN_SAVED_KEY, String(Date.now()))
      router.push("/dashboard")
    }
  })
  .catch(() => { /* setSaveError already called inside savePlanToServer */ })
```

Note: the `useEffect` callback cannot be async, so use `.then()` chaining (not `await`). The `void` keyword must be removed since we're chaining.

- [ ] **Step 5: Verify the app still works — same-tab save**

Run `pnpm dev`. Sign in, generate a plan, click Save Plan while already signed in. Confirm you are redirected to `/dashboard` and the plan appears. Check the terminal — no errors, `POST /api/plans 200` appears, followed by navigation to `/dashboard`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/plan/page.tsx
git commit -m "refactor: savePlanToServer returns bool; callers handle navigation and cross-tab signal"
```

---

## Task 2: Add `planSaved` state and storage event listener

**Files:**
- Modify: `apps/web/app/plan/page.tsx`

- [ ] **Step 1: Add `planSaved` state**

In `PlanPage`, alongside the other `useState` declarations (around line 99), add:

```ts
const [planSaved, setPlanSaved] = useState(false)
```

- [ ] **Step 2: Add storage event listener `useEffect`**

After the existing `useEffect` that syncs `planRef` (around line 112), add a new `useEffect`:

```ts
// ── Cross-tab plan-saved detection ────────────────────────────────────────
useEffect(() => {
  function onStorage(e: StorageEvent) {
    if (e.key !== PLAN_SAVED_KEY) return
    localStorage.removeItem(PLAN_SAVED_KEY)
    setShowSignInSheet(false)
    setPlanSaved(true)
  }
  window.addEventListener("storage", onStorage)
  return () => window.removeEventListener("storage", onStorage)
}, [])
```

- [ ] **Step 3: Pass `planSaved` into `saveProps`**

Find the `saveProps` object construction (around line 378):

```ts
const saveProps = { status, isSaving, saveError, onSave: handleSave }
```

Update it to:

```ts
const saveProps = { status, isSaving, saveError, onSave: handleSave, saved: planSaved }
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/plan/page.tsx
git commit -m "feat: add planSaved state and cross-tab storage event listener"
```

---

## Chunk 2: Update `SavePlanButton` to Render Saved State

## Task 3: Add `saved` prop and saved state rendering to `SavePlanButton`

**Files:**
- Modify: `apps/web/app/plan/save-plan-button.tsx`

- [ ] **Step 1: Add `saved: boolean` to `SaveProps` and render saved state**

Replace the entire file content with:

```tsx
"use client"

import { Loader2, BookmarkPlus, CheckCircle2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"

export interface SaveProps {
  status: "generating" | "complete" | "error"
  isSaving: boolean
  saveError: boolean
  onSave: () => void
  saved: boolean
}

interface SavePlanButtonProps extends SaveProps {
  className?: string
}

export function SavePlanButton({
  status,
  isSaving,
  saveError,
  onSave,
  saved,
  className,
}: SavePlanButtonProps) {
  if (status !== "complete") return null

  if (saved) {
    return (
      <Button asChild variant="outline" className={`gap-2 ${className ?? ""}`}>
        <a href="/dashboard">
          <CheckCircle2 className="h-4 w-4" />
          Plan saved — View dashboard →
        </a>
      </Button>
    )
  }

  if (isSaving) {
    return (
      <Button disabled className={`gap-2 ${className ?? ""}`}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Saving…
      </Button>
    )
  }

  return (
    <Button onClick={onSave} className={`gap-2 ${className ?? ""}`}>
      <BookmarkPlus className="h-4 w-4" />
      {saveError ? "Save failed — retry" : "Save Plan"}
    </Button>
  )
}
```

`CheckCircle2` is already in the `lucide-react` package — no new dependency needed. `Button asChild` with `<a>` is the established pattern in this codebase for link-styled buttons.

- [ ] **Step 2: Fix the TypeScript error in `plan-header.tsx`**

`PlanHeader` passes `saveProps` (which now requires `saved: boolean`) but its own `saveProps?: SaveProps` prop type stays unchanged — TypeScript will enforce that callers pass a complete `SaveProps`. Since `PlanPage` now includes `saved` in its `saveProps` object, no change to `plan-header.tsx` is needed. Verify by running:

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/plan/save-plan-button.tsx
git commit -m "feat: SavePlanButton renders saved state with dashboard link"
```

---

## Task 4: End-to-end verification

- [ ] **Step 1: Test the cross-tab flow manually**

1. Open `http://localhost:3000` in a browser tab
2. Generate a plan (fill out onboarding)
3. Click "Save Plan" — sign-in sheet appears
4. Choose "Continue with email", enter your email, click "Send link"
5. Sheet shows "Check your inbox" — dismiss it (click outside)
6. Check your email, click the magic link — it opens in a new tab
7. New tab: verify it redirects to `/dashboard` with the plan listed
8. Original tab: verify the Save Plan button has changed to "Plan saved — View dashboard →" without any page reload
9. Click "Plan saved — View dashboard →" — verify it navigates to `/dashboard`

- [ ] **Step 2: Verify terminal logs**

In the `pnpm dev` terminal, you should see:

```
POST /api/auth/sign-in/magic-link 200
GET  /api/auth/magic-link/verify?... 302
GET  /plan 200
POST /api/plans 200          ← plan saved in new tab
GET  /dashboard 200          ← new tab redirected
```

No 500 errors. No `POST /api/plans` on the original tab (it never fires a save request itself).

- [ ] **Step 3: Test same-tab save still works**

Sign in first (e.g. via Google), then generate a plan, then click "Save Plan". Confirm:
- `router.push('/dashboard')` fires (you land on dashboard)
- No "Plan saved" button state appears (the `planSaved` flag was never set)
- `POST /api/plans 200` in terminal

- [ ] **Step 4: Final commit if any cleanup needed, then done**

```bash
git add -p   # stage any remaining changes
git commit -m "chore: cleanup after cross-tab plan-saved feature"
```
