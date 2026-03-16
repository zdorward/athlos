# Loading Spinner Design

**Date:** 2026-03-16
**Status:** Approved

## Problem

The app uses `Loader2` from lucide-react with `animate-spin` inlined in 6 locations. The result is a generic, visually weak spinner — particularly on the landing page's black initial-load screen. There is no shared component, making future changes require touching every callsite.

## Goal

Replace all spinner usages with a single shared `<Spinner />` component using a pulse-dots animation in the app's brand color. Consolidate the pattern to a single source of truth.

## Component

**Location:** `packages/ui/src/components/spinner.tsx`
**Import:** `@workspace/ui/components/spinner` (no index barrel — package exports by sub-path)

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | `"sm" \| "md"` | `"md"` | `md` for full-page loads, `sm` for inline button use |
| `className` | `string` | — | Optional Tailwind classes, e.g. to override color |

### Sizes

- `md` — three `size-2` (8px) dots, `gap-1.5` (6px) gap. Full-page loading states.
- `sm` — three `size-1.5` (6px) dots, `gap-1` (4px) gap. Inline in buttons/forms.

Both sizes are on the standard 4px Tailwind spacing grid, consistent with the rest of the codebase.

### Color

Uses `text-primary` via `currentColor` by default. Accepts an optional `className` to override, e.g. `<Spinner className="text-white/30" />` for the landing page's black background.

## Animation

A `dot-pulse` keyframe and `--animate-dot-pulse` theme property added to `packages/ui/src/styles/globals.css`, consistent with the existing `shimmer-slide` and `spin-around` definitions there.

```css
@theme inline {
  /* ...existing entries... */
  --animate-dot-pulse: dot-pulse 1.2s ease-in-out infinite;
}

@keyframes dot-pulse {
  0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
  40%           { opacity: 1;   transform: scale(1);   }
}
```

Per-dot staggered delays (`0s`, `0.2s`, `0.4s`) are applied via `style={{ animationDelay: '...' }}` on each dot element, not in the theme block.

## Callsite Changes

| File | Before | After |
|------|--------|-------|
| `app/page.tsx` | `<Loader2 style={{ color: "rgba(255,255,255,0.3)" }} />` | `<Spinner className="text-white/30" />` |
| `app/(app)/dashboard/page.tsx` | `<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />` | `<Spinner />` |
| `app/(app)/plan/[id]/page.tsx` | `<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />` | `<Spinner />` |
| `app/new-plan/page.tsx` | `<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />` | `<Spinner />` |
| `app/plan/save-plan-button.tsx` | `<Loader2 className="h-4 w-4 animate-spin" />` | `<Spinner size="sm" />` |
| `app/plan/sign-in-sheet.tsx` | `{loading && <Loader2 className="h-4 w-4 animate-spin" />}` | `{loading && <Spinner size="sm" />}` |

The wrapping `<main className="flex min-h-svh items-center justify-center">` at each full-page callsite is unchanged. `Loader2` imports are removed from all 6 files.

Note: `app/page.tsx` intentionally keeps the muted white treatment (`text-white/30`) to preserve the subtle, low-contrast look on its hardcoded `#020208` background. The other full-page spinners render on the standard themed background and use the default primary color.

## What Does Not Change

- Page layout / centering wrappers
- The `adaptation-suggestion-card.tsx` loading state (text-based: `"Updating…"` — no spinner involved)
- The `settings/page.tsx` loading state (text-based: `"Loading…"` — no spinner involved)
