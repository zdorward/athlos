# New Plan Route Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a `/new-plan` route inside the authenticated app shell so that logged-in users who exit the new-plan onboarding are returned to `/dashboard` instead of the public landing page.

**Architecture:** A new page at `apps/web/app/new-plan/page.tsx` (outside the `(app)` layout group, matching the pattern of `app/plan/page.tsx`) renders `OnboardingFlow` with client-side auth enforcement. Three existing files are updated to point to `/new-plan` instead of `/?new=1` or `/`, and the `?new=1` URL param hack is removed from the landing page.

**Tech Stack:** Next.js 16 App Router, React 19, Better Auth (`authClient.useSession()`), Playwright for e2e tests

---

## Chunk 1: Implementation

### Task 1: Create `app/new-plan/page.tsx`

**Files:**
- Create: `apps/web/app/new-plan/page.tsx`

This page lives alongside `app/plan/` (outside `(app)`) so it renders without the AppNav. It clears any stale onboarding draft from sessionStorage synchronously (via a `useState` initializer) before `OnboardingFlow` mounts, enforces auth client-side, and returns the user to `/dashboard` on exit.

- [ ] **Step 1: Create the file**

```tsx
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow"

export default function NewPlanPage() {
  const router = useRouter()
  const { data: sessionData, isPending } = authClient.useSession()

  // Clear any stale draft synchronously BEFORE OnboardingFlow mounts.
  // OnboardingFlow reads sessionStorage in its useState initializers, so this
  // must happen before it renders — a useEffect would be too late.
  const [_cleared] = useState(() => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("athlos_onboarding_draft")
    }
    return true
  })

  useEffect(() => {
    if (!isPending && !sessionData?.session) router.replace("/")
  }, [isPending, sessionData?.session, router])

  if (isPending || !sessionData?.session) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    )
  }

  return (
    <main className="min-h-svh">
      <OnboardingFlow onExit={() => router.replace("/dashboard")} />
    </main>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run from repo root:
```bash
pnpm typecheck
```
Expected: no errors in `apps/web/app/new-plan/page.tsx`

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/new-plan/page.tsx
git commit -m "feat: add /new-plan route for authenticated onboarding"
```

---

### Task 2: Update `plan/[id]/page.tsx` — redirect to `/new-plan`

**Files:**
- Modify: `apps/web/app/(app)/plan/[id]/page.tsx:95`

`handleStartNewPlan()` currently redirects to `/?new=1` after deleting the plan. Change it to `/new-plan`.

- [ ] **Step 1: Edit the redirect**

In `handleStartNewPlan()` (line 95), change:
```ts
router.push("/?new=1")
```
to:
```ts
router.push("/new-plan")
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm typecheck
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(app\)/plan/\[id\]/page.tsx
git commit -m "fix: redirect new-plan flow to /new-plan instead of /?new=1"
```

---

### Task 3: Update `plan-empty/page.tsx` — link to `/new-plan`

**Files:**
- Modify: `apps/web/app/(app)/plan-empty/page.tsx:14`

This page is only rendered inside the authenticated `(app)` shell. Its "Create a plan" button currently links to `/`, which bounces authenticated users through a redirect back to dashboard. Change it to `/new-plan`.

- [ ] **Step 1: Edit the link**

On line 14, change:
```tsx
<Link href="/">Create a plan</Link>
```
to:
```tsx
<Link href="/new-plan">Create a plan</Link>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/\(app\)/plan-empty/page.tsx
git commit -m "fix: link plan-empty create button to /new-plan"
```

---

### Task 4: Clean up `app/page.tsx` — remove `?new=1` mechanism

**Files:**
- Modify: `apps/web/app/page.tsx`

The `?new=1` URL param hack is no longer needed. Remove it and simplify the two places that reference `isNewPlan`. The race-selection onboarding flow for unauthenticated users is not touched.

- [ ] **Step 1: Remove `isNewPlan`, `searchParams`, and simplify**

In `PageContent()` (around line 194):

**Remove** `useSearchParams` from the import on line 5 — leave only `useRouter`:
```ts
import { useRouter } from "next/navigation"
```

**Remove** the `searchParams` variable (line 194):
```ts
// delete this line entirely:
const searchParams = useSearchParams()
```

**Remove** the `isNewPlan` line:
```ts
// delete this line entirely:
const isNewPlan = searchParams.get("new") === "1"
```

**Change** `useState(isNewPlan)` to `useState(false)`:
```ts
const [showOnboarding, setShowOnboarding] = useState(false)
```

**Update** the redirect effect (lines 207–211) — remove the `!isNewPlan` guard:
```ts
useEffect(() => {
  if (!isPending && sessionData?.session) {
    router.replace("/dashboard")
  }
}, [isPending, sessionData?.session, router])
```

