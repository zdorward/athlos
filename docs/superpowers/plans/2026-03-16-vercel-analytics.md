# Vercel Analytics + Speed Insights Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install @vercel/analytics and @vercel/speed-insights and mount their components in the root layout so page views and Core Web Vitals are tracked on Vercel.

**Architecture:** Both packages ship framework-specific components that self-initialize when rendered. Adding them to the root `layout.tsx` provides full-app coverage with no additional configuration.

**Tech Stack:** Next.js 16 App Router, pnpm monorepo, @vercel/analytics, @vercel/speed-insights

---

## Chunk 1: Install and integrate

### Task 1: Install packages

**Files:**
- Modify: `apps/web/package.json` (dependency added by pnpm)

- [ ] **Step 1: Install both packages scoped to the web workspace**

```bash
pnpm add @vercel/analytics @vercel/speed-insights --filter web
```

Expected: `apps/web/package.json` now lists both packages under `dependencies`.

- [ ] **Step 2: Verify packages are in package.json**

Check that `apps/web/package.json` contains:
```json
"@vercel/analytics": "...",
"@vercel/speed-insights": "..."
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "feat: install @vercel/analytics and @vercel/speed-insights"
```

---

### Task 2: Add Analytics and SpeedInsights to root layout

**Files:**
- Modify: `apps/web/app/layout.tsx`

- [ ] **Step 1: Replace the entire contents of `apps/web/app/layout.tsx` with the following**

The current file has a non-standard import order (CSS import first, then an export mid-file, then more imports). Replace the whole file so imports are cleanly grouped and the new components are included. The result should be:

```tsx
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import "@workspace/ui/globals.css"

import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@workspace/ui/lib/utils"

export const metadata: Metadata = {
  title: "Athlos",
  description: "Adaptive training system for hybrid athletes",
}

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", fontSans.variable)}
    >
      <body>
        <ThemeProvider>{children}</ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Run typecheck to verify no errors**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Start dev server and verify it compiles**

```bash
pnpm dev
```

Expected: dev server starts without errors. Both components are no-ops in dev, so no network calls will be made.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/layout.tsx
git commit -m "feat: add Vercel Analytics and Speed Insights to root layout"
```
