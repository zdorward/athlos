# Athlos

Adaptive marathon training for runners with a goal time. Athlos generates personalized week-by-week plans and adapts them based on performance and recovery. Supports running-only or running + strength scheduling.

**Tech stack:** pnpm monorepo · Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · shadcn/ui · Neon (Postgres)

## Dev setup

Run all commands from the repo root:

```bash
pnpm dev          # Start Next.js dev server with Turbopack
pnpm build        # Build all packages and apps
pnpm lint         # Run ESLint across all packages
pnpm typecheck    # TypeScript type checking
```

## Adding Components

**shadcn/ui components:**

```bash
pnpm dlx shadcn@latest add <component> -c apps/web
```

**Magic UI components** (animated/interactive):

```bash
pnpm dlx shadcn@latest add "https://magicui.design/r/<component>" -c apps/web
```

Components are placed in `packages/ui/src/components`.

## Using Components

```tsx
import { Button } from "@workspace/ui/components/button";
import { ShimmerButton } from "@workspace/ui/components/shimmer-button";
```
