# Landing Page Friction Copy — Design Spec

**Date:** 2026-03-16
**Status:** Approved

---

## Overview

Remove the friction copy line from the landing page hero. The line `Free · No account needed · Ready in 2 minutes` is misleading given the freemium business model — plan generation will eventually require an account, and "Free" implies the full product is free forever.

The target audience (BQ qualifier athletes) is goal-driven and doesn't need low-commitment reassurance to engage.

---

## Change

**Remove** the `<p>` element at line 547 of `apps/web/app/page.tsx`:

```tsx
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

No other changes. The bottom CTA copy ("Pick your race above and you'll have a full plan in under 2 minutes.") is accurate and stays.

---

## Files

- Modify: `apps/web/app/page.tsx`

---

## Out of Scope

- Any other landing page copy changes
- Bottom CTA section
