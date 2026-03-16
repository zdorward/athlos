# Mobile Onboarding Inputs Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix iOS Safari auto-zoom on race search inputs and improve day-of-week toggle spacing and press feedback across the onboarding flow.

**Architecture:** Five targeted Tailwind class/inline-style edits across five existing files. No new files, no new dependencies, no logic changes — purely presentation.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4

**Spec:** `docs/superpowers/specs/2026-03-15-mobile-onboarding-inputs-design.md`

---

## Chunk 1: iOS Zoom Fixes

### Task 1: Fix race search input font size

**Files:**
- Modify: `apps/web/components/onboarding/steps/step-find-race.tsx:86`

> **Note on testing:** This is a pure CSS class change with no logic. There is no meaningful unit test to write. Verification is a manual visual check on an iOS device or Safari simulator — focus on confirming the page no longer zooms when tapping the search input.

- [ ] **Step 1: Open the file and locate the native search input**

  Open `apps/web/components/onboarding/steps/step-find-race.tsx`. Find the `<input>` around line 79–87:

  ```tsx
  <input
    autoFocus
    placeholder="Search races…"
    value={query}
    onChange={(e) => setQuery(e.target.value)}
    onFocus={() => setDropdownOpen(true)}
    onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
    className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
  />
  ```

- [ ] **Step 2: Change `text-sm` to `text-base`**

  Update the className:

  ```tsx
  className="flex-1 bg-transparent outline-none text-base placeholder:text-muted-foreground"
  ```

- [ ] **Step 3: Verify on iOS (or simulator)**

  Navigate to the onboarding flow → race search step. Tap the search input. Confirm the page **does not zoom**.

- [ ] **Step 4: Commit**

  ```bash
  git add apps/web/components/onboarding/steps/step-find-race.tsx
  git commit -m "fix: set race search input to 16px to prevent iOS zoom"
  ```

---

### Task 2: Fix hero page search input font size

**Files:**
- Modify: `apps/web/app/page.tsx:228`

> **Note on testing:** Same as Task 1 — pure style change. Verify manually on iOS that the hero search no longer triggers zoom on focus.

- [ ] **Step 1: Open the file and locate the hero search input**

  Open `apps/web/app/page.tsx`. Find the `<input>` around line 222–230:

  ```tsx
  <input
    placeholder="Search races by name or city…"
    value={query}
    onChange={(e) => setQuery(e.target.value)}
    onFocus={() => setDropdownOpen(true)}
    style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 15, color: "rgba(255,255,255,0.85)", fontFamily: "inherit", letterSpacing: "0.01em" }}
  />
  ```

- [ ] **Step 2: Change `fontSize: 15` to `fontSize: 16`**

  ```tsx
  style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 16, color: "rgba(255,255,255,0.85)", fontFamily: "inherit", letterSpacing: "0.01em" }}
  ```

- [ ] **Step 3: Verify on iOS (or simulator)**

  Navigate to the landing page (`/`). Tap the hero search input. Confirm the page **does not zoom**.

- [ ] **Step 4: Commit**

  ```bash
  git add apps/web/app/page.tsx
  git commit -m "fix: set hero search input to 16px to prevent iOS zoom"
  ```

---

## Chunk 2: Day Toggle Spacing and Press Feedback

### Task 3: Reduce day toggle visual size and add press animation

**Files:**
- Modify: `apps/web/components/onboarding/day-toggle.tsx`

> **Note on testing:** Pure styling change. Verify manually: (a) circles are visually slightly smaller, (b) tapping a circle shows a brief scale-down press effect, (c) selected state color change still works correctly.

- [ ] **Step 1: Open the file and locate the button**

  Open `apps/web/components/onboarding/day-toggle.tsx`. The full button className is currently:

  ```tsx
  className={cn(
    "flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-sm font-medium border transition-all",
    selected
      ? "bg-primary text-primary-foreground border-primary"
      : disabled
      ? "cursor-not-allowed opacity-40 border-border"
      : "border-border hover:bg-muted"
  )}
  ```

- [ ] **Step 2: Apply size reduction and press animation**

  Change `h-11 w-11` to `h-10 w-10` and add `active:scale-90 active:duration-100` to the base classes:

  ```tsx
  className={cn(
    "flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-sm font-medium border transition-all active:scale-90 active:duration-100",
    selected
      ? "bg-primary text-primary-foreground border-primary"
      : disabled
      ? "cursor-not-allowed opacity-40 border-border"
      : "border-border hover:bg-muted"
  )}
  ```

- [ ] **Step 3: Verify visually**

  Open the onboarding → running days step. Confirm:
  - Circles are slightly smaller than before (40px vs 44px)
  - Tapping/clicking a circle shows a brief compression on press
  - Selecting/deselecting still toggles the primary color correctly

- [ ] **Step 4: Commit**

  ```bash
  git add apps/web/components/onboarding/day-toggle.tsx
  git commit -m "fix: reduce day toggle size and add press animation"
  ```

---

### Task 4: Fix day row spacing in running days step

**Files:**
- Modify: `apps/web/components/onboarding/steps/step-which-days.tsx`

> **Note on testing:** Verify on a narrow viewport (375px iPhone width) that the 7 circles have visible, even gaps between them and are not cramped against each other.

- [ ] **Step 1: Open the file and locate the two day row divs**

  Open `apps/web/components/onboarding/steps/step-which-days.tsx`. There are **two** day rows — one for running days (~line 32) and one for long run day (~line 51). Both currently use:

  ```tsx
  <div className="flex w-full justify-between">
  ```

- [ ] **Step 2: Update both rows to use gap and center alignment**

  Replace both instances of `"flex w-full justify-between"` with `"flex w-full justify-center gap-2"`:

  ```tsx
  {/* Running days row — ~line 32 */}
  <div className="flex w-full justify-center gap-2">

  {/* Long run day row — ~line 51 */}
  <div className="flex w-full justify-center gap-2">
  ```

- [ ] **Step 3: Verify at narrow viewport**

  Check the running days step at 375px width. Confirm:
  - All 7 day circles are visible with consistent spacing between them
  - The row is horizontally centered
  - The long run day row below aligns the same way

- [ ] **Step 4: Commit**

  ```bash
  git add apps/web/components/onboarding/steps/step-which-days.tsx
  git commit -m "fix: center day toggle rows with gap to fix cramped spacing on mobile"
  ```

---

### Task 5: Fix day row spacing in lifting days step

**Files:**
- Modify: `apps/web/components/onboarding/steps/step-strength-days.tsx`

> **Note on testing:** Same check as Task 4, on the strength days step.

- [ ] **Step 1: Open the file and locate the day row**

  Open `apps/web/components/onboarding/steps/step-strength-days.tsx`. Find the single day row (~line 26):

  ```tsx
  <div className="flex w-full justify-between">
  ```

- [ ] **Step 2: Update to use gap and center alignment**

  ```tsx
  <div className="flex w-full justify-center gap-2">
  ```

- [ ] **Step 3: Verify at narrow viewport**

  Check the lifting days step at 375px width. Confirm circles have even, visible gaps and the row is centered.

- [ ] **Step 4: Commit**

  ```bash
  git add apps/web/components/onboarding/steps/step-strength-days.tsx
  git commit -m "fix: center lifting day toggle row with gap for mobile spacing"
  ```
