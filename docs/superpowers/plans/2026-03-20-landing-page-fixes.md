# Landing Page Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 19 code-review issues in `landing-page.tsx` — copy/UX polish, DRY refactoring, accessibility gaps, and mobile responsiveness bugs — plus reduce the mobile plan preview from 2 weeks to 1 week.

**Architecture:** All changes are in `apps/web/app/landing-page.tsx`, `apps/web/app/plan-preview.tsx`, and `packages/ui/src/styles/globals.css`. No new files. No new dependencies. Tasks are grouped by concern and committed independently so each is reversible. None of the tasks have testable logic — verification is `pnpm typecheck` after each task.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, inline styles (mixed pattern already established in the file)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/web/app/landing-page.tsx` | Modify | Tasks 1, 2, 3, 4 |
| `apps/web/app/plan-preview.tsx` | Modify | Task 5 (mobile plan preview) |
| `packages/ui/src/styles/globals.css` | Modify | Task 2a (keyframes) |

---

## Task 1: Copy & UX

**Files:**
- Modify: `apps/web/app/landing-page.tsx`

Six targeted text and color changes. No structural changes.

---

- [ ] **Step 1: Update hero subtitle**

Find (around line 268):
```tsx
              Pfitzinger methodology. Personalized to your goal time and race
              date. Strength training included.
```

Replace with:
```tsx
              Built on modern sports science. Personalized to your race and goal
              time. Strength training included.
```

- [ ] **Step 2: Update bottom CTA body copy**

Find (around line 441):
```tsx
            Pick your race and watch the magic happen.
```

Replace with:
```tsx
            Your plan generates in seconds, built around your race and numbers.
```

- [ ] **Step 3: Increase scroll hint text contrast**

Find (around line 395):
```tsx
                color: "rgba(255,255,255,0.18)",
```

Replace with:
```tsx
                color: "rgba(255,255,255,0.35)",
```

- [ ] **Step 4: Increase scroll hint line gradient opacity**

Find (around line 407):
```tsx
                  "linear-gradient(to bottom, rgba(255,255,255,0.18), transparent)",
```

Replace with:
```tsx
                  "linear-gradient(to bottom, rgba(255,255,255,0.35), transparent)",
```

- [ ] **Step 5: Increase green trust badge opacity**

Find (around line 369):
```tsx
                color: "rgba(74,222,128,0.55)",
```

Replace with:
```tsx
                color: "rgba(74,222,128,0.8)",
```

- [ ] **Step 6: Improve founder photo alt text**

Find (around line 624):
```tsx
                alt="Zack"
```

Replace with:
```tsx
                alt="Zack Dorward, founder of Athlos"
```

- [ ] **Step 7: Typecheck**

```bash
cd /Users/zackdorward/dev/athlos && pnpm typecheck
```

Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/landing-page.tsx
git commit -m "fix: landing page copy and UX polish"
```

---

## Task 2: Code Quality & DRY

**Files:**
- Modify: `apps/web/app/landing-page.tsx`
- Modify: `packages/ui/src/styles/globals.css`

Four sub-tasks: move keyframes to CSS, extract shared style constants, replace `useState` hover with Tailwind, memoize `handleRaceSelect`.

---

- [ ] **Step 1: Move keyframes to globals.css**

Open `packages/ui/src/styles/globals.css`. At the very end of the file, append:

```css
@keyframes bloom-1 {
  0%   { transform: translate(0%, 0%) scale(1) rotate(0deg); }
  33%  { transform: translate(6%, 8%) scale(1.15) rotate(15deg); }
  66%  { transform: translate(-4%, 3%) scale(0.95) rotate(-8deg); }
  100% { transform: translate(0%, 0%) scale(1) rotate(0deg); }
}
@keyframes bloom-2 {
  0%   { transform: translate(0%, 0%) scale(1) rotate(0deg); }
  40%  { transform: translate(-8%, -5%) scale(1.1) rotate(-20deg); }
  70%  { transform: translate(5%, 6%) scale(1.05) rotate(10deg); }
  100% { transform: translate(0%, 0%) scale(1) rotate(0deg); }
}
@keyframes bloom-3 {
  0%   { transform: translate(0%, 0%) scale(1); }
  50%  { transform: translate(4%, -6%) scale(1.08); }
  100% { transform: translate(0%, 0%) scale(1); }
}
```

- [ ] **Step 2: Remove inline `<style>` block from landing-page.tsx**

In `PageContent`, find and delete this entire block (including the `<style>` tags):

