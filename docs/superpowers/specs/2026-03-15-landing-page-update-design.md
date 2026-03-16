# Landing Page Update — Design Spec

## Overview

Update the landing page to fix three issues:
1. The plan preview mock doesn't match the real app's visual style
2. The feature highlights section sounds generic and AI-generated
3. The social proof section is a placeholder with no real content

## Sections

### 1. Hero — No changes

The hero section (aurora background, race search widget, tagline "Adaptive race training for runners who lift.") is kept as-is.

### 2. Plan Preview — Updated to match real app

The browser chrome mockup stays, but the inner UI is updated to match the real `PlanCalendar` component:

- **Background**: `#0d1117` (navy, not near-black `#020208`)
- **Week label column**: left column showing week number (W1), start date (Mar 16), and weekly km (54km)
- **Day-of-week header row**: MON–SUN, uppercase, subdued
- **Phase header**: A labeled divider row showing the current phase (e.g. "Base"), matching the real app's `getPhaseLabel()` output
- **Cell contents**: date number (top-left), workout name, distance — no colored cell backgrounds except Long Run (blue tint)
- **Color palette** (text only, matching `workout-utils.ts`):
  - Easy Run: `rgba(255,255,255,0.55)` (white/muted)
  - Long Run: `rgba(147,197,253,0.85)` (blue)
  - Strength: `oklch(0.65 0.15 300 / 0.85)` (purple)
  - Tempo Run: `oklch(0.78 0.15 80 / 0.9)` (amber)
- **Rest days**: faded empty cells (`opacity: 0.4`)
- **Fade-out hint**: gradient at bottom with "16 weeks total" label
- **Mock data**: 2 weeks shown (Week 1 base, Week 2 with tempo introduced), realistic dates starting Mar 16

The section heading and subheading ("Every week, mapped out." / "Runs and lifts scheduled together…") are unchanged.

### 3. How It Works — Replaces feature blocks

Remove the three feature highlight cards ("Strength integrated, not bolted on", "Built for your actual schedule", "From 5K to ultra").

Replace with a **"How it works"** section showing 3 steps in the same card grid layout:

| Step | Title | Body |
|------|-------|------|
| 1 | Find your race | Search from hundreds of races, or add your own. |
| 2 | Tell us about yourself | Your goal time, weekly mileage, lifting days, and schedule. |
| 3 | Get your plan | A personalized week-by-week plan built for runners who also lift. |

Section heading: **"How it works"**

Each step uses an emoji icon (🔍 ⚙️ 📋), title, and 1–2 sentence description. Same card styling as existing feature blocks (padding: 28px, border-radius: 14px, border: 1px solid rgba(255,255,255,0.07), background: rgba(255,255,255,0.02)).

### 4. Founder Note — Replaces social proof placeholder

Remove the dashed placeholder box with fake testimonials.

Replace with a centered quote block:

> "I was training for the Victoria Marathon and chasing a PR. I didn't want to pay for Runna, so I was duct-taping ChatGPT and Google Sheets together. It worked, sort of — but I also lift, and no plan I found took both seriously. So I built one."
>
> — Zack, builder & runner

Styling: centered, max-width ~520px, italic quote text, subdued attribution. Same card border/background as other sections.

No section heading needed — the quote stands alone.

### 5. Bottom CTA — No changes

"Ready to build your plan?" section kept as-is.

## What's Not Changing

- Hero section (search widget, tagline, aurora background)
- Bottom CTA section
- Nav (wordmark + log in button)
- Overall page structure and scroll behavior
- MOCK_WEEKS data shape (just updating style/content)

## Implementation Notes

- All changes are in `apps/web/app/page.tsx`
- The `MOCK_WEEKS` data structure shape is unchanged, but the values (dates, labels) will be updated to use realistic dates (e.g. starting Mar 16) and a phase label will be added alongside each week
- The `TYPE_STYLES` record in `page.tsx` should be replaced with color values taken directly from `apps/web/app/plan/workout-utils.ts` (`getWorkoutColor`, `WORKOUT_TEXT_CLASS`) to stay in sync with the real app
- The phase label used in the mock should match what `getPhaseLabel()` in `apps/web/app/plan/workout-utils.ts` would produce (e.g. "Base" for early weeks)
