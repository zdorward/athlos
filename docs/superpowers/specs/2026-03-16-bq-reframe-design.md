# BQ Reframe: Copy & Positioning Update

_Date: 2026-03-16_

## Overview

Reframe Athlos from "adaptive training for hybrid athletes (runners who lift)" to "adaptive marathon training for serious runners with a real goal time." The BQ crowd is the target audience; the positioning speaks to the identity they self-apply — serious marathoner with a goal — rather than requiring them to identify as a "hybrid athlete." Strength training remains as a silent scheduling feature, not a differentiator.

## Approach

**Serious marathoner — BQ as implied benchmark.** Lead with goal-time framing. The BQ is cultural shorthand, not the literal product promise. This speaks directly to BQ chasers while keeping the door open to anyone running a marathon with a real target time.

## Scope

Copy and positioning only. No functional or data changes. ~8 line changes across 4 existing files, plus CLAUDE.md update and new root README.md.

## Changes

### `apps/web/app/page.tsx` — Landing page

| Element | Current | New |
|---|---|---|
| Tagline | "Adaptive race training for runners who lift." | "Adaptive marathon training for runners with a real goal." |
| How it works step 3 description | "A personalized week-by-week run + lift plan." | "A personalized week-by-week plan built around your goal time." |
| Founder note | Full block present | Removed entirely |

### `apps/web/app/layout.tsx` — Metadata

| Element | Current | New |
|---|---|---|
| Meta description | "Adaptive training system for hybrid athletes" | "Adaptive marathon training for runners with a real goal time." |

### `components/onboarding/step-strength-training.tsx` — Onboarding

| Element | Current | New |
|---|---|---|
| Subheading | "We'll schedule lifting days that don't interfere with your key runs." | "We'll work strength sessions around your key runs." |
| "Yes" option description | "We'll schedule lifting days around your runs" | "Strength sessions scheduled around your runs" |

### `components/onboarding/step-weekly-mileage.tsx` — Onboarding

| Element | Current | New |
|---|---|---|
| 40–60 km tier label | "Solid recreational runner" | "Consistent recreational runner" |
| 60–80 km tier label | "Committed club runner" | "Consistent club runner" |

### `CLAUDE.md` — Project overview

Update the Overview section to reflect the new positioning: serious marathoners chasing a goal time (BQ as the implied benchmark), with strength training as a scheduling feature rather than a core identity claim.

### `README.md` (new, root level)

Create a root-level README with: project name, one-line description using new positioning, tech stack summary, and dev setup commands.

## What Does Not Change

- Hero headline: "When's your next race?" — already race-first and strong
- All onboarding step headings — already goal/race-neutral
- Race database — no structural changes
- Dashboard, plan view, settings — no hybrid framing present
- All functional logic, routing, data models

## Success Criteria

- No instance of "hybrid athlete," "runners who lift," or "run + lift" remains in user-facing copy
- Strength training onboarding step reads as a scheduling convenience, not a differentiating identity claim
- Landing page tagline and meta description consistently reflect the serious marathoner / goal-time positioning
