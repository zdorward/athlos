# Design System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Athloryx Obsidian design system — dark charcoal backgrounds, steel-blue accent, Geist font, refined radius — across the shared UI package.

**Architecture:** All color tokens live in `packages/ui/src/styles/globals.css` as CSS custom properties consumed by Tailwind v4 via `@theme inline`. Component files in `packages/ui/src/components/` are updated to use the correct radius and variant classes. No new files are created — this is a targeted replacement of existing values.

**Tech Stack:** Tailwind CSS v4, shadcn/ui CVA components, next-themes (dark/light), Geist variable font (already loaded)

---

## Chunk 1: Color tokens and radius

### Task 1: Replace color tokens in globals.css

**Files:**
- Modify: `packages/ui/src/styles/globals.css`

The token file is at `packages/ui/src/styles/globals.css`. The web app imports it via `@workspace/ui/globals.css`. Do **not** edit `apps/web/app/globals.css`.

All colors must be in oklch format — hex values will silently break Tailwind opacity modifiers like `bg-primary/12`.

- [ ] **Step 1: Replace the `:root` block**

Open `packages/ui/src/styles/globals.css`. Replace the entire `:root { ... }` block (lines 10–43) with:

```css
:root {
    --background: oklch(0.97 0.01 255);
    --foreground: oklch(0.12 0.025 255);
    --card: oklch(1 0 0);
    --card-foreground: oklch(0.12 0.025 255);
    --popover: oklch(1 0 0);
    --popover-foreground: oklch(0.12 0.025 255);
    --primary: oklch(0.52 0.24 264);
    --primary-foreground: oklch(1 0 0);
    --secondary: oklch(0.97 0 0);
    --secondary-foreground: oklch(0.205 0 0);
    --muted: oklch(0.985 0.004 255);
    --muted-foreground: oklch(0.51 0.04 255);
    --subtle-foreground: oklch(0.68 0.03 255);
    --accent: oklch(0.97 0 0);
    --accent-foreground: oklch(0.205 0 0);
    --destructive: oklch(0.577 0.245 27.325);
    --border: oklch(0.92 0.01 255);
    --input: oklch(0.92 0.01 255);
    --ring: oklch(0.52 0.24 264);
    --chart-1: oklch(0.809 0.105 251.813);
    --chart-2: oklch(0.623 0.214 259.815);
    --chart-3: oklch(0.546 0.245 262.881);
    --chart-4: oklch(0.488 0.243 264.376);
    --chart-5: oklch(0.424 0.199 265.638);
    --radius: 0.5rem;
    --sidebar: oklch(0.985 0 0);
    --sidebar-foreground: oklch(0.145 0 0);
    --sidebar-primary: oklch(0.205 0 0);
    --sidebar-primary-foreground: oklch(0.985 0 0);
    --sidebar-accent: oklch(0.97 0 0);
    --sidebar-accent-foreground: oklch(0.205 0 0);
    --sidebar-border: oklch(0.922 0 0);
    --sidebar-ring: oklch(0.708 0 0);
}
```

- [ ] **Step 2: Replace the `.dark` block**

Replace the entire `.dark { ... }` block (lines 45–77) with:

```css
.dark {
    --background: oklch(0.13 0.025 255);
    --foreground: oklch(0.93 0.02 255);
    --card: oklch(0.18 0.03 255);
    --card-foreground: oklch(0.93 0.02 255);
    --popover: oklch(0.18 0.03 255);
    --popover-foreground: oklch(0.93 0.02 255);
    --primary: oklch(0.68 0.16 255);
    --primary-foreground: oklch(0.10 0.03 255);
    --secondary: oklch(0.22 0.035 255);
    --secondary-foreground: oklch(0.93 0.02 255);
    --muted: oklch(0.22 0.035 255);
    --muted-foreground: oklch(0.55 0.06 255);
    --subtle-foreground: oklch(0.38 0.06 255);
    --accent: oklch(0.22 0.035 255);
    --accent-foreground: oklch(0.93 0.02 255);
    --destructive: oklch(0.704 0.191 22.216);
    --border: oklch(1 0 0 / 7%);
    --input: oklch(1 0 0 / 15%);
    --ring: oklch(0.68 0.16 255);
    --chart-1: oklch(0.809 0.105 251.813);
    --chart-2: oklch(0.623 0.214 259.815);
    --chart-3: oklch(0.546 0.245 262.881);
    --chart-4: oklch(0.488 0.243 264.376);
    --chart-5: oklch(0.424 0.199 265.638);
    --sidebar: oklch(0.205 0 0);
    --sidebar-foreground: oklch(0.985 0 0);
    --sidebar-primary: oklch(0.488 0.243 264.376);
    --sidebar-primary-foreground: oklch(0.985 0 0);
    --sidebar-accent: oklch(0.269 0 0);
    --sidebar-accent-foreground: oklch(0.985 0 0);
    --sidebar-border: oklch(1 0 0 / 10%);
    --sidebar-ring: oklch(0.556 0 0);
}
```

- [ ] **Step 3: Register `--subtle-foreground` in `@theme inline`**

Inside the existing `@theme inline { ... }` block (after the last `--color-sidebar-ring` line, before the `--font-sans` line), add:

```css
    --color-subtle-foreground: var(--subtle-foreground);
```

This makes `text-subtle-foreground` work as a Tailwind utility class.

- [ ] **Step 4: Verify typecheck passes**

```bash
pnpm typecheck
```

