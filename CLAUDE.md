# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Athloryx is an adaptive training system for hybrid athletes. The platform intelligently adjusts training programs based on athlete performance, recovery, and goals across multiple disciplines (e.g., running, cycling, strength training).

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

## Adding Components

Add shadcn/ui components:
```bash
pnpm dlx shadcn@latest add <component> -c apps/web
```

Add Magic UI components (animated/interactive):
```bash
pnpm dlx shadcn@latest add "https://magicui.design/r/<component>" -c apps/web
```

Components are placed in `packages/ui/src/components` and imported as:
```tsx
import { Button } from "@workspace/ui/components/button";
import { ShimmerButton } from "@workspace/ui/components/shimmer-button";
```

## Conventions

- Workspace packages use `@workspace/*` naming
- Path aliases: `@/*` in web app, `@workspace/ui/*` for UI package
- Components use Class Variance Authority (CVA) for variants
- CSS variables in oklch color space for theming
