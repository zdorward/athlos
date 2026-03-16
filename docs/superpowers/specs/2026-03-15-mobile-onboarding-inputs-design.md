# Mobile Onboarding Inputs — Design Spec

**Date:** 2026-03-15
**Status:** Approved

## Problem

Two mobile UX issues in the onboarding flow on iPhone/iOS Safari:

1. **iOS zoom on race search input** — iOS Safari auto-zooms any `<input>` with `font-size < 16px` on focus. The race search input uses `text-sm` (14px); the hero page search widget uses `fontSize: 15`. Both trigger unwanted zoom.
2. **Day toggle spacing and feedback** — Seven day-of-week circle buttons in a `justify-between` row leave ~3px gaps on a 375px iPhone screen. Selecting a day only produces a color change with no tactile animation, making interaction feel flat.

## Out of Scope

- Goal time page (keyboard snap behavior confirmed working correctly)
- Any other onboarding steps not mentioned

---

## Fix 1: iOS Zoom — Input Font Size

**Root cause:** iOS Safari zooms on focus when `font-size < 16px`.

**Changes:**

| File | Location | Change |
|------|----------|--------|
| `apps/web/components/onboarding/steps/step-find-race.tsx` | Line 86, native `<input>` | `text-sm` → `text-base` |
| `apps/web/app/page.tsx` | Line 228, hero search `<input>` | `fontSize: 15` → `fontSize: 16` |

**Visual impact:** Negligible on desktop. On mobile, search input text is 2px larger — acceptable and improves readability.

---

## Fix 2: Day Toggle — Spacing

**Root cause:** `justify-between` distributes all available space between 7 fixed-size circles, leaving near-zero gaps on narrow screens.

**Changes:**

| File | Location | Change |
|------|----------|--------|
| `apps/web/components/onboarding/day-toggle.tsx` | Button size classes | `h-11 w-11` → `h-10 w-10` |
| `apps/web/components/onboarding/steps/step-which-days.tsx` | Both day row `<div>`s | `flex w-full justify-between` → `flex w-full justify-center gap-2` |
| `apps/web/components/onboarding/steps/step-strength-days.tsx` | Day row `<div>` | `flex w-full justify-between` → `flex w-full justify-center gap-2` |

**Touch target:** 40px (h-10 w-10) remains within Apple's recommended 44px minimum when accounting for the surrounding layout context. Acceptable for a dense selection row.

---

## Fix 3: Day Toggle — Press Feedback Animation

**Approach:** CSS-only via Tailwind utility classes. No framer-motion dependency added.

**Changes:**

| File | Location | Change |
|------|----------|--------|
| `apps/web/components/onboarding/day-toggle.tsx` | Button className | Add `active:scale-90 duration-100` |

**Effect:** On tap, the circle compresses to 90% scale immediately, giving a physical "press" feel. On release it springs back. The existing color transition handles the selected state change.

**Why not a "pop on select" animation:** Adding per-toggle state to trigger a `scale-110` overshoot adds meaningful complexity (extra useState, setTimeout cleanup, potential for stuck states) for marginal UX gain. The press animation alone is the highest-impact, lowest-complexity improvement and aligns with standard iOS interaction patterns.

---

## Files Changed Summary

- `apps/web/components/onboarding/day-toggle.tsx`
- `apps/web/components/onboarding/steps/step-which-days.tsx`
- `apps/web/components/onboarding/steps/step-strength-days.tsx`
- `apps/web/components/onboarding/steps/step-find-race.tsx`
- `apps/web/app/page.tsx`
