# Loading Spinner Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all six inline `Loader2` spinner usages with a shared `<Spinner />` component that uses a branded pulse-dot animation.

**Architecture:** Add a `dot-pulse` keyframe to `globals.css`, create `packages/ui/src/components/spinner.tsx`, then update all six callsites to import and use `<Spinner />`. No new routes, no new state, no new dependencies.

**Tech Stack:** React 19, Tailwind v4, `cn()` from `@workspace/ui/lib/utils`

---

## Chunk 1: Animation + Component

### Task 1: Add `dot-pulse` keyframe to globals.css

**Files:**
- Modify: `packages/ui/src/styles/globals.css:122-123` (after the existing `--animate-spin-around` line, inside `@theme inline`)

- [ ] **Step 1: Add `--animate-dot-pulse` to `@theme inline` and `@keyframes dot-pulse` block**

  In `packages/ui/src/styles/globals.css`, add one line inside the `@theme inline` block right after `--animate-spin-around`, and add the `@keyframes` block inside the same `@theme inline` block (matching the pattern used by `shimmer-slide` and `spin-around`):

  ```css
  /* Inside @theme inline, after line 123: */
      --animate-dot-pulse: dot-pulse 1.2s ease-in-out infinite;
    @keyframes dot-pulse {
      0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
      40%           { opacity: 1;   transform: scale(1);   }
    }
  ```

  The full updated block (lines 122–143 of globals.css) should look like:

  ```css
      --animate-shimmer-slide: shimmer-slide var(--speed) ease-in-out infinite alternate;
      --animate-spin-around: spin-around calc(var(--speed) * 2) infinite linear;
      --animate-dot-pulse: dot-pulse 1.2s ease-in-out infinite;
    @keyframes shimmer-slide {
    to {
      transform: translate(calc(100cqw - 100%), 0);
          }
      }
    @keyframes spin-around {
    0% {
      transform: translateZ(0) rotate(0);
          }
    15%, 35% {
      transform: translateZ(0) rotate(90deg);
          }
    65%, 85% {
      transform: translateZ(0) rotate(270deg);
          }
    100% {
      transform: translateZ(0) rotate(360deg);
          }
      }
    @keyframes dot-pulse {
      0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
      40%           { opacity: 1;   transform: scale(1);   }
    }
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add packages/ui/src/styles/globals.css
  git commit -m "feat: add dot-pulse keyframe animation"
  ```

---

### Task 2: Create `<Spinner />` component

**Files:**
- Create: `packages/ui/src/components/spinner.tsx`

- [ ] **Step 1: Create the component file**

  Create `packages/ui/src/components/spinner.tsx` with the following content:

  ```tsx
  import { cn } from "@workspace/ui/lib/utils"

  interface SpinnerProps {
    size?: "sm" | "md"
    className?: string
  }

  export function Spinner({ size = "md", className }: SpinnerProps) {
    const dotClass = cn(
      "rounded-full bg-current animate-dot-pulse",
      size === "md" ? "size-2" : "size-1.5"
    )
    const delays = ["0s", "0.2s", "0.4s"]

    return (
      <div
        className={cn(
          "flex items-center text-primary",
          size === "md" ? "gap-1.5" : "gap-1",
          className
        )}
        role="status"
        aria-label="Loading"
      >
        {delays.map((delay) => (
          <span
            key={delay}
            className={dotClass}
            style={{ animationDelay: delay }}
          />
        ))}
      </div>
    )
  }
  ```

- [ ] **Step 2: Verify the file builds**

  ```bash
  pnpm typecheck
  ```

  Expected: no errors referencing `spinner.tsx`.

- [ ] **Step 3: Commit**

  ```bash
  git add packages/ui/src/components/spinner.tsx
  git commit -m "feat: add Spinner component with pulse-dot animation"
  ```

---

## Chunk 2: Callsite Updates

### Task 3: Update `app/page.tsx`

**Files:**
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Replace the `Loader2` spinner**

  In `apps/web/app/page.tsx`:

  1. Add the import (near the top with other component imports):
     ```tsx
     import { Spinner } from "@workspace/ui/components/spinner"
     ```

  2. Find the loading return (around line 231–237):
     ```tsx
     <Loader2
       className="h-6 w-6 animate-spin"
       style={{ color: "rgba(255,255,255,0.3)" }}
     />
     ```
     Replace with:
     ```tsx
     <Spinner className="text-white/30" />
     ```

  3. Remove `Loader2` from the lucide-react import line. Before:
     ```tsx
     import { Search, Loader2, CalendarIcon } from "lucide-react"
     ```
     After:
     ```tsx
     import { Search, CalendarIcon } from "lucide-react"
     ```