```tsx
      <style>{`
        @keyframes bloom-1 {
          0%   { transform: translate(0%, 0%) scale(1) rotate(0deg); }
          33%  { transform: translate(6%, 8%) scale(1.15) rotate(15deg); }
          66%  { transform: translate(-4%, 3%) scale(0.95) rotate(-8deg); }
          100% { transform: translate(0%, 0%) scale(1) rotate(0deg); }
        }
        @keyframes bloom-2 {
          0%   { transform: translate(0%, 0%) scale(1) rotate(0deg); }
          40%  { transform: translate(-8%, -5%) scale(1.1) rotate(-20deg); }
          70%  { transform: translate(5%, 6%) scale(1.05) rotate(10deg); }
          100% { transform: translate(0%, 0%) scale(1) rotate(0deg); }
        }
        @keyframes bloom-3 {
          0%   { transform: translate(0%, 0%) scale(1); }
          50%  { transform: translate(4%, -6%) scale(1.08); }
          100% { transform: translate(0%, 0%) scale(1); }
        }
      `}</style>
```

- [ ] **Step 3: Add shared style constants**

In `landing-page.tsx`, immediately before the line `export function LandingPage()`, add:

```tsx
const SECTION_STYLE = {
  padding: "0 24px 96px",
  maxWidth: 1100,
  margin: "0 auto",
} as const

const SECTION_HEADING_STYLE = {
  fontSize: "clamp(22px, 3.5vw, 36px)" as const,
  fontWeight: 700,
  color: "#fff",
  letterSpacing: "-0.03em",
  margin: 0,
} as const
```

- [ ] **Step 4: Apply SECTION_STYLE to FounderSection**

In `FounderSection`, find:
```tsx
      style={{ padding: "0 24px 96px", maxWidth: 1100, margin: "0 auto" }}
```

Replace with:
```tsx
      style={SECTION_STYLE}
```

- [ ] **Step 5: Apply SECTION_STYLE and SECTION_HEADING_STYLE to PlanInputsSection**

In `PlanInputsSection`, find the `<section>` style:
```tsx
      style={{ padding: "0 24px 96px", maxWidth: 1100, margin: "0 auto" }}
```

Replace with:
```tsx
      style={SECTION_STYLE}
```

Then find the `<h2>` style block:
```tsx
          style={{
            fontSize: "clamp(22px, 3.5vw, 36px)",
            fontWeight: 700,
            color: "#fff",
            letterSpacing: "-0.03em",
            margin: 0,
          }}
```

Replace with:
```tsx
          style={SECTION_HEADING_STYLE}
```

- [ ] **Step 6: Apply SECTION_STYLE and SECTION_HEADING_STYLE to ScienceSection**

In `ScienceSection`, find the `<section>` style:
```tsx
      style={{ padding: "0 24px 96px", maxWidth: 1100, margin: "0 auto" }}
```

Replace with:
```tsx
      style={SECTION_STYLE}
```

Then find the `<h2>` style block in ScienceSection:
```tsx
          style={{
            fontSize: "clamp(22px, 3.5vw, 36px)",
            fontWeight: 700,
            color: "#fff",
            letterSpacing: "-0.03em",
            margin: 0,
          }}
```

Replace with:
```tsx
          style={SECTION_HEADING_STYLE}
```

- [ ] **Step 7: Replace useState hover in ManualEntryFooter**

Find the entire `ManualEntryFooter` function and replace it:

```tsx
function ManualEntryFooter({ onSelect }: { onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="transition-colors text-white/20 hover:text-white/40 w-full cursor-pointer"
      style={{
        padding: "10px 18px",
        fontSize: 11,
        background: "none",
        border: "none",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        textAlign: "center",
      }}
    >
      Don&apos;t see yours? Add it manually →
    </button>
  )
}
```

Note: this also converts the `<div role="button">` to a `<button>` — that's intentional (also required by Task 3).

- [ ] **Step 8: Replace useState hover in DropdownRaceRow**

Find the entire `DropdownRaceRow` function and replace it:

```tsx
function DropdownRaceRow({
  race,
  onSelect,
}: {
  race: Race
  onSelect: (r: Race) => void
}) {
  const dateLabel = new Date(race.date + "T12:00:00Z").toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  )
  return (
    <button
      type="button"
      onClick={() => onSelect(race)}
      className="transition-colors hover:bg-[rgba(80,120,255,0.08)] w-full"
      style={{
        padding: "12px 18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        cursor: "pointer",
        background: "transparent",
        border: "none",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        textAlign: "left",
      }}
    >
      <div style={{ textAlign: "left" }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "rgba(255,255,255,0.82)",
          }}
        >
          {race.name}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.32)",
            marginTop: 2,
          }}
        >
          {race.city}, {race.region} · {dateLabel}
        </div>
      </div>
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.04em",
          color: "rgba(100,150,255,0.7)",
          background: "rgba(80,120,255,0.1)",
          border: "1px solid rgba(80,120,255,0.18)",
          borderRadius: 4,
          padding: "2px 7px",
          flexShrink: 0,
          marginLeft: 16,
        }}
      >
        {DISTANCE_LABELS[race.distance]}
      </span>
    </button>
  )
}
```

