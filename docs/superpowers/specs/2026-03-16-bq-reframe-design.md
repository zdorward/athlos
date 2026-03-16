# BQ Reframe: Copy & Positioning Update

_Date: 2026-03-16_

## Overview

Reframe Athlos from "adaptive training for hybrid athletes (runners who lift)" to "adaptive marathon training for serious runners with a real goal time." The BQ crowd is the target audience; the positioning speaks to the identity they self-apply — serious marathoner with a goal — rather than requiring them to identify as a "hybrid athlete." Strength training remains as a silent scheduling feature, not a differentiator.

## Approach

**Serious marathoner — BQ as implied benchmark.** Lead with goal-time framing. The BQ is cultural shorthand, not the literal product promise. This speaks directly to BQ chasers while keeping the door open to anyone running a marathon with a real target time.

## Scope

Copy and positioning only. No functional or data changes. ~10 line changes across 5 existing files, plus CLAUDE.md update, new root README.md, and PWA manifest update.

## Changes

### `apps/web/app/page.tsx` — Landing page

| Element | Current | New |
|---|---|---|
| Tagline | "Adaptive race training for runners who lift." | "Adaptive marathon training for runners with a real goal." |
| How it works step 3 description | "A personalized week-by-week run + lift plan." | "A personalized week-by-week plan built around your goal time." |
| Plan preview subtitle | "Runs and lifts scheduled together — strength days placed where they won't wreck your key sessions." | "Runs and strength sessions scheduled together — each placed where they won't wreck your key workouts." |
| Founder note | Full block present | Removed entirely |

### `apps/web/app/layout.tsx` — Metadata

| Element | Current | New |
|---|---|---|
| Meta description | "Adaptive training system for hybrid athletes" | "Adaptive marathon training for runners with a real goal time." |

### `apps/web/public/site.webmanifest` — PWA manifest

| Element | Current | New |
|---|---|---|
| description | "Adaptive training system for hybrid athletes" | "Adaptive marathon training for runners with a real goal time." |

### `apps/web/components/onboarding/steps/step-strength-training.tsx` — Onboarding

| Element | Current | New |
|---|---|---|
| Subheading | "We'll schedule lifting days that don't interfere with your key runs." | "We'll work strength sessions around your key runs." |
| "Yes" option description | "We'll schedule lifting days around your runs" | "Strength sessions scheduled around your runs" |

### `apps/web/components/onboarding/steps/step-weekly-mileage.tsx` — Onboarding

Both `KM_OPTIONS` and `MILES_OPTIONS` arrays must be updated:

| Element | Current | New |
|---|---|---|
| 40–60 km / 25–37 mi tier label | "Solid recreational runner" | "Consistent recreational runner" |
| 60–80 km / 37–50 mi tier label | "Committed club runner" | "Consistent club runner" |

### `CLAUDE.md` — Project overview

Replace the current Overview section with:

> Athlos is an adaptive marathon training platform for serious runners with a real goal time. The core differentiator is intelligent plan adaptation based on athlete performance, recovery, and goals — not just static plan generation. Target audience: runners chasing a qualifying time (BQ as the implied benchmark). Strength training is supported as a scheduling feature. Currently building out the web app with plans to implement mobile later. Business model is subscription + time-limited trial (not freemium).

### `README.md` (root level — update existing file)

The file `/Users/zackdorward/dev/athlos/README.md` already exists. Replace the first paragraph (which currently reads "An adaptive training system for hybrid athletes…") with the new positioning. Preserve the existing "Adding Components" and "Using Components" sections unchanged.

Updated content:

- **Project name:** Athlos
- **One-liner:** "Adaptive marathon training for runners with a real goal time."
- **Description:** Brief paragraph — adaptive plan generation that adjusts based on performance and recovery; covers running and optional strength training scheduling.
- **Tech stack:** pnpm monorepo, Next.js 16 (App Router), React 19, Tailwind CSS v4, shadcn/ui, Neon (Postgres)
- **Dev setup:** mirror the commands already in CLAUDE.md (`pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm typecheck`)

## What Does Not Change

- Hero headline: "When's your next race?" — already race-first and strong
- All onboarding step headings — already goal/race-neutral
- Race database — no structural changes
- Dashboard, plan view, settings — no hybrid framing present
- `apps/web/package.json` description — developer-facing only, not user-facing; leave as-is
- All functional logic, routing, data models

## Success Criteria

- No instance of "hybrid athlete," "runners who lift," or "run + lift" remains in user-facing copy (landing page, meta tags, PWA manifest, onboarding, README)
- Strength training onboarding step reads as a scheduling convenience, not a differentiating identity claim
- Landing page tagline, meta description, and PWA manifest consistently reflect the serious marathoner / goal-time positioning
- CLAUDE.md Overview accurately reflects current product direction and business model

## Known Exceptions

- `apps/web/package.json` description field still references "hybrid athletes" — this is developer-facing only (not rendered in the UI or indexed by search engines) and is intentionally left unchanged.
