# Vercel Analytics + Speed Insights — Design Spec

**Date:** 2026-03-16
**Status:** Approved

## Overview

Add Vercel Analytics and Vercel Speed Insights to the Athlos web app. Both are zero-config services that activate automatically when deployed to Vercel.

- **Vercel Analytics** — tracks page views and visitor data
- **Vercel Speed Insights** — tracks Core Web Vitals (LCP, FID, CLS, etc.)

## Implementation

### 1. Install packages

```bash
pnpm add @vercel/analytics @vercel/speed-insights --filter web
```

### 2. Update root layout

Add `<Analytics />` and `<SpeedInsights />` to `apps/web/app/layout.tsx` inside `<body>`:

```tsx
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"

// inside <body>:
<ThemeProvider>{children}</ThemeProvider>
<Analytics />
<SpeedInsights />
```

## Notes

- No environment variables or configuration required
- Both components are no-ops in development; they only report data in production on Vercel
- Placement at the root layout ensures coverage across all routes