**Update** the loading guard (line 223):
```ts
// Before:
if (isPending || (sessionData?.session && !isNewPlan)) {
// After:
if (isPending || sessionData?.session) {
```

- [ ] **Step 2: Verify TypeScript compiles — confirm no stale references remain**

```bash
pnpm typecheck
```

Confirm all removed identifiers are gone:
```bash
grep -n "isNewPlan\|new=1\|useSearchParams\|searchParams" apps/web/app/page.tsx
```
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/page.tsx
git commit -m "refactor: remove ?new=1 URL param hack from landing page"
```

---

## Chunk 2: Tests & Verification

### Task 5: Write e2e test for the new-plan exit flow

**Files:**
- Modify: `apps/web/e2e/onboarding.spec.ts`

Add a test that verifies the key fix: a logged-in user who exits the new-plan onboarding lands on `/dashboard`, not the public landing page.

Note: This test requires an authenticated session. Playwright doesn't have a pre-configured auth fixture in this project yet. Use the `storageState` approach to seed a session, OR write the test in a way that mocks the session check — but since `authClient.useSession()` is a real network call, the simplest approach for now is to document it as a manual verification step and write a structural test that at minimum confirms `/new-plan` redirects unauthenticated users to `/`.

- [ ] **Step 1: Add unauthenticated redirect test**

Add to `apps/web/e2e/onboarding.spec.ts`:

```ts
test("visiting /new-plan without a session redirects to /", async ({ page }) => {
  // No session — should be redirected to the landing page
  await page.goto("/new-plan")
  await page.waitForURL("/")
  await expect(page.getByPlaceholder("Search races by name or city…")).toBeVisible()
})
```

- [ ] **Step 2: Run the e2e tests**

From `apps/web/`:
```bash
pnpm test:e2e
```
Expected: all tests pass, including the existing onboarding test and the new redirect test

- [ ] **Step 3: Commit**

```bash
git add apps/web/e2e/onboarding.spec.ts
git commit -m "test: verify /new-plan redirects unauthenticated users to /"
```

---

### Task 6: Manual verification checklist

No automated test can cover the authenticated exit flow without a pre-seeded session. Verify manually in the browser with `pnpm dev` running:

- [ ] **Authenticated user: New plan → exit → dashboard**
  1. Sign in
  2. Have an existing plan at `/plan/[id]`
  3. Click "New plan" in the plan header
  4. Confirm the delete prompt, click OK
  5. Onboarding opens at `/new-plan` (full-screen, no AppNav)
  6. Click "Exit"
  7. **Expected:** land on `/dashboard`, still signed in

- [ ] **Authenticated user: New plan → complete → dashboard**
  1. Repeat steps 1–5 above
  2. Complete all onboarding steps, click "Build My Plan"
  3. Plan generates at `/plan`
  4. Save the plan
  5. **Expected:** redirect to `/dashboard` with the new plan

- [ ] **Authenticated user: plan-empty → Create a plan**
  1. Sign in with no existing plan (or delete your plan via the API)
  2. Navigate to `/plan-empty`
  3. Click "Create a plan"
  4. **Expected:** opens onboarding at `/new-plan` (not the landing page)

- [ ] **Unauthenticated user: landing page onboarding unchanged**
  1. Open an incognito window
  2. Go to `/`
  3. Search for a race, click it
  4. **Expected:** onboarding opens normally, full flow works

- [ ] **Unauthenticated user: `/new-plan` redirects to `/`**
  1. Open an incognito window
  2. Navigate directly to `/new-plan`
  3. **Expected:** redirected to `/` (landing page)

- [ ] **Authenticated user: `/` auto-redirects to `/dashboard`**
  1. Sign in
  2. Navigate to `/`
  3. **Expected:** redirect to `/dashboard` immediately (no `?new=1` required to suppress this)

- [ ] **Stale draft is cleared on entry to `/new-plan`**
  1. Open an incognito window, go to `/`, search a race, click it
  2. Fill in a few onboarding steps (this writes `athlos_onboarding_draft` to sessionStorage)
  3. Abandon the flow and sign in as an authenticated user
  4. Navigate to `/new-plan`
  5. **Expected:** onboarding starts at step 1 with a blank state — not pre-populated with the abandoned draft

- [ ] **Back button after exit goes to `/dashboard`, not back to `/new-plan`**
  1. Complete scenario "Authenticated user: New plan → exit → dashboard" above
  2. Once on `/dashboard`, press the browser back button
  3. **Expected:** stays on `/dashboard` (because `router.replace` was used, not `push`)