Expected: `Tasks: 2 successful, 2 total` with no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/styles/globals.css
git commit -m "feat: apply Athloryx color system and radius tokens"
```

---

## Chunk 2: Component radius and variant updates

### Task 2: Update button.tsx — base radius and ghost variant

**Files:**
- Modify: `packages/ui/src/components/button.tsx`

Two changes:
1. The base CVA class has `rounded-lg` — change to `rounded-md` so buttons use the 6px radius tier
2. The `ghost` variant has no border — add `border border-border` so ghost buttons have a visible edge

- [ ] **Step 1: Change base class radius**

In the `cva(...)` base string (line 8), change `rounded-lg` to `rounded-md`:

Before:
```
"group/button inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg border border-transparent ..."
```

After:
```
"group/button inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md border border-transparent ..."
```

- [ ] **Step 2: Add border to ghost variant**

In the `variants.variant` object, find the `ghost` key:

Before:
```ts
ghost:
  "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
```

After:
```ts
ghost:
  "border border-border hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
```

> Do not change the `outline` variant — it has `bg-background` and is a different pattern.

- [ ] **Step 3: Verify typecheck passes**

```bash
pnpm typecheck
```

Expected: `Tasks: 2 successful, 2 total`

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/components/button.tsx
git commit -m "feat: update button radius to rounded-md and ghost border"
```

---

### Task 3: Update card.tsx — radius and border

**Files:**
- Modify: `packages/ui/src/components/card.tsx`

The `Card` base class uses `rounded-xl` and `ring-1 ring-foreground/10` (a subtle ring as the border). The design system uses `rounded-lg` and an explicit `border border-border`. Also remove the `overflow-hidden` — cards in this design use explicit rounding without clip.

- [ ] **Step 1: Update the Card base class**

In `card.tsx`, find the `Card` function's `className` (line 15). Replace:

```
"group/card flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 text-sm text-card-foreground ring-1 ring-foreground/10 has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:gap-3 data-[size=sm]:py-3 data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl"
```

With:

```
"group/card flex flex-col gap-4 overflow-hidden rounded-lg bg-card py-4 text-sm text-card-foreground border border-border has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:gap-3 data-[size=sm]:py-3 data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-lg *:[img:last-child]:rounded-b-lg"
```

Changes: `rounded-xl` → `rounded-lg`, `ring-1 ring-foreground/10` → `border border-border`, inner image radius references updated to match.

- [ ] **Step 2: Verify typecheck passes**

```bash
pnpm typecheck
```

Expected: `Tasks: 2 successful, 2 total`

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/card.tsx
git commit -m "feat: update card to rounded-lg and border token"
```

---

### Task 4: Update input.tsx — radius

**Files:**
- Modify: `packages/ui/src/components/input.tsx`

The `Input` base class uses `rounded-lg`. Change to `rounded-md`. Everything else (border-input, focus-visible:border-ring, dark:bg-input/30) is correct and stays unchanged.

- [ ] **Step 1: Change input radius**

In `input.tsx`, in the `className` string (line 11), change `rounded-lg` to `rounded-md`:

Before:
```
"h-8 w-full min-w-0 rounded-lg border border-input ..."
```

After:
```
"h-8 w-full min-w-0 rounded-md border border-input ..."
```

- [ ] **Step 2: Verify typecheck passes**

```bash
pnpm typecheck
```

Expected: `Tasks: 2 successful, 2 total`

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/input.tsx
git commit -m "feat: update input radius to rounded-md"
```

---

### Task 5: Add accent variant to badge.tsx

**Files:**
- Modify: `packages/ui/src/components/badge.tsx`

Add an `accent` variant for active/primary tags (e.g. "Race", "Week 14"). The current badge base class uses `rounded-4xl` (pill). The accent variant overrides this with `rounded-sm` for a sharper chip look.

Note: The current onboarding flow uses custom inline `<span>` elements for tags, not the Badge component. This task prepares the component for future usage.

- [ ] **Step 1: Add the accent variant**

In `badge.tsx`, find the `variants.variant` object inside `badgeVariants`. After the existing `link` variant, add:

```ts
accent:
  "bg-primary/12 border-primary/20 text-primary rounded-sm text-[10px] tracking-[0.1em] uppercase",
```

The full variants object should look like:

```ts
variants: {
  variant: {
    default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
    secondary:
      "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
    destructive:
      "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
    outline:
      "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
    ghost:
      "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
    link: "text-primary underline-offset-4 hover:underline",
    accent:
      "bg-primary/12 border-primary/20 text-primary rounded-sm text-[10px] tracking-[0.1em] uppercase",
  },
},
```

- [ ] **Step 2: Verify typecheck passes**

```bash
pnpm typecheck
```

Expected: `Tasks: 2 successful, 2 total`

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/badge.tsx
git commit -m "feat: add accent badge variant for primary tags"
```

---

## Final verification

- [ ] **Start the dev server and visually inspect both modes**

```bash
pnpm dev
```

Open http://localhost:3000. Check:
- Dark mode (default): deep charcoal background, steel-blue primary button, correct card backgrounds
- Light mode: soft blue-grey background, richer blue accent, white cards
- Toggle dark/light via the theme button and confirm smooth switch
- Onboarding flow: progress bar accent color, back/X nav, card selections, final screen
- No rings or unwanted box-shadows on cards
- Ghost buttons have a visible border in both modes

- [ ] **Final commit if any visual tweaks were made**

```bash
git add -p
git commit -m "fix: visual tweaks after design system review"
```
