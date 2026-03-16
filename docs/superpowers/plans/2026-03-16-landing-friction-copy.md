# Landing Friction Copy Removal Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the misleading friction copy line from the landing page hero.

**Architecture:** Single `<p>` element deletion in `apps/web/app/page.tsx`. No logic changes, no new files, no dependencies.

**Tech Stack:** Next.js 16, React 19, TypeScript.

---

## Chunk 1: Remove friction copy

### Task 1: Delete the friction copy element

**Files:**
- Modify: `apps/web/app/page.tsx:539-548`

**Spec:** `docs/superpowers/specs/2026-03-16-landing-friction-copy-design.md`

The element to remove is the `<p>` below the search widget in the hero section. It reads `Free · No account needed · Ready in 2 minutes`.

- [ ] **Step 1: Delete the element**

Remove this block from `apps/web/app/page.tsx` (lines 539–548):

```tsx
{/* Friction copy */}
<p
  style={{
    fontSize: 12,
    margin: 0,
    color: "rgba(255,255,255,0.22)",
    letterSpacing: "0.02em",
  }}
>
  Free &middot; No account needed &middot; Ready in 2 minutes
</p>
```

Nothing replaces it. The search widget sits directly above the scroll hint after this deletion.

- [ ] **Step 2: Verify locally**

Run `pnpm dev` and open the landing page. Confirm the friction copy line is gone and the hero layout looks correct — no empty gap, scroll hint still visible.

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/page.tsx
git commit -m "chore: remove misleading friction copy from landing hero"
```
