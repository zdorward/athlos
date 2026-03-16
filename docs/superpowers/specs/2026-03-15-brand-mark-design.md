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

### Created (2)

| File | Purpose |
|------|---------|
| `apps/web/app/icon.svg` | Primary mark SVG. Next.js auto-discovers this and serves it as the site icon for all modern browsers. Replaces all PNGs and the ICO file. |
| `apps/web/app/apple-icon.png` | 180×180 PNG for iOS homescreen (Apple touch icon). Generated from the SVG mark at implementation time — not hand-crafted. |

### Modified (1)

| File | Change |
|------|--------|
| `apps/web/public/site.webmanifest` | Replace contents with the following exact JSON: |

```json
{
  "name": "Athlos",
  "short_name": "Athlos",
  "icons": [{ "src": "/apple-icon.png", "sizes": "180x180", "type": "image/png" }],
  "theme_color": "#06b6d4",
  "background_color": "#0D1421",
  "display": "standalone"
}
```

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

Generate the 180×180 PNG once using `sharp`. Install it explicitly before running the script:

```bash
pnpm add -D sharp --filter @workspace/web
```

Then run:

```js
// scripts/generate-apple-icon.mjs  (delete after use)
import sharp from "sharp"
import { readFileSync } from "fs"

const svg = readFileSync("apps/web/app/icon.svg")
await sharp(svg).resize(180, 180).png().toFile("apps/web/app/apple-icon.png")
```

```bash
node scripts/generate-apple-icon.mjs
```

Commit the PNG, remove the script, remove the `sharp` devDependency. The PNG does not need to be regenerated unless the mark SVG changes.

## Out of Scope

- **Light-background mark variant:** All current usage sites (`app-nav.tsx`, `onboarding-flow.tsx`) render on dark backgrounds — the cyan-fill SVG works as-is. No light-variant file is needed. If a future usage site requires the mark on a light surface, a separate ticket will define the implementation pattern at that time.
- OG image (`og-image.png`) — separate ticket
- Favicon for Safari pinned tabs (`safari-pinned-tab.svg`) — not needed
- Any additional PWA icon sizes beyond `apple-icon.png`
