# Landing Page Redesign — Design Spec

**Date:** 2026-03-16
**Status:** Approved

---

## Overview

Rewrite the landing page copy to establish authority with the BQ-targeting, Pfitzinger-familiar audience. The current copy ("When's your next race?" / "Adaptive marathon training for runners with a real goal") is generic. The new copy leads with methodology, names Pfitzinger explicitly, and calls out the two differentiators Runna and static plans don't have: strength training integration and adaptivity.

No layout changes. No new sections. Copy and section framing only.

---

## Changes

### Hero section

**Headline** (currently `When's your next race?`):
```
Pfitzinger-based marathon training.
Built around your goal time.
```

Rendered as two lines using a `<br />` between the two phrases to enforce the split at all viewport widths: `Pfitzinger-based marathon training.<br />Built around your goal time.`

**Subheading** (currently `Adaptive marathon training for runners with a real goal.`):
```
Strength training built in from day one.
Adapts when your body says it needs to.
```

Two short lines, muted colour, same style as current subheading.

**Trust bar** (replaces the removed friction copy line):
```
Adaptive · Hybrid-athlete ready · Built for BQ
```

Insert as a new `<p>` added as a direct child of the hero flex column, immediately after the closing `</div>` of the `ref={wrapRef}` search widget div and before the closing `</div>` of the hero content flex container. Same style as the removed friction copy: `fontSize: 12`, `margin: 0`, `color: rgba(255,255,255,0.22)`, `letterSpacing: "0.02em"`.

### Middle section — "Why Athlos" (replaces "How it works")

Section heading changes from `How it works` to `Why Athlos`.

Three cards replace the current three steps:

| # | Title | Body |
|---|---|---|
| 1 | Pfitzinger methodology | Not generic intervals. Structured phases: base, build, peak, taper — built around your race date and goal time. |
| 2 | Strength training included | Lift days scheduled around your key runs, not as an afterthought. |
| 3 | Adaptive by default | Log how a session felt. If you're accumulating fatigue, the plan adjusts — before it becomes an injury. |

Icons are replaced: remove the `icon` property from each card data object AND remove the `<div style={{ fontSize: 28, marginBottom: 12 }}>` render block that outputs `{f.icon}`. The remaining card layout and styling are unchanged. Also update the `{/* ── How it works ──` comment to read `{/* ── Why Athlos ──`.

### Bottom CTA section

**Headline** (currently `Ready to build your plan?`):
```
Build your plan.
```

**Body** (currently `Pick your race above and you'll have a full plan in under 2 minutes.`):
```
Pick your race. Set your goal time. We'll handle the rest.
```

Button label (`Find my race`) and scroll behaviour: unchanged.

---

## Files

- Modify: `apps/web/app/page.tsx`

---

## Out of Scope

- Layout changes
- New sections
- Plan preview mock data
- Navigation or auth changes
