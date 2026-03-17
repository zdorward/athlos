# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Athlos is an adaptive marathon training platform for serious runners with a real goal time. The core differentiator is intelligent plan adaptation based on athlete performance, recovery, and goals — not just static plan generation. Target audience: runners chasing a qualifying time (BQ as the implied benchmark). Strength training is supported as a scheduling feature. Currently building out the web app with plans to implement mobile later. Business model is subscription + time-limited trial (not freemium).

Training plans are built on the methods from Pete Pfitzinger's *Advanced Marathoning*. All volume progression, long run targets, phase structure, intensity distribution (80/20 rule), and quality session placement follow Pfitzinger's principles. When making decisions about training plan logic, default to what Pfitzinger prescribes.

## General Principles

Always follow standard, best-practice approaches. When multiple solutions exist, default to the conventional, well-established pattern for the technology in use. If a non-standard approach was used previously, refactor it to be correct rather than preserving the deviation.

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
