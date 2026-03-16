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

Rendered as two lines — the first line is the authority claim, the second is the personalisation hook.

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

Same position (below search widget), same style as the removed friction copy (`fontSize: 12`, `color: rgba(255,255,255,0.22)`, `letterSpacing: "0.02em"`). This restores a credibility anchor without making misleading pricing promises.

### Middle section — "Why Athlos" (replaces "How it works")

Section heading changes from `How it works` to `Why Athlos`.

Three cards replace the current three steps:

| # | Title | Body |
|---|---|---|
| 1 | Pfitzinger methodology | Not generic intervals. Structured phases: base, build, peak, taper — built around your race date and goal time. |
| 2 | Strength training included | Lift days scheduled around your key runs, not as an afterthought. |
| 3 | Adaptive by default | Log how a session felt. If you're accumulating fatigue, the plan adjusts — before it becomes an injury. |

Icons are replaced: remove emojis, use text-only cards (no icon field). The card layout and styling are unchanged.

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
