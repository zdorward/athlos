# Landing Page Science Redesign

**Date:** 2026-03-20
**Status:** Approved

## Overview

Two changes to `apps/web/app/landing-page.tsx`:

1. Remove the "Why Athlos" section entirely
2. Tighten the "How your plan is built" section (shorter card text, responsive grid, componentized)
3. Add a new "The Science" section below it (3 scannable blocks)

---

## Section Map (after changes)

| Order | Section | Change |
|-------|---------|--------|
| 1 | Hero (race search) | Unchanged |
| 2 | PlanPreview | Unchanged |
| 3 | ~~Why Athlos~~ | **Removed** |
| 4 | How your plan is built | **Redesigned** |
| 5 | The Science | **New** |
| 6 | Founder section | Unchanged |
| 7 | Bottom CTA | Unchanged |

---

## Change 1: Remove "Why Athlos"

Delete the entire "Why Athlos" `<section>` block (~70 lines). No other sections move or change.

---

## Change 2: "How your plan is built" — tightened and responsive

### Card content

Keep the 5 inputs with the same labels and titles. Shorten each body to 1–2 sentences focused only on what the input controls — no elaboration. The science explanation belongs in the new section.

Suggested shortened bodies:

| Input | Shortened body |
|-------|---------------|
| Goal time | Sets your training intensity and marathon-pace volume. Faster goals mean more threshold work and higher mileage. |
| Current weekly mileage | Determines your starting point and how aggressively the plan can build. |
| Running days | Sets how many sessions per week and which types fit in. |
| Strength days | Tell us which days you lift. The plan is built around your full training week. |
| Weeks to race | Determines how long each phase runs and how much time is available to build before the taper. |

### Layout

Replace the hardcoded `gridTemplateColumns: "1fr 1fr"` inline style with Tailwind classes on the grid container:

```
className="grid grid-cols-1 md:grid-cols-2 gap-6"
```

The fifth card (Weeks to race) spans full width on desktop:

```
className="md:col-span-2"
```

Remove the outer inline `display: "grid"` / `gap: 24` styles from the container — replaced by Tailwind.

The section heading, subtitle, and card styles are otherwise unchanged.

### Componentization

Extract the entire "How your plan is built" section (heading + subtitle + cards grid) into a named function `PlanInputsSection` within `landing-page.tsx`. Replace the inline JSX in `PageContent` with `<PlanInputsSection />`. Consistent with the existing `FounderSection` pattern.

---

## Change 3: "The Science" — new section

### Placement

Immediately after `<PlanInputsSection />` in `PageContent`, before `<FounderSection />`.

### Visual style

Matches the surrounding sections: `padding: "0 24px 96px"`, `maxWidth: 1100`, `margin: "0 auto"`. Section heading uses the same style as "How your plan is built."

Three blocks laid out in a single column. Each block:
- Bold header (slightly larger than body, white)
- 1-sentence lead (muted white, slightly larger)
- Tight paragraph of detail (muted white, smaller)
- Thin top border separating blocks (except the first)

### Block 1 — Built on Pfitzinger, improved

**Header:** Built on Pfitzinger, improved

**Lead:** Pfitz is the gold standard for volume progression and phase structure. We keep what works and fix what doesn't.

**Detail:** What we keep: the 10% progression rule, long run targets, recovery week cadence, and the Base → Build → Peak → Taper arc. What we change: intensity distribution is polarized (80% easy / 20% hard) to eliminate the gray-zone fatigue that Pfitz's medium-long runs create. Phase order is reversed — threshold work comes before VO2max in early phases, then marathon-pace dominates the final 6–8 weeks. And marathon-pace volume is dramatically higher than Pfitz prescribes (~14 miles over 12 weeks). Modern coaching prescribes 5–10× that.

### Block 2 — Training phases

**Header:** Training phases

**Lead:** Four phases, each with a distinct purpose. The taper is always 3 weeks — everything else scales to your timeline.

**Detail:** Displayed as a compact 4-item visual list (not a grid — a labeled column):

| Phase | Focus |
|-------|-------|
| Base | Aerobic foundation. Tempo runs introduce lactate threshold work. Easy volume builds the engine. |
| Build | Early: tempo + VO2max intervals raise your ceiling. Late Build shifts toward marathon pace. |
| Peak | Marathon-pace dominant. The final 6–8 weeks are the most race-specific of the entire plan. |
| Taper | 3 weeks. One light tempo session in Week 1. Full easy running from Week 2 through race day. |

Rendered as a bordered list inside the block — each row has the phase name in a colored label and the focus text beside it.

### Block 3 — Strength training

**Header:** Strength training is performance, not maintenance

**Lead:** A 2024 meta-analysis of 31 studies and 652 runners puts heavy resistance training on the same performance tier as lactate threshold work.

**Detail:** Heavy resistance (≥80% 1RM) and plyometrics improve neuromuscular efficiency, tendon stiffness, and running economy. The effect size is meaningful (ES = −0.426). We schedule strength on easy run days, after the run, never adjacent to quality sessions or the long run. Volume tapers with the plan: 2×/week resistance in Base and Build, 1×/week in Peak, and zero from Taper Week 2 through race day.

### Componentization

Extract to a named function `ScienceSection` within `landing-page.tsx`. Replace the inline JSX in `PageContent` with `<ScienceSection />`.

---

## Files changed

| File | Change |
|------|--------|
| `apps/web/app/landing-page.tsx` | Remove Why Athlos section; replace How Your Plan Is Built inline JSX with `<PlanInputsSection />`; add `<ScienceSection />` after it; add `PlanInputsSection` and `ScienceSection` functions at the bottom of the file |