- [ ] **Step 9: Memoize handleRaceSelect with useCallback**

Add `useCallback` to the React import at line 3:

```tsx
import React, { Suspense, useCallback, useEffect, useRef, useState } from "react"
```

Then in `PageContent`, change `handleRaceSelect` from a plain function to a `useCallback`:

Find:
```tsx
  function handleRaceSelect(race: Race) {
    const raceData: RaceData = {
      name: race.name,
      city: `${race.city}, ${race.region}`,
      date: new Date(race.date + "T12:00:00Z"),
      distance: race.distance,
    }
    setInitialData({ goal: "race", race: raceData })
    setShowOnboarding(true)
  }
```

Replace with:
```tsx
  const handleRaceSelect = useCallback((race: Race) => {
    const raceData: RaceData = {
      name: race.name,
      city: `${race.city}, ${race.region}`,
      date: new Date(race.date + "T12:00:00Z"),
      distance: race.distance,
    }
    setInitialData({ goal: "race", race: raceData })
    setShowOnboarding(true)
  }, [])
```

The empty dependency array is correct: `setInitialData` and `setShowOnboarding` are React state setters, which are guaranteed stable references and do not need to be listed.

- [ ] **Step 10: Typecheck**

```bash
cd /Users/zackdorward/dev/athlos && pnpm typecheck
```

Expected: no errors

- [ ] **Step 11: Commit**

```bash
git add apps/web/app/landing-page.tsx packages/ui/src/styles/globals.css
git commit -m "refactor: DRY landing page — shared constants, CSS keyframes, Tailwind hover, memoized handler"
```

---

## Task 3: Accessibility

**Files:**
- Modify: `apps/web/app/landing-page.tsx`

Six accessibility fixes. `ManualEntryFooter` and `DropdownRaceRow` are already converted to `<button>` in Task 2 — this task adds the remaining ARIA attributes and the live region.

---

- [ ] **Step 1: Add aria-hidden to decorative elements**

Add `aria-hidden="true"` to each of these five elements. Find each by the comment above it:

**Dot grid** — find:
```tsx
          {/* Dot grid */}
          <div
            style={{
```
Add `aria-hidden="true"` to that `<div>`.

**Aurora bloom 1** — find:
```tsx
          {/* Aurora blooms */}
          <div
            style={{
```
Add `aria-hidden="true"` to that `<div>`.

