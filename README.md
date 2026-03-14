# Athlos

An adaptive training system for hybrid athletes. The platform intelligently adjusts training programs based on athlete performance, recovery, and goals across multiple disciplines.

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
