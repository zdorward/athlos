# Athloryx Design System

## Overview

Sharp, data-driven, minimal, adaptive visual language for serious competitive athletes. Built on the existing Next.js 16 + Tailwind CSS v4 + shadcn/ui stack.

**Core feel:** Performance-lab precision meets premium product. Every element earns its place.

---

## Color System

All colors implemented as CSS custom properties in `globals.css`, consumed by Tailwind via `@theme`. Both dark and light modes defined — switching is handled by `next-themes` (already in the stack).

### Dark Mode (default)

| Token | Value | Usage |
|---|---|---|
| `--background` | `#0f1520` | Page background |
| `--card` | `#161c2d` | Card / surface background |
| `--muted` | `#1c2438` | Raised surface, hover states |
| `--border` | `rgba(255,255,255,0.07)` | All borders |
| `--primary` | `#5b9cf6` | Accent — CTAs, active labels, key metrics |
| `--primary-foreground` | `#0b1120` | Text on primary buttons |
| `--primary/12` | `rgba(91,156,246,0.12)` | Accent muted background |
| `--foreground` | `#e2eaf8` | Primary text |
| `--muted-foreground` | `#6b80a8` | Secondary text |
| `--subtle-foreground` | `#3d4f6e` | Labels, placeholders, metadata |

### Light Mode

| Token | Value | Usage |
|---|---|---|
| `--background` | `#f0f4f9` | Page background |
| `--card` | `#ffffff` | Card background |
| `--muted` | `#f8fafc` | Raised surface |
| `--border` | `#e2e8f0` | All borders |
| `--primary` | `#2563eb` | Accent |
| `--primary-foreground` | `#ffffff` | Text on primary buttons |
| `--foreground` | `#0d1421` | Primary text |
| `--muted-foreground` | `#64748b` | Secondary text |
| `--subtle-foreground` | `#94a3b8` | Labels, metadata |

---

## Typography

**Font:** Geist (already loaded via `next/font/google` in the Next.js app). One font family throughout — no secondary typeface.

Data values are differentiated from prose through weight, size, and `font-variant-numeric: tabular-nums` — not a separate font.

### Scale

| Role | Size | Weight | Tracking | Notes |
|---|---|---|---|---|
| Display / hero metric | 42–48px | 800 | -2px | Large KPIs, race name |
| H1 | 28px | 800 | -1px | Page titles |
| H2 | 22px | 700 | -0.5px | Section headings |
| H3 | 16px | 600 | -0.25px | Card titles |
| Body | 14px | 400 | normal | Prose, descriptions |
| Data value (large) | 28–36px | 700 | -0.5px | Pace, distance, HR |
| Data value (small) | 14–16px | 600 | normal | Inline stats |
| Label | 10–11px | 600 | 0.14em | Uppercase, metric keys |
| Caption | 11px | 400 | normal | Sub-labels, units |

**Rule:** Labels are always uppercase with `letter-spacing: 0.14em`. Data values always use `font-variant-numeric: tabular-nums`.

---

## Shape

| Context | Radius |
|---|---|
| Cards, modals, large containers | 8px |
| Buttons, inputs, selects | 6px |
| Tags, badges, chips | 4px |
| Progress bars, dividers | 2px |

---

## Components

### Cards

- Background: `--card`
- Border: `1px solid --border`
- Border radius: `8px`
- Padding: `20–24px`
- **Primary metric variant:** `border-top: 2px solid --primary`, background shifted to `--primary/12`

### Buttons

- **Primary:** `background: --primary`, `color: --primary-foreground`, `font-weight: 600`, subtle uppercase label tracking
- **Ghost:** `background: transparent`, `border: 1px solid --border`, `color: --muted-foreground`
- Border radius: `6px`
- Transition: `150ms ease-out` on background and color only
- No shadows

### Labels / Metric Keys

- `font-size: 10–11px`, `font-weight: 600`, `letter-spacing: 0.14em`, `text-transform: uppercase`
- Active / primary: `color: --primary`
- Inactive / metadata: `color: --subtle-foreground`

### Tags / Badges

- **Active state** (e.g. "Race", "Week 14"): `background: --primary/12`, `border: 1px solid rgba(primary, 0.2)`, `color: --primary`
- **Neutral** (e.g. "Full Marathon"): `background: rgba(255,255,255,0.04)`, `border: 1px solid --border`, `color: --muted-foreground`
- Border radius: `4px`, `font-size: 10px`, `font-weight: 600`, uppercase

### Progress Bars

- Height: `3px` (prominent) or `2px` (subtle)
- Track: `--muted` or `--border`
- Fill: `--primary`
- Border radius: `2px`

### Inputs

- Background: `--muted` (raised surface)
- Border: `1px solid --border`
- Focus border: `--primary`
- Border radius: `6px`
- Font: Geist 14px, `--foreground`

---

## Motion

Purposeful and fast. Nothing decorative.

- **Step transitions:** Existing Framer Motion slide (already implemented) — keep as-is
- **Hover / focus:** `transition: 150ms ease-out` on `color`, `border-color`, `background` only
- **No bounce, no spring, no scale transforms** on interactive elements
- Easing: `ease-out` throughout

---

## Implementation Approach

### 1. Update `globals.css`

Replace current shadcn color tokens with the new palette. Tailwind v4 reads these via `@theme`. Both `:root` (light) and `.dark` overrides defined here.

### 2. `next/font/google` — Geist

Geist is already configured in `apps/web/app/layout.tsx` as the default font via `next/font/google`. No changes needed to font loading.

### 3. Tailwind config

No changes to `tailwind.config.ts` — the token names map directly to existing shadcn conventions (`background`, `foreground`, `card`, `primary`, `muted`, `border`, etc.), so all existing component classes continue to work.

### 4. shadcn/ui component overrides

Minor tweaks to `button.tsx`, `card.tsx`, and `input.tsx` CVA base classes to apply correct border-radius values and remove any default shadows.

### 5. `next-themes`

Already configured. No changes needed — light/dark switching works via the `.dark` class on `<html>`.

---

## Files to Touch

| File | Change |
|---|---|
| `apps/web/app/globals.css` | Replace color tokens, add `font-variant-numeric: tabular-nums` utility |
| `packages/ui/src/components/button.tsx` | Adjust radius (already has `cursor-pointer` fix) |
| `packages/ui/src/components/card.tsx` | Confirm radius matches spec |
| `packages/ui/src/components/input.tsx` | Confirm radius and focus ring |
| `apps/web/app/layout.tsx` | Confirm Geist is loaded with correct weights (400–800) |
