# Loading Spinner Design

**Date:** 2026-03-16
**Status:** Approved

## Problem

The app uses `Loader2` from lucide-react with `animate-spin` inlined in 5+ locations. The result is a generic, visually weak spinner — particularly on the landing page's black initial-load screen. There is no shared component, making future changes require touching every callsite.

## Goal

Replace all spinner usages with a single shared `<Spinner />` component using a pulse-dots animation in the app's brand color. Consolidate the pattern to a single source of truth.

## Component

**Location:** `packages/ui/src/components/spinner.tsx`
**Export:** Added to `packages/ui/src/index.ts` alongside other components.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | `"sm" \| "md"` | `"md"` | `md` for full-page loads, `sm` for inline button use |

### Sizes

- `md` — three 7px dots, 6px gap. Full-page loading states.
- `sm` — three 5px dots, 4px gap. Inline in buttons/forms.

### Color

Uses `text-primary` via `currentColor` — inherits from context, works in both light and dark mode without hardcoded color values.

## Animation

A `dot-pulse` keyframe added to `packages/ui/src/styles/globals.css`, consistent with the existing `shimmer-slide` and `spin-around` definitions already there.

```css
@keyframes dot-pulse {
  0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
  40%           { opacity: 1;   transform: scale(1); }
}
```

Each dot gets `animate-dot-pulse` with staggered delays: `0s`, `0.2s`, `0.4s`. Duration: `1.2s ease-in-out infinite`.

A `animate-dot-pulse` utility is registered in the `@theme inline` block in `globals.css`.

## Callsite Changes

| File | Before | After |
|------|--------|-------|
| `app/page.tsx` | `<Loader2 style={{ color: "rgba(255,255,255,0.3)" }} />` | `<Spinner />` |
| `app/(app)/dashboard/page.tsx` | `<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />` | `<Spinner />` |
| `app/(app)/plan/[id]/page.tsx` | `<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />` | `<Spinner />` |
| `app/new-plan/page.tsx` | `<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />` | `<Spinner />` |
| `app/plan/save-plan-button.tsx` | `<Loader2 className="h-4 w-4 animate-spin" />` | `<Spinner size="sm" />` |

The wrapping `<main className="flex min-h-svh items-center justify-center">` at each full-page callsite is unchanged. `Loader2` imports are removed from all 5 files.

## What Does Not Change

- Page layout / centering wrappers
- The `adaptation-suggestion-card.tsx` loading state (text-based: `"Updating…"` — no spinner involved)
- The `settings/page.tsx` loading state (text-based: `"Loading…"` — no spinner involved)
