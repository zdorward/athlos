# Athloryx Design System

## Overview

Sharp, data-driven, minimal, adaptive visual language for serious competitive athletes. Built on the existing Next.js 16 + Tailwind CSS v4 + shadcn/ui stack.

**Core feel:** Performance-lab precision meets premium product. Every element earns its place.

---

## Implementation Notes

### Color format
All CSS custom properties must be in **oklch format** to work with Tailwind v4's opacity modifier syntax (`bg-primary/12`, `text-foreground/60`, etc.). Hex values will not compose with Tailwind opacity modifiers. The hex values in this doc are design references only — oklch equivalents are provided for every token.

### File to edit
The token file is **`packages/ui/src/styles/globals.css`** (not `apps/web/app/globals.css`). The web app imports it via `@workspace/ui/globals.css` in `layout.tsx`.

### Font loading
`layout.tsx` already loads both `Geist` and `Geist_Mono` as variable fonts via `next/font/google`. No weight array is needed — variable fonts expose the full weight axis (100–900) automatically. The variables `--font-sans` (Geist) and `--font-mono` (Geist Mono) are already registered. No changes to `layout.tsx` are needed.

### Animations
`globals.css` imports `tw-animate-css` which provides `shimmer-slide` and `spin-around` keyframes used by animated Magic UI components. These are unaffected by this design system update and should remain.

---

## Color System

Replace the `:root` and `.dark` blocks in `packages/ui/src/styles/globals.css`. All tokens not listed below (sidebar-*, chart-*, destructive) remain unchanged.

### Dark mode (`.dark`)

| Token | oklch | Hex ref | Usage |
|---|---|---|---|
| `--background` | `oklch(0.13 0.025 255)` | `#0f1520` | Page background |
| `--card` | `oklch(0.18 0.03 255)` | `#161c2d` | Card / panel background |
| `--card-foreground` | `oklch(0.93 0.02 255)` | `#e2eaf8` | Text on cards |
| `--popover` | `oklch(0.18 0.03 255)` | `#161c2d` | Dropdown / tooltip background |
| `--popover-foreground` | `oklch(0.93 0.02 255)` | `#e2eaf8` | Text in popovers |
| `--muted` | `oklch(0.22 0.035 255)` | `#1c2438` | Raised surfaces, hover backgrounds |
| `--muted-foreground` | `oklch(0.55 0.06 255)` | `#6b80a8` | Secondary text |
| `--subtle-foreground` | `oklch(0.38 0.06 255)` | `#3d4f6e` | Labels, placeholders, metadata |
| `--primary` | `oklch(0.68 0.16 255)` | `#5b9cf6` | Accent — CTAs, active labels, key metrics |
| `--primary-foreground` | `oklch(0.10 0.03 255)` | `#0b1120` | Text on primary buttons |
| `--secondary` | `oklch(0.22 0.035 255)` | `#1c2438` | Same as muted |
| `--secondary-foreground` | `oklch(0.93 0.02 255)` | `#e2eaf8` | Text on secondary elements |
| `--accent` | `oklch(0.22 0.035 255)` | `#1c2438` | Hover states (nav, dropdowns) — NOT the blue accent |
| `--accent-foreground` | `oklch(0.93 0.02 255)` | `#e2eaf8` | Text on accent hover |
| `--foreground` | `oklch(0.93 0.02 255)` | `#e2eaf8` | Primary text |
| `--border` | `oklch(1 0 0 / 7%)` | — | All borders |
| `--input` | `oklch(1 0 0 / 15%)` | — | Input borders / backgrounds |
| `--ring` | `oklch(0.68 0.16 255)` | `#5b9cf6` | Focus rings (matches primary) |

> **Note:** In shadcn, `--accent` is the hover background for nav/menu items — not a brand color. Our blue accent maps to `--primary`. Do not overwrite `--accent` with the blue.

### Light mode (`:root`)

| Token | oklch | Hex ref | Usage |
|---|---|---|---|
| `--background` | `oklch(0.97 0.01 255)` | `#f0f4f9` | Page background |
| `--card` | `oklch(1 0 0)` | `#ffffff` | Card background |
| `--card-foreground` | `oklch(0.12 0.025 255)` | `#0d1421` | Text on cards |
| `--popover` | `oklch(1 0 0)` | `#ffffff` | Dropdown background |
| `--popover-foreground` | `oklch(0.12 0.025 255)` | `#0d1421` | Text in popovers |
| `--muted` | `oklch(0.985 0.004 255)` | `#f8fafc` | Raised surfaces |
| `--muted-foreground` | `oklch(0.51 0.04 255)` | `#64748b` | Secondary text |
| `--subtle-foreground` | `oklch(0.68 0.03 255)` | `#94a3b8` | Labels, placeholders |
| `--primary` | `oklch(0.52 0.24 264)` | `#2563eb` | Accent |
| `--primary-foreground` | `oklch(1 0 0)` | `#ffffff` | Text on primary buttons |
| `--secondary` | `oklch(0.97 0 0)` | — | Keep current |
| `--secondary-foreground` | `oklch(0.205 0 0)` | — | Keep current |
| `--accent` | `oklch(0.97 0 0)` | — | Keep current (nav hover) |
| `--accent-foreground` | `oklch(0.205 0 0)` | — | Keep current |
| `--foreground` | `oklch(0.12 0.025 255)` | `#0d1421` | Primary text |
| `--border` | `oklch(0.92 0.01 255)` | `#e2e8f0` | All borders |
| `--input` | `oklch(0.92 0.01 255)` | `#e2e8f0` | Input borders |
| `--ring` | `oklch(0.52 0.24 264)` | `#2563eb` | Focus rings |