- [ ] **Step 2: Typecheck**

  ```bash
  pnpm typecheck
  ```

  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/app/page.tsx
  git commit -m "feat: use Spinner in landing page loading state"
  ```

---

### Task 4: Update `app/(app)/dashboard/page.tsx`

**Files:**
- Modify: `apps/web/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Replace the `Loader2` spinner**

  In `apps/web/app/(app)/dashboard/page.tsx`:

  1. Add import:
     ```tsx
     import { Spinner } from "@workspace/ui/components/spinner"
     ```

  2. Find (around line 97):
     ```tsx
     <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
     ```
     Replace with:
     ```tsx
     <Spinner />
     ```

  3. Remove `Loader2` from the lucide-react import.

- [ ] **Step 2: Typecheck**

  ```bash
  pnpm typecheck
  ```

  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/app/(app)/dashboard/page.tsx
  git commit -m "feat: use Spinner in dashboard loading state"
  ```

---

### Task 5: Update `app/(app)/plan/[id]/page.tsx`

**Files:**
- Modify: `apps/web/app/(app)/plan/[id]/page.tsx`

- [ ] **Step 1: Replace the `Loader2` spinner**

  In `apps/web/app/(app)/plan/[id]/page.tsx`:

  1. Add import:
     ```tsx
     import { Spinner } from "@workspace/ui/components/spinner"
     ```

  2. Find (around line 62):
     ```tsx
     <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
     ```
     Replace with:
     ```tsx
     <Spinner />
     ```

  3. Remove `Loader2` from the lucide-react import.

- [ ] **Step 2: Typecheck**

  ```bash
  pnpm typecheck
  ```

  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add "apps/web/app/(app)/plan/[id]/page.tsx"
  git commit -m "feat: use Spinner in plan page loading state"
  ```

---

### Task 6: Update `app/new-plan/page.tsx`

**Files:**
- Modify: `apps/web/app/new-plan/page.tsx`

- [ ] **Step 1: Replace the `Loader2` spinner**

  In `apps/web/app/new-plan/page.tsx`:

  1. Add import:
     ```tsx
     import { Spinner } from "@workspace/ui/components/spinner"
     ```

  2. Find (around line 29):
     ```tsx
     <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
     ```
     Replace with:
     ```tsx
     <Spinner />
     ```

  3. Remove `Loader2` from the lucide-react import.

- [ ] **Step 2: Typecheck**

  ```bash
  pnpm typecheck
  ```

  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/app/new-plan/page.tsx
  git commit -m "feat: use Spinner in new-plan loading state"
  ```

---

### Task 7: Update `app/plan/save-plan-button.tsx`

**Files:**
- Modify: `apps/web/app/plan/save-plan-button.tsx`

- [ ] **Step 1: Replace the inline `Loader2` spinner**

  In `apps/web/app/plan/save-plan-button.tsx`:

  1. Add import:
     ```tsx
     import { Spinner } from "@workspace/ui/components/spinner"
     ```

  2. Find (around line 42):
     ```tsx
     <Loader2 className="h-4 w-4 animate-spin" />
     ```
     Replace with:
     ```tsx
     <Spinner size="sm" />
     ```

  3. Remove `Loader2` from the lucide-react import.

- [ ] **Step 2: Typecheck**

  ```bash
  pnpm typecheck
  ```

  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/app/plan/save-plan-button.tsx
  git commit -m "feat: use Spinner in save-plan button"
  ```

---

### Task 8: Update `app/plan/sign-in-sheet.tsx`

**Files:**
- Modify: `apps/web/app/plan/sign-in-sheet.tsx`

- [ ] **Step 1: Replace the inline `Loader2` spinner**

  In `apps/web/app/plan/sign-in-sheet.tsx`:

  1. Add import:
     ```tsx
     import { Spinner } from "@workspace/ui/components/spinner"
     ```

  2. Find (around line 103):
     ```tsx
     {loading && <Loader2 className="h-4 w-4 animate-spin" />}
     ```
     Replace with:
     ```tsx
     {loading && <Spinner size="sm" />}
     ```

  3. Remove `Loader2` from the lucide-react import.

- [ ] **Step 2: Typecheck**

  ```bash
  pnpm typecheck
  ```

  Expected: no errors.

- [ ] **Step 3: Final build check**

  ```bash
  pnpm build
  ```

  Expected: clean build, no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add apps/web/app/plan/sign-in-sheet.tsx
  git commit -m "feat: use Spinner in sign-in sheet button"
  ```
