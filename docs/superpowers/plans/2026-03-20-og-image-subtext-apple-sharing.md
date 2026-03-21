# OG Image Subtext & Apple Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a tagline to the OG image, update the site description, and fix iMessage link previews to show the full large card.

**Architecture:** Two files change. `layout.tsx` gets an updated description string and a `twitter.card` metadata field. `opengraph-image.tsx` gets the wordmark wrapped in a flex column with the tagline below it, and the divider height increased to match the new text block height. No runtime logic changes — all static/generated output.

**Tech Stack:** Next.js App Router metadata API, Satori (`next/og` ImageResponse) — note: Satori requires all styles as inline `style` objects, not Tailwind class strings.

---

## File Map

| File | Change |
|------|--------|
| `apps/web/app/layout.tsx` | Update description; add twitter card metadata |
| `apps/web/app/opengraph-image.tsx` | Wrap wordmark in column, add tagline, adjust divider height |

---

### Task 1: Update site metadata in layout.tsx

**Files:**
- Modify: `apps/web/app/layout.tsx`

No automated tests exist or are needed for metadata strings — verify by inspecting the rendered `<head>` in the browser.

- [ ] **Step 1: Update the `metadata` export**

In `apps/web/app/layout.tsx`, replace the current `metadata` export (lines 11–14):

```ts
export const metadata: Metadata = {
  title: "Athlos",
  description: "Adaptive marathon training for runners with a real goal time.",
}
```

With:

```ts
export const metadata: Metadata = {
  title: "Athlos",
  description: "Data driven marathon training.",
  twitter: {
    card: "summary_large_image",
  },
}
```

- [ ] **Step 2: Verify in browser**

Run `pnpm dev`, open `http://localhost:3000`, inspect `<head>`. Confirm:
- `<meta name="description" content="Data driven marathon training.">`
- `<meta name="twitter:card" content="summary_large_image">`

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/layout.tsx
git commit -m "feat: update site description and add twitter large card metadata"
```

---

### Task 2: Add tagline to OG image

**Files:**
- Modify: `apps/web/app/opengraph-image.tsx`

> **Satori note:** `next/og` uses Satori for rendering. All layout must use explicit inline `style` objects — no Tailwind classes. Every flex container needs `display: "flex"` set explicitly.

- [ ] **Step 1: Update the divider height**

The divider currently sits between the 3-block mark and the wordmark. The new text block (112px wordmark + 8px gap + 28px tagline = 148px) is taller than the current divider height of 110. Update the divider div's style:

Find (around line 86–92):
```tsx
{/* Divider */}
<div
  style={{
    width: 1,
    height: 110,
    background: "rgba(6, 182, 212, 0.3)",
  }}
/>
```

Change `height: 110` to `height: 148`.

- [ ] **Step 2: Wrap wordmark in a column and add tagline**

Find the wordmark `<span>` (around lines 95–105):

```tsx
{/* Wordmark */}
<span
  style={{
    fontSize: 112,
    fontWeight: 700,
    color: "#ffffff",
    letterSpacing: "-4px",
    lineHeight: 1,
  }}
>
  Athlos
</span>
```

Replace it with:

```tsx
{/* Wordmark + tagline */}
<div
  style={{
    display: "flex",
    flexDirection: "column",
    gap: 8,
  }}
>
  <span
    style={{
      fontSize: 112,
      fontWeight: 700,
      color: "#ffffff",
      letterSpacing: "-4px",
      lineHeight: 1,
    }}
  >
    Athlos
  </span>
  <span
    style={{
      fontSize: 28,
      fontWeight: 400,
      color: "rgba(255, 255, 255, 0.5)",
      lineHeight: 1,
    }}
  >
    Data driven marathon training.
  </span>
</div>
```

- [ ] **Step 3: Verify OG image renders correctly**

Run `pnpm dev` and open `http://localhost:3000/opengraph-image` in the browser. Confirm:
- "Athlos" wordmark appears at the top
- "Data driven marathon training." appears below in smaller, muted text
- The divider line aligns roughly with the height of the combined text block
- Layout is horizontally centered, nothing is clipped

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/opengraph-image.tsx
git commit -m "feat: add tagline to OG image"
```

---

### Task 3: Push to develop and main

- [ ] **Step 1: Push develop**

```bash
git push origin develop
```

- [ ] **Step 2: Merge to main and push**

```bash
git checkout main && git merge develop && git push origin main && git checkout develop
```
