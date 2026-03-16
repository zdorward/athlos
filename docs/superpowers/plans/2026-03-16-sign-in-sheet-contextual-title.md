# Sign-In Sheet Contextual Title Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show context-appropriate heading in the sign-in sheet — "Save your plan" from the plan page, "Sign in to Athlos" from the landing page.

**Architecture:** Add an optional `title` prop (default `"Save your plan"`) to `SignInSheet`, render it instead of the hardcoded string. Pass `title="Sign in to Athlos"` from the landing page call site. No logic changes.

**Tech Stack:** Next.js 16, React 19, TypeScript

---

## Chunk 1: All changes

### Task 1: Add `title` prop to `SignInSheet` and update landing page call site

**Files:**
- Modify: `apps/web/app/plan/sign-in-sheet.tsx:9-17` (props interface + destructure)
- Modify: `apps/web/app/plan/sign-in-sheet.tsx:58` (render title)
- Modify: `apps/web/app/page.tsx` (landing page call site)

No automated tests exist for this component. Manual verification steps are provided below.

- [ ] **Step 1: Update `SignInSheetProps` and destructure**

In `apps/web/app/plan/sign-in-sheet.tsx`, change:

```tsx
interface SignInSheetProps {
  onBeforeSignIn: () => void
  onClose: () => void
  callbackURL?: string
}
```

to:

```tsx
interface SignInSheetProps {
  onBeforeSignIn: () => void
  onClose: () => void
  callbackURL?: string
  title?: string
}
```

And change the function signature from:

```tsx
export function SignInSheet({ onBeforeSignIn, onClose, callbackURL = "/plan" }: SignInSheetProps) {
```

to:

```tsx
export function SignInSheet({ onBeforeSignIn, onClose, callbackURL = "/plan", title = "Save your plan" }: SignInSheetProps) {
```

- [ ] **Step 2: Render the `title` prop**

In `apps/web/app/plan/sign-in-sheet.tsx` line 58, change:

```tsx
<h2 className="text-lg font-semibold">Save your plan</h2>
```

to:

```tsx
<h2 className="text-lg font-semibold">{title}</h2>
```

- [ ] **Step 3: Pass `title` from the landing page**

In `apps/web/app/page.tsx`, find the `<SignInSheet>` render (around line 1039). Change:

```tsx
{showSignIn && (
  <SignInSheet
    onBeforeSignIn={() => {}}
    onClose={() => setShowSignIn(false)}
    callbackURL="/dashboard"
  />
)}
```

to:

```tsx
{showSignIn && (
  <SignInSheet
    onBeforeSignIn={() => {}}
    onClose={() => setShowSignIn(false)}
    callbackURL="/dashboard"
    title="Sign in to Athlos"
  />
)}
```

- [ ] **Step 4: Typecheck**

```bash
cd /Users/zackdorward/dev/athlos
pnpm typecheck
```

Expected: no errors

- [ ] **Step 5: Verify locally**

Run `pnpm dev` and confirm:
- Landing page → click "Log in" → heading reads **"Sign in to Athlos"**
- Plan page → generate a plan → click "Save Plan" (unauthenticated) → heading reads **"Save your plan"**

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/plan/sign-in-sheet.tsx apps/web/app/page.tsx
git commit -m "feat: show contextual title in sign-in sheet"
```