### `@theme inline` addition

Add one line to the `@theme inline` block for the new token:

```css
--color-subtle-foreground: var(--subtle-foreground);
```

This registers it as a Tailwind utility so `text-subtle-foreground` works as a class.

---

## Border Radius

Set `--radius: 0.5rem` (8px) in both `:root` and `.dark`. The existing calculated scale then produces:

| Tailwind class | Computed value | Used for |
|---|---|---|
| `rounded-[2px]` | 2px (arbitrary) | Progress bars, thin dividers |
| `rounded-sm` | 3px | Tags, badges, chips |
| `rounded-md` | 4px | Buttons, inputs, selects |
| `rounded-lg` | 8px | Cards, containers |

> Current value is `0.625rem` (10px). Changing to `0.5rem` reduces all `rounded-*` classes proportionally. No component class names change — only the pixel output changes.

---

## Typography

Geist (sans) and Geist Mono are both already loaded via `next/font/google` as variable fonts. No font loading changes needed.

**Rule:** All data values (pace, distance, HR, dates, times) use `font-mono` (`font-variant-numeric: tabular-nums` is implicit in Geist Mono). All other text uses the default `font-sans` (Geist).

### Scale

| Role | Class | Weight | Tracking | Notes |
|---|---|---|---|---|
| Display / hero metric | `text-4xl` to `text-5xl` | `font-extrabold` (800) | `tracking-tighter` | Large KPIs |
| H1 | `text-2xl` | `font-bold` (700) | `tracking-tight` | Page/step titles |
| H2 | `text-xl` | `font-semibold` (600) | `tracking-tight` | Section headings |
| Body | `text-sm` | `font-normal` (400) | default | Prose |
| Data value (large) | `text-3xl` + `font-mono` | `font-bold` (700) | `tracking-tight` | Pace, distance |
| Data value (small) | `text-sm` + `font-mono` | `font-medium` (500) | default | Inline stats |
| Label | `text-[10px]` + `uppercase` | `font-semibold` (600) | `tracking-[0.14em]` | Metric keys, category labels |
| Caption | `text-xs` | `font-normal` (400) | default | Units, sub-labels |

---

## Components

### Cards

```
bg-card border border-border rounded-lg p-5
```

Primary metric variant adds `border-t-2 border-t-primary bg-primary/12` to highlight the key card.

### Buttons

**Primary:**
```
bg-primary text-primary-foreground rounded-md font-semibold
```

**Ghost** (updated to include visible border — different from current implementation):
```
bg-transparent border border-border text-muted-foreground rounded-md
hover:bg-muted hover:text-foreground
```

> This is a change from the current ghost CVA variant which has no border. Update the `ghost` variant in `packages/ui/src/components/button.tsx` to add `border border-border`. Do not use the existing `outline` variant as a substitute — it includes `bg-background` rather than `bg-transparent`, which produces a different visual result.

### Tags / Badges

Active (e.g. "Race"):
```
bg-primary/12 border border-primary/20 text-primary
text-[10px] font-semibold tracking-[0.1em] uppercase rounded-sm px-2.5 py-1
```

Neutral (metadata):
```
bg-foreground/4 border border-border text-muted-foreground
text-[10px] font-semibold tracking-[0.1em] uppercase rounded-sm px-2.5 py-1
```

> A `badge.tsx` update or new variant is needed for the active state. Check current `packages/ui/src/components/badge.tsx` and either add a variant or override per-usage.

### Inputs

```
bg-muted border border-input rounded-md text-sm text-foreground
focus:border-primary focus:outline-none transition-colors
```

### Progress Bars

```
h-[3px] bg-border rounded-[2px]          /* track */
h-full bg-primary rounded-[2px]           /* fill */
transition-all duration-300               /* animated fill */
```

---

## Motion

- **Step transitions:** Keep existing Framer Motion slide implementation unchanged
- **Hover / focus:** `transition-colors duration-150` only — no scale, no translate, no bounce
- **Easing:** `ease-out` throughout

---

## Files to Touch

| File | Change |
|---|---|
| `packages/ui/src/styles/globals.css` | Replace color tokens (`:root`, `.dark`), set `--radius: 0.5rem`, add `--subtle-foreground` tokens and `--color-subtle-foreground` to `@theme inline` |
| `packages/ui/src/components/button.tsx` | Update `ghost` variant to include `border border-border`; adjust `rounded-lg` → `rounded-md` on base class if needed |
| `packages/ui/src/components/card.tsx` | Confirm uses `rounded-lg` (will auto-update when `--radius` changes) |
| `packages/ui/src/components/input.tsx` | Confirm uses `rounded-md` and `border-input`; confirm focus ring uses `ring-ring` |
| `packages/ui/src/components/badge.tsx` | Add active (accent) variant for tags used in onboarding summary |
