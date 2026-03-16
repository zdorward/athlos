# Brand Mark Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all existing logos, marks, and favicons with a new 2×2 grid abstract mark in dark + cyan, using the minimum files Next.js needs.

**Architecture:** Write `app/icon.svg` (Next.js auto-discovers this as the site favicon), generate `app/apple-icon.png` from it using `sharp`, update `site.webmanifest` with correct name and icon reference, and delete all 9 legacy image files. No code changes beyond asset files.

**Tech Stack:** Next.js 16 App Router (file-based icon discovery), `sharp` (PNG generation), pnpm monorepo

---

## Chunk 1: Write mark, delete legacy assets, update manifest, generate PNG

**Spec:** `docs/superpowers/specs/2026-03-15-brand-mark-design.md`

**Files:**
- Create: `apps/web/app/icon.svg`
- Generate + commit: `apps/web/app/apple-icon.png`
- Modify: `apps/web/public/site.webmanifest`
- Delete: `apps/web/app/favicon.ico`
- Delete: `apps/web/public/favicon-16x16.png`
- Delete: `apps/web/public/favicon-32x32.png`
- Delete: `apps/web/public/android-chrome-192x192.png`
- Delete: `apps/web/public/android-chrome-512x512.png`
- Delete: `apps/web/public/logo-light.svg`
- Delete: `apps/web/public/logo-dark.svg`
- Delete: `apps/web/public/mark-light.svg`
- Delete: `apps/web/public/mark-dark.svg`

---

- [ ] **Step 1: Write `apps/web/app/icon.svg`**

Create the file with this exact content:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72" fill="none">
  <rect x="6"  y="6"  width="28" height="28" rx="5" fill="#06b6d4" opacity="0.35"/>
  <rect x="38" y="6"  width="28" height="28" rx="5" fill="#06b6d4" opacity="1"/>
  <rect x="6"  y="38" width="28" height="28" rx="5" fill="#06b6d4" opacity="0.8"/>
  <rect x="38" y="38" width="28" height="28" rx="5" fill="#06b6d4" opacity="0.55"/>
</svg>
```

- [ ] **Step 2: Delete legacy image files**

```bash
rm apps/web/app/favicon.ico
rm apps/web/public/favicon-16x16.png
rm apps/web/public/favicon-32x32.png
rm apps/web/public/android-chrome-192x192.png
rm apps/web/public/android-chrome-512x512.png
rm apps/web/public/logo-light.svg
rm apps/web/public/logo-dark.svg
rm apps/web/public/mark-light.svg
rm apps/web/public/mark-dark.svg
```

Expected: all 9 files gone, no errors.

- [ ] **Step 3: Update `apps/web/public/site.webmanifest`**

Replace the entire file contents with:

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

- [ ] **Step 4: Install `sharp` as a temporary dev dependency**

```bash
pnpm add -D sharp --filter @workspace/web
```

Expected: `sharp` appears in `apps/web/package.json` devDependencies.

- [ ] **Step 5: Write the PNG generation script**

Create `scripts/generate-apple-icon.mjs` at the repo root:

```js
import sharp from "sharp"
import { readFileSync } from "fs"

const svg = readFileSync("apps/web/app/icon.svg")
await sharp(svg).resize(180, 180).png().toFile("apps/web/app/apple-icon.png")
console.log("Generated apps/web/app/apple-icon.png")
```

- [ ] **Step 6: Run the script to generate `apple-icon.png`**

```bash
node scripts/generate-apple-icon.mjs
```

Expected output:
```
Generated apps/web/app/apple-icon.png
```

Verify the file exists:
```bash
ls -lh apps/web/app/apple-icon.png
```

Expected: file present, ~5–20 KB.

- [ ] **Step 7: Clean up — remove script and `sharp` devDependency**

```bash
rm scripts/generate-apple-icon.mjs
pnpm remove sharp --filter @workspace/web
```

Expected: script gone, `sharp` no longer in `apps/web/package.json`.

- [ ] **Step 8: Verify typecheck still passes**

```bash
pnpm typecheck
```

Expected: no errors (no TypeScript files were changed, this is a sanity check).

- [ ] **Step 9: Verify the dev server shows the new favicon**

```bash
pnpm dev
```

Open `http://localhost:3000` in a browser. Check the browser tab — it should show the 2×2 cyan grid mark, not the old "A" favicon.

If the old favicon appears: hard-refresh with Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows) to clear the browser favicon cache.

- [ ] **Step 10: Commit**

```bash
git add apps/web/app/icon.svg apps/web/app/apple-icon.png apps/web/public/site.webmanifest pnpm-lock.yaml
git add -u  # stage the deletions
git commit -m "feat: replace brand assets with new 2x2 grid mark"
```
