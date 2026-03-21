# Landing Page Fixes Design

**Date:** 2026-03-20
**Status:** Approved

## Overview

Fix 19 issues identified in a code review of `apps/web/app/landing-page.tsx`: copy/UX polish, code quality and DRY improvements, accessibility gaps, and mobile responsiveness bugs. All changes are in `apps/web/app/landing-page.tsx` and `packages/ui/src/styles/globals.css`.

---

## Files Changed

| File | Change |
|------|--------|
| `apps/web/app/landing-page.tsx` | All four task groups |
| `packages/ui/src/styles/globals.css` | Keyframe animations moved here from inline `<style>` |

---

## Task 1: Copy & UX

Six targeted text and color changes. No structural changes.

| Location | Current | New |
|----------|---------|-----|
| Hero subtitle (line ~268) | `"Pfitzinger methodology. Personalized to your goal time and race date. Strength training included."` | `"Built on modern sports science. Personalized to your race and goal time. Strength training included."` |
| Bottom CTA body (line ~441) | `"Pick your race and watch the magic happen."` | `"Your plan generates in seconds, built around your race and numbers."` |
| Scroll hint text color (line ~395) | `rgba(255,255,255,0.18)` | `rgba(255,255,255,0.35)` |
| Scroll hint line gradient (line ~407) | starts at `rgba(255,255,255,0.18)` | starts at `rgba(255,255,255,0.35)` |
| Green trust badge color (line ~369) | `rgba(74,222,128,0.55)` | `rgba(74,222,128,0.8)` |
| Founder photo alt (line ~624) | `"Zack"` | `"Zack Dorward, founder of Athlos"` |

---

## Task 2: Code Quality & DRY

### 2a. Move keyframes to CSS

Move `@keyframes bloom-1`, `bloom-2`, `bloom-3` from the inline `<style>` block in `PageContent` to the end of `packages/ui/src/styles/globals.css`. Remove the `<style>` tag from `landing-page.tsx`. Animation names are unchanged — no other references need updating.

### 2b. Extract shared style constants

Add two constants at the top of `landing-page.tsx`, before the first component definition:

```ts
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

Apply `SECTION_STYLE` to the `<section>` element in `FounderSection`, `PlanInputsSection`, and `ScienceSection`. Apply `SECTION_HEADING_STYLE` to the `<h2>` in `PlanInputsSection` and `ScienceSection`. The Bottom CTA heading has a different `fontSize` — keep its own inline style.

### 2c. Replace `useState` hover with CSS

`ManualEntryFooter` and `DropdownRaceRow` both use `useState(false)` + `onMouseEnter`/`onMouseLeave` for hover color shifts. Replace with Tailwind hover utilities, removing all hover state:

- **`ManualEntryFooter`**: remove `hovered` state and handlers; set static `color: "rgba(255,255,255,0.2)"` as base; add `className="transition-colors hover:text-white/40"` (or equivalent Tailwind utility)
- **`DropdownRaceRow`**: remove `hovered` state and handlers; set static `background: "transparent"` as base; add `className="transition-colors hover:bg-[rgba(80,120,255,0.08)]"`

### 2d. Memoize `handleRaceSelect`

Wrap `handleRaceSelect` in `useCallback` with an empty dependency array. Add `useCallback` to the React import. This prevents new function references on every search keystroke and avoids unnecessary `DropdownRaceRow` re-renders.

```ts
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

---

## Task 3: Accessibility

### 3a. `aria-label` on search input

Add `aria-label="Search races by name or city"` to the `<input>` element in `PageContent`.

### 3b. `aria-hidden` on decorative elements

Add `aria-hidden="true"` to each of these decorative divs:
- Dot grid background div
- Aurora bloom div 1
- Aurora bloom div 2
- Aurora bloom div 3
- Vignette div
- Scroll hint div

### 3c. Dropdown ARIA roles

Add to the search `<input>`:
- `role="combobox"`
- `aria-expanded={isOpen}`
- `aria-haspopup="listbox"`

Add to the dropdown container div (the one with `position: "absolute"` and `role` currently absent):
- `role="listbox"`

Add to each `DropdownRaceRow` root element:
- `role="option"`

### 3d. Convert `<div role="button">` to `<button>`

**`ManualEntryFooter`**: change the root `<div role="button">` to `<button type="button">`. Remove `role="button"` (redundant). Keep `onClick`. Add style resets to the button: `background: "none"`, `border: "none"`, `width: "100%"`, `cursor: "pointer"`, `textAlign: "center"` — merge with existing inline styles.

**`DropdownRaceRow`**: change root `<div role="button">` to `<button type="button">`. Remove `role="button"`. Keep `onClick`. Add `width: "100%"`, `background: "none"`, `border: "none"`, `cursor: "pointer"`, `textAlign: "left"` to inline styles.

### 3e. `aria-live` region for search results

Add a visually hidden `<div>` immediately after the search `<input>` (inside the search widget wrapper) with:
- `aria-live="polite"`
- `aria-atomic="true"`
- Visually hidden styles: `position: "absolute"`, `width: 1`, `height: 1`, `overflow: "hidden"`, `clip: "rect(0,0,0,0)"`, `whiteSpace: "nowrap"`

Content: when `isOpen && !loading && results.length > 0`: `"{results.length} race{results.length === 1 ? "" : "s"} found"`. When `isOpen && !loading && results.length === 0 && query.trim() !== ""`: `"No races found"`. Otherwise: `""`.

### 3f. Focus ring on Log in button

Add `className="focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none"` to the Log in `<button>`.

---

## Task 4: Mobile Responsiveness

### 4a. Nav padding at 320px

Change nav `padding` from `"24px 36px"` to `"20px clamp(16px, 4vw, 36px)"`. At 320px this gives 16px side padding (288px interior). At 1200px+ it stays at 36px.

### 4b. FounderSection photo column centering on wrap

The photo column left-aligns when the flex row wraps on mobile. Fix by replacing the inline-style `flexShrink: 0, minWidth: 120` on the photo column with Tailwind classes:

```tsx
className="shrink-0 flex flex-col items-center w-full sm:w-auto"
```

Remove the conflicting `flexShrink`, `minWidth`, `display`, `flexDirection`, `alignItems` inline styles from that div — they are fully covered by the Tailwind classes. The outer flex wrapper already has `flexWrap: "wrap"` — no change needed there.

### 4c. Stats row at 320px

Reduce cell padding from `"16px 20px"` to `"12px 8px"` and stat value `fontSize` from `22` to `18`. This ensures the three cells fit within ~91px each at 320px without label overflow.

### 4d. Phases grid overflow protection

Add to the description column div (the `1fr` column):
- `minWidth: 0` — prevents the `1fr` column from expanding past its grid track and pushing the badge column
- `wordBreak: "break-word"` — wraps long words gracefully at narrow widths

---

## Constraints

- No new files — all changes in the two files listed above
- No new dependencies
- Tailwind classes are already used in this file (`PlanInputsSection` uses `className="grid grid-cols-1 md:grid-cols-2 gap-6"`) — mixing is established pattern
- `useCallback` requires adding it to the existing React import (already imports `useState`, `useEffect`, `useRef`)
