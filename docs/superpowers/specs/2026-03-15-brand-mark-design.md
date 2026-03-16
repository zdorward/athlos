# Brand Mark Design

**Date:** 2026-03-15
**Status:** Approved

## Problem

The current Athlos brand assets are fragmented across many files (9 image files, light/dark variants for each), several of which are not referenced anywhere in code. The mark is a letter "A" — a generic letterform with no distinct character. The favicon setup has redundancy that Next.js App Router handles automatically.

## Goal

Replace all existing logos, marks, and favicons with a new abstract mark using the minimum number of files a Next.js web app needs. The mark should feel precise, structured, and technical — fitting for an adaptive training system.

## Design

### Mark

A **2×2 grid of uniform rounded squares** with four distinct opacity levels that create a diagonal flow from top-left (lightest) to top-right (anchor) to bottom-left (strong) to bottom-right (fades).

**Viewbox:** `0 0 72 72`

**Cell geometry:**
| Cell | x | y | width | height | rx |
|------|---|---|-------|--------|----|
| top-left | 6 | 6 | 28 | 28 | 5 |
| top-right | 38 | 6 | 28 | 28 | 5 |
| bottom-left | 6 | 38 | 28 | 28 | 5 |
| bottom-right | 38 | 38 | 28 | 28 | 5 |

**Colors:**

On dark backgrounds (`#0D1421`):
| Cell | Fill | Opacity |
|------|------|---------|
| top-left | `#06b6d4` | 0.35 |
| top-right | `#06b6d4` | 1.00 |
| bottom-left | `#06b6d4` | 0.80 |
| bottom-right | `#06b6d4` | 0.55 |

On light backgrounds (e.g. `#f8fafc`):
| Cell | Fill | Opacity |
|------|------|---------|
| top-left | `#0D1421` | 0.20 |
| top-right | `#0D1421` | 0.85 |
| bottom-left | `#0D1421` | 0.65 |
| bottom-right | `#0D1421` | 0.40 |

The opacity diagonal (top-left → top-right anchor → bottom-left → bottom-right) creates a subtle directional flow without introducing additional colors.

**The mark is SVG-only.** No raster versions are created. `app/icon.svg` contains the dark-background version (cyan fill). Next.js serves this as the browser favicon at all sizes. A raster `apple-icon.png` (180×180) is generated from the same SVG for iOS homescreen.

### Wordmark

The existing `components/wordmark.tsx` text component is unchanged. It renders "ATHLOS" as plain text — no file dependency, inherits color from context.

### Lockup

Mark + wordmark are composed at the usage site (nav, onboarding header) by placing the `<svg>` mark inline next to the `<Wordmark />` component. No combined lockup file is created.

## Files

### Created (3)

| File | Purpose |
|------|---------|
| `apps/web/app/icon.svg` | Primary mark SVG. Next.js auto-discovers this and serves it as the site icon for all modern browsers. Replaces all PNGs and the ICO file. |
| `apps/web/app/apple-icon.png` | 180×180 PNG for iOS homescreen (Apple touch icon). Generated from the SVG mark at implementation time using a canvas or sharp script — not hand-crafted. |
| `apps/web/public/site.webmanifest` | Replaces the existing empty manifest. Sets `name`, `short_name`, background color (`#0D1421`), theme color (`#06b6d4`). References only the apple-icon.png for PWA icon (no additional PNG sizes needed). |

### Deleted (9)

- `apps/web/app/favicon.ico` — superseded by `icon.svg` (Next.js generates ICO from SVG)
- `apps/web/public/favicon-16x16.png`
- `apps/web/public/favicon-32x32.png`
- `apps/web/public/android-chrome-192x192.png`
- `apps/web/public/android-chrome-512x512.png`
- `apps/web/public/logo-light.svg` — not referenced in code
- `apps/web/public/logo-dark.svg` — not referenced in code
- `apps/web/public/mark-light.svg` — not referenced in code
- `apps/web/public/mark-dark.svg` — not referenced in code

### Unchanged (1)

- `apps/web/components/wordmark.tsx` — text-only component, no changes needed

## SVG Source

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72" fill="none">
  <rect x="6"  y="6"  width="28" height="28" rx="5" fill="#06b6d4" opacity="0.35"/>
  <rect x="38" y="6"  width="28" height="28" rx="5" fill="#06b6d4" opacity="1"/>
  <rect x="6"  y="38" width="28" height="28" rx="5" fill="#06b6d4" opacity="0.8"/>
  <rect x="38" y="38" width="28" height="28" rx="5" fill="#06b6d4" opacity="0.55"/>
</svg>
```

## apple-icon.png Generation

At implementation time, generate the 180×180 PNG by running a Node script using the `sharp` package (already available in the monorepo or installable as a one-time dev tool):

```js
// scripts/generate-apple-icon.mjs
import sharp from "sharp"
import { readFileSync } from "fs"

const svg = readFileSync("apps/web/app/icon.svg")
await sharp(svg).resize(180, 180).png().toFile("apps/web/app/apple-icon.png")
```

Run once, commit the PNG, delete the script. The PNG does not need to be regenerated unless the mark changes.

## Out of Scope

- Dark/light variant of the mark SVG (the SVG is dark-background only; the light-background version is composed in code at the usage site using Tailwind classes or CSS variables — this is a UI concern, not a brand asset file)
- OG image (`og-image.png`) — separate ticket
- Favicon for Safari pinned tabs (`safari-pinned-tab.svg`) — not needed
- Any additional PWA icon sizes beyond apple-icon.png