**Aurora bloom 2** — find the second bloom `<div>` (right after bloom 1's closing `/>`)
Add `aria-hidden="true"`.

**Aurora bloom 3** — find the third bloom `<div>`
Add `aria-hidden="true"`.

**Vignette** — find:
```tsx
          {/* Vignette */}
          <div
            style={{
```
Add `aria-hidden="true"` to that `<div>`.

**Scroll hint** — find:
```tsx
          {/* Scroll hint */}
          <div
            style={{
```
Add `aria-hidden="true"` to that `<div>`.

- [ ] **Step 2: Add aria-label to search input**

Find the `<input>` element (around line 298):
```tsx
                <input
                  placeholder="Search races by name or city…"
```

Add `aria-label="Search races by name or city"` as the first prop:
```tsx
                <input
                  aria-label="Search races by name or city"
                  placeholder="Search races by name or city…"
```

- [ ] **Step 3: Add combobox ARIA to search input**

On the same `<input>`, also add:
```tsx
                  role="combobox"
                  aria-expanded={isOpen}
                  aria-haspopup="listbox"
```

- [ ] **Step 4: Add listbox and option ARIA roles to dropdown**

Find the dropdown container div (the one with `position: "absolute"`, `top: "100%"`, `zIndex: 20`). Add `role="listbox"` to it:

```tsx
                <div
                  role="listbox"
                  style={{
                    position: "absolute",
                    top: "100%",
```

In `DropdownRaceRow` (already converted to `<button>` in Task 2), add `role="option"` to the `<button>`:
```tsx
    <button
      type="button"
      role="option"
      onClick={() => onSelect(race)}
```

- [ ] **Step 5: Add aria-live region for search results**

Inside the search widget `<div ref={wrapRef}>`, immediately after the closing `</div>` of the search input row (after the `backdropFilter` div), and before the `{isOpen && (` dropdown, add:

```tsx
              <div
                aria-live="polite"
                aria-atomic="true"
                style={{
                  position: "absolute",
                  width: "1px",
                  height: "1px",
                  overflow: "hidden",
                  clip: "rect(0,0,0,0)",
                  whiteSpace: "nowrap",
                }}
              >
                {isOpen && !loading && query.trim() !== "" && (
                  results.length > 0
                    ? `${results.length} race${results.length === 1 ? "" : "s"} found`
                    : "No races found"
                )}
              </div>
```

- [ ] **Step 6: Add focus ring to Log in button**

Find the Log in button (around line 213):
```tsx
            <button
              onClick={() => setShowSignIn(true)}
              style={{
```

Add `className="focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none"`:
```tsx
            <button
              onClick={() => setShowSignIn(true)}
              className="focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none"
              style={{
```

- [ ] **Step 7: Typecheck**

```bash
cd /Users/zackdorward/dev/athlos && pnpm typecheck
```

Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/landing-page.tsx
git commit -m "fix: accessibility — aria roles, labels, live region, focus ring, decorative aria-hidden"
```

---

## Task 4: Mobile Responsiveness

**Files:**
- Modify: `apps/web/app/landing-page.tsx`

Four mobile layout fixes.

---

- [ ] **Step 1: Fix nav padding at 320px**

Find (around line 205):
```tsx
              padding: "24px 36px",
```

Replace with:
```tsx
              padding: "20px clamp(16px, 4vw, 36px)",
```

This gives 16px side padding at 320px, growing to 36px at 900px+.

- [ ] **Step 2: Fix FounderSection photo column centering on mobile**

In `FounderSection`, find the photo column div:
```tsx
          {/* Photo column */}
          <div
            style={{
              flexShrink: 0,
              minWidth: 120,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
```

Replace with (Tailwind handles layout, remove conflicting inline styles):
```tsx
          {/* Photo column */}
          <div className="shrink-0 flex flex-col items-center w-full sm:w-auto">
```

On mobile (`< 640px`) `w-full` makes the column span the full row width and `items-center` centers the avatar. On `sm:` and up, `w-auto` restores the natural width.

- [ ] **Step 3: Fix stats row overflow at 320px**

In `FounderSection`, find the stat cell mapping (inside the stats row). Each cell currently has:
```tsx
                flex: 1,
                padding: "16px 20px",
```

Replace both values:
```tsx
                flex: 1,
                padding: "12px 8px",
```

Also reduce the stat value `fontSize` from `22` to `18`:

Find:
```tsx
              <div style={{ fontSize: 22, fontWeight: 700, color: stat.color }}>
```

Replace with:
```tsx
              <div style={{ fontSize: 18, fontWeight: 700, color: stat.color }}>
```

- [ ] **Step 4: Fix phases grid description column overflow**

In `ScienceSection`, find the description column div inside the phases map (the `1fr` column):
```tsx
              <div
                style={{
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: "rgba(255,255,255,0.55)",
                  paddingTop: 4,
                }}
              >
```

Add `minWidth: 0` and `wordBreak: "break-word"`:
```tsx
              <div
                style={{
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: "rgba(255,255,255,0.55)",
                  paddingTop: 4,
                  minWidth: 0,
                  wordBreak: "break-word",
                }}
              >
```

- [ ] **Step 5: Typecheck**

```bash
cd /Users/zackdorward/dev/athlos && pnpm typecheck
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/landing-page.tsx
git commit -m "fix: mobile responsiveness — nav padding, founder photo, stats row, phases grid"
```

---

## Task 5: Mobile Plan Preview — Reduce to 1 Week

**Files:**
- Modify: `apps/web/app/plan-preview.tsx`

On mobile, the plan preview currently renders both weeks of mock data. The mobile list view is verbose (one row per day) and two weeks is too long. Show only the first week on mobile.

---

- [ ] **Step 1: Slice mockWeeks in the mobile list**

In `plan-preview.tsx`, find the mobile list section:
```tsx
          {/* Mobile list */}
          <div className="mock-plan-mobile">
            {mockWeeks.map((week, wi) => (
```

Change `mockWeeks.map` to `mockWeeks.slice(0, 1).map`:
```tsx
          {/* Mobile list */}
          <div className="mock-plan-mobile">
            {mockWeeks.slice(0, 1).map((week, wi) => (
```

The desktop calendar grid is unchanged — it still shows both weeks.

- [ ] **Step 2: Typecheck**

```bash
cd /Users/zackdorward/dev/athlos && pnpm typecheck
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/plan-preview.tsx
git commit -m "fix: show only first week in mobile plan preview"
```
