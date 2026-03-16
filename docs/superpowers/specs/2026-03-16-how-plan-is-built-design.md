# How Your Plan Is Built — Design Spec

**Date:** 2026-03-16
**Status:** Approved

---

## Overview

Add a "How your plan is built" section to the landing page, between the "Why Athlos" cards and the bottom CTA. The section addresses pre-signup skeptics (and Ainsley-style curious users) who want to understand the methodology logic before committing. It explains the five real inputs and what each one drives in the plan.

---

## Placement

Insert the new section between the existing "Why Athlos" section and the "Build your plan." bottom CTA in `apps/web/app/page.tsx`.

---

## Section Design

### Section wrapper

Match the "Why Athlos" section wrapper exactly: `padding: "0 24px 96px"`, `maxWidth: 1100`, `margin: "0 auto"`.

Wrap the heading and subheading in a shared div with `textAlign: "center"` and `marginBottom: 40` (matching the "Why Athlos" section heading wrapper).

**Section heading:** `How your plan is built`
Heading style: `fontSize: "clamp(22px, 3.5vw, 36px)"`, `fontWeight: 700`, `color: "#fff"`, `letterSpacing: "-0.03em"`, `margin: 0`.

**Subheading:** `Five inputs. One coherent plan.`
Subheading style: `fontSize: 14`, `color: "rgba(255,255,255,0.32)"`, `margin: "8px 0 0"`. Matches the bottom CTA subtext pattern. The shared wrapper's `marginBottom: 40` creates the gap to the card grid.

### Layout

2×2 grid of cards, with a fifth card spanning the full width at the bottom. Use a fixed two-column grid: `gridTemplateColumns: "1fr 1fr"`, `gap: 24`. Apply `gridColumn: "1 / -1"` to the fifth card to make it full-width. Do not use `auto-fit` here — the layout requires a specific 2×2 shape.

Same card styling as the "Why Athlos" cards: `padding: 28`, `borderRadius: 14`, `border: 1px solid rgba(255,255,255,0.07)`, `background: rgba(255,255,255,0.02)`, `textAlign: "left"` (differs from "Why Athlos" which is centered).

Each card has:
- **Label** (uppercase, `fontSize: 11`, `fontWeight: 600`, `color: rgba(100,150,255,0.7)`, `letterSpacing: 0.06em`) — the input name
- **Title** (`fontSize: 13`, `fontWeight: 600`, `color: rgba(255,255,255,0.88)`) — what it drives
- **Body** (`fontSize: 12`, `color: rgba(255,255,255,0.38)`, `lineHeight: 1.6`) — specific explanation

### Cards

| Label | Title | Body |
|---|---|---|
| Goal time | Sets your training load | Sub-3:15 means higher mileage and more intensity sessions. Sub-4:30 means more aerobic base, less threshold work. Your target pace determines what your body needs to do to get there. |
| Current weekly mileage | Sets your volume ceiling | Where you are now determines how aggressively the plan can ramp. Running 60km/week already? The plan builds on that. Starting from 30km? It gets you there safely over the base phase. |
| Running days | Determines session mix | 5 days gets you a long run, a tempo, and three easy runs. 4 days drops the least valuable session first. The long run and quality work are always protected. |
| Strength days | Kept in the picture | Tell us which days you lift. The plan is built around your full training week, running and strength included. |
| Weeks to race *(full-width)* | Defines your phase structure | 18 or more weeks gets a full base, build, peak, taper arc. Shorter windows compress the base and extend the peak. The taper stays at 3 weeks regardless. |

### Copy rules

- No em dashes
- No "not X, it's Y" framing
- Concrete examples over abstract claims (e.g. "Sub-3:15 means..." not "your goal time shapes your plan")

---

## Files

- Modify: `apps/web/app/page.tsx`

---

## Out of Scope

- Post-generation methodology breakdown (separate feature, separate spec)
- Changes to any other landing page sections
- Mobile-specific layout changes (the fixed `1fr 1fr` grid will stack to single-column naturally at narrow viewports)
