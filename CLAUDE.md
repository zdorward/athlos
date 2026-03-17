# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Athlos is an adaptive marathon training platform for advanced runners. Training plans are grounded in **modern marathon science** — Pfitzinger's *Advanced Marathoning* is a useful foundation for volume progression, long run targets, and phase structure, but it has known weaknesses (see `docs/training-science/modern-marathon-science.md`). When Pfitz conflicts with modern research, modern research wins.

## Training Science Principles

When writing or reviewing training plan logic, apply these principles in order of priority:

**1. Specificity above all**
The dominant predictor of marathon performance is lactate threshold, not VO2max. The final 8 weeks before a race should emphasize marathon-pace (MP) and threshold work — not VO2max intervals. MP work is dramatically underrepresented in classic Pfitz plans (~14 miles total in 12 weeks); modern coaching prescribes 5–10x more marathon-specific work.

**2. Polarized intensity distribution**
Most volume (~80%) should be genuinely easy (Zone 1 — conversational, aerobic). Quality sessions should be hard (Zone 3 — tempo/threshold, MP, or VO2max). Minimize time in the "gray zone" (slightly-too-fast aerobic runs that generate fatigue without proportional adaptation). Pfitz's "medium-long at endurance pace" workouts push into the gray zone — use them sparingly.

**3. Periodization: general → specific**
Early phases build aerobic base and introduce VO2max work to raise the ceiling. Later phases shift to marathon-specific work: threshold runs, MP segments, MP-heavy long runs. This is the opposite of classic Pfitz (LT early → VO2max late). Reverse the emphasis.

**4. Strength training is first-class**
Modern meta-analyses (2022–2024) show heavy resistance and plyometric training meaningfully improve running economy — this is performance, not just injury prevention. Strength sessions belong on easy run days (after the run), never on quality days or adjacent to the long run. 2x/week resistance, 3x/week core; reduce resistance to 1x/week in Peak, reduce both to 1x/week in Taper Week 1, 0 from Taper Week 2 onward and race week.

**5. Recovery must be real**
Recovery weeks every 4th week at ~70% of prior volume. High training monotony (running at similar paces every day) is a leading cause of overtraining. Hard and easy days must be genuinely different.

**Where Pfitz remains valid:**
- Volume progression rates (10% rule, recovery week cadence)
- Long run distance targets relative to weekly mileage
- Phase structure naming and duration (Base, Build, Peak, Taper)
- The importance of mileage as the primary performance lever

## General Principles

Always follow standard, best-practice approaches. When multiple solutions exist, default to the conventional, well-established pattern for the technology in use. If a non-standard approach was used previously, refactor it to be correct rather than preserving the deviation.

**Keep code lean:**

- Delete dead code and unused imports/variables/exports — don't comment them out
- Don't add features, configuration options, or abstractions beyond what the current task requires
- Don't create helpers or utilities for one-off operations — three similar lines beats a premature abstraction
- Don't add fallbacks, validation, or error handling for scenarios that can't actually happen
- When removing a feature, remove all of it: the code, its types, its tests, and any references

## Design & Engineering Philosophy

Take cues from Linear, Notion, and Vercel — products known for fast, intentional, well-engineered software. Apply these principles:

**Visual style:**

- Neutral color palette; use accent color sparingly and with purpose
- Strong typographic hierarchy — size and weight do the work, not color
- Generous but purposeful whitespace; avoid padding that feels padded
- Hairline borders and subtle shadows over heavy outlines or elevation

**Interactions:**

- Subtle, fast transitions (100–200ms); never animate for decoration
- Keyboard-first where applicable — actions should be reachable without a mouse
- Immediate feedback on user actions; never leave the user wondering if it worked
- Prefer inline editing and contextual controls over modals when possible

**Information design:**

- Show only what the user needs right now; progressive disclosure for complexity
- Density matters — pack information cleanly rather than spreading it thin
- Empty states should be helpful, not just decorative
- Error messages should explain what to do, not just what went wrong

**Code & architecture:**

- Performance is a feature — prefer server components, avoid unnecessary client boundaries, minimize bundle size
- Optimistic UI updates where state is predictable; don't make users wait for round-trips they don't need to see
- Small, focused modules with a single responsibility; complexity lives at the edges, not in the core
- Simple, composable APIs over clever, all-in-one abstractions
- Colocate related logic — data fetching, types, and rendering near each other rather than scattered by layer
- Avoid unnecessary dependencies; prefer native platform capabilities when they're sufficient
- TypeScript strictly — no `any`, no type assertions without justification

## Build Commands

This is a pnpm monorepo using Turbo. Run all commands from the repository root.

```bash
pnpm dev          # Start Next.js dev server with Turbopack
pnpm build        # Build all packages and apps
pnpm lint         # Run ESLint across all packages
pnpm format       # Format with Prettier
pnpm typecheck    # TypeScript type checking
```

## Architecture

**Monorepo Structure:**

- `apps/web` - Next.js 16 application using App Router
- `packages/ui` - Shared UI component library (shadcn/ui components)
- `packages/eslint-config` - Shared ESLint configurations
- `packages/typescript-config` - Shared TypeScript configurations

**Key Technologies:**

- Next.js 16 with React 19 and Turbopack
- Tailwind CSS v4 (PostCSS syntax)
- shadcn/ui with Radix UI primitives
- Magic UI for animated components (uses framer-motion)
- Zod for validation
- next-themes for dark mode
