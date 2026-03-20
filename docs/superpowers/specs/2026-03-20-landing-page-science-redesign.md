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

Keep the 5 inputs with the same labels and titles. **Replace** each card body entirely with the shortened version below — do not append or modify. The goal is to remove elaboration on training science (which now belongs in the Science section) and keep only what the input controls.

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

The fifth card (Weeks to race) spans the full 2-column width on desktop and is single-column on mobile. This is the Tailwind equivalent of the existing `gridColumn: "1 / -1"` inline style:

```
className="md:col-span-2"
```

Remove the outer inline `display: "grid"` / `gap: 24` styles from the container — replaced by Tailwind. Also update the fifth card's body text to the shortened version from the table above (replace the existing longer text entirely).

The section heading, subtitle, and card styles are otherwise unchanged.

### Componentization

Extract the entire "How your plan is built" section (heading + subtitle + cards grid) into a named function `PlanInputsSection` within `landing-page.tsx`. Replace the inline JSX in `PageContent` with `<PlanInputsSection />`. Consistent with the existing `FounderSection` pattern.

---

## Change 3: "The Science" — new section

### Placement

Immediately after `<PlanInputsSection />` in `PageContent`, before `<FounderSection />`.

### Visual style

Matches the surrounding sections: `padding: "0 24px 96px"`, `maxWidth: 1100`, `margin: "0 auto"`. Section heading uses the same style as "How your plan is built" — `fontSize: "clamp(22px, 3.5vw, 36px)"`, `fontWeight: 700`, `color: "#fff"`, `letterSpacing: "-0.03em"`.

Three blocks laid out in a single column, no max-width constraint beyond the section's `maxWidth: 1100` — blocks stretch to full container width. Each block:
- **Block header:** `fontSize: 16`, `fontWeight: 700`, `color: "rgba(255,255,255,0.88)"`
- **Lead sentence:** `fontSize: 14`, `color: "rgba(255,255,255,0.55)"`, `marginTop: 6`
- **Detail paragraph:** `fontSize: 13`, `color: "rgba(255,255,255,0.38)"`, `lineHeight: 1.6`, `marginTop: 8`
- Separation between blocks: `borderTop: "1px solid rgba(255,255,255,0.07)"`, `paddingTop: 28`, `marginTop: 28` (applied on blocks 2 and 3 only)
- First block has no top border, no top padding, no top margin
- No bottom margin on any block — spacing is top-only via the separator above

### Block 1 — Built on Pfitzinger, improved

**Header:** Built on Pfitzinger, improved

**Lead:** Pfitz is the gold standard for volume progression and phase structure. We keep what works and fix what doesn't.

**Detail:** What we keep: the 10% progression rule, long run targets, recovery week cadence, and the Base → Build → Peak → Taper arc. What we change: intensity distribution is polarized (80% easy / 20% hard) to eliminate the gray-zone fatigue that Pfitz's medium-long runs create. Phase order is reversed — threshold work comes before VO2max in early phases, then marathon-pace dominates the final 6–8 weeks. And marathon-pace volume is dramatically higher than Pfitz prescribes (~14 miles over 12 weeks). Modern coaching prescribes 5–10× that.

### Block 2 — Training phases

**Header:** Training phases

**Lead:** Four phases, each with a distinct purpose. The taper is always 3 weeks — everything else scales to your timeline.

**Detail:** Four phase rows rendered as a vertical list inside the block. Each row is a flex container:

```
Container: className="mt-4 space-y-3"
Each row:  className="flex items-start gap-3"
Label:     className="shrink-0 rounded px-2 py-0.5 text-xs font-semibold"
           with phase-specific background color (see below)
Focus:     className="text-sm leading-relaxed" color: rgba(255,255,255,0.55)
```

Phase label colors (inline style `background` + `color`):
- Base: `background: rgba(80,120,255,0.15)`, `color: rgba(100,150,255,0.9)`
- Build: `background: rgba(120,80,255,0.15)`, `color: rgba(160,120,255,0.9)`
- Peak: `background: rgba(255,120,50,0.15)`, `color: rgba(255,150,80,0.9)`
- Taper: `background: rgba(80,200,120,0.15)`, `color: rgba(100,220,140,0.9)`

Phase focus text:
| Phase | Focus |
|-------|-------|
| Base | Aerobic foundation. Tempo runs introduce lactate threshold work. Easy volume builds the engine. |
| Build | Early: tempo + VO2max intervals raise your ceiling. Late Build shifts toward marathon pace. |
| Peak | Marathon-pace dominant. The final 6–8 weeks are the most race-specific of the entire plan. |
| Taper | 3 weeks. One light tempo session in Week 1. Full easy running from Week 2 through race day. |

### Block 3 — Strength training

**Header:** Strength training is performance, not maintenance

**Lead:** A 2024 meta-analysis of 31 studies and 652 runners puts heavy resistance training on the same performance tier as lactate threshold work.

**Detail:** Heavy resistance (≥80% 1RM) combined with plyometrics improves neuromuscular efficiency, tendon stiffness, and running economy. The effect size is meaningful (ES = −0.426). We schedule strength on easy run days, after the run, never adjacent to quality sessions or the long run. Volume tapers with the plan: 2×/week resistance in Base and Build, 1×/week in Peak, and zero from Taper Week 2 through race day.

### Componentization

Extract to a named function `ScienceSection` within `landing-page.tsx`. Replace the inline JSX in `PageContent` with `<ScienceSection />`.

---

## Files changed

| File | Change |
|------|--------|
| `apps/web/app/landing-page.tsx` | Remove Why Athlos section; replace How Your Plan Is Built inline JSX with `<PlanInputsSection />`; add `<ScienceSection />` after it; add `PlanInputsSection` and `ScienceSection` functions at the bottom of the file |
