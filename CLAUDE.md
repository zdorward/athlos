# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Athlos is an adaptive training system for hybrid athletes (running + lifting). The goal is to build a platform that intelligently adjusts training programs based on athlete performance, recovery, and goals. Currently building out the web app with plans to implement mobile later. Business model will be freemium.

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
