# Plan UI/UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Six targeted UI/UX improvements: remove a dead type, update intensity zone colors, rename a workout, move settings, fix phase label spacing, and flatten the saved plan header.

**Architecture:** All changes are isolated to presentation layer files and one shared type definition. No DB changes, no API changes, no new components. Each task touches 1–3 files and can be committed independently.

**Tech Stack:** TypeScript, Next.js 16 App Router, Tailwind CSS v4 (oklch colors), pnpm monorepo with Turbo.

---

### Task 1: Remove `medium-long` dead type

`medium-long` is a `WorkoutType` that is defined but never produced by any scheduler. Remove it from all definitions and references.

**Files:**
- Modify: `packages/plan-engine/src/types.ts`
- Modify: `apps/web/app/plan/workout-utils.ts`
- Modify: `apps/web/app/plan-preview.tsx`
- Modify: `apps/web/app/api/generate-plan/route.test.ts`

- [ ] **Step 1: Remove from `WorkoutType` union**

In `packages/plan-engine/src/types.ts`, remove the `"medium-long"` line:

```ts
export type WorkoutType =
  | "easy"
  | "long"
  | "progression"
  | "mp"
  | "tempo"
  | "intervals"
  | "rest"
  | "race"
  | "strength"
  | "shakeout"
```

- [ ] **Step 2: Remove from `workout-utils.ts`**

In `apps/web/app/plan/workout-utils.ts`, make these four changes:

**`WORKOUT_NAMES`** — delete the `"medium-long"` entry:
```ts
export const WORKOUT_NAMES: Record<WorkoutType, string> = {
  easy:        "Easy Run",
  long:        "Long Run",
  progression: "Progression Run",
  mp:          "Race Pace",
  tempo:       "Tempo Run",
  intervals:   "Intervals",
  strength:    "Strength Training",
  rest:        "Rest Day",
  race:        "Race Day",
  shakeout:    "Shakeout",
}
```

**`WORKOUT_TEXT_CLASS`** — delete the `"medium-long"` entry:
```ts
export const WORKOUT_TEXT_CLASS: Record<WorkoutType, string> = {
  easy:        "text-muted-foreground",
  long:        "text-primary",
  progression: "text-primary/70",
  mp:          "",
  tempo:       "",
  intervals:   "",
  strength:    "",
  rest:        "text-subtle-foreground",
  race:        "text-primary",
  shakeout:    "text-muted-foreground",
}
```

**`getWorkoutColor`** — no `"medium-long"` entry existed here; no change needed.

**`RUN_TYPES`** — remove `"medium-long"`:
```ts
export const RUN_TYPES = new Set<WorkoutType>([
  "easy", "long", "progression", "mp", "tempo", "intervals", "race", "shakeout",
])
```

**`getWorkoutNote`** — delete the `case "medium-long":` branch:
```ts
// Delete this case entirely:
case "medium-long":
  return "Comfortably aerobic — slightly harder than easy."
```

**`getHRZone`** — delete the `case "medium-long":` branch:
```ts
// Delete this case entirely:
case "medium-long": return "Zone 1–2"
```

- [ ] **Step 3: Fix `plan-preview.tsx`**

In `apps/web/app/plan-preview.tsx`:

**Line 7** — update the local `WorkoutType`:
```ts
type WorkoutType = "easy" | "tempo" | "long" | "strength" | "rest" | "intervals"
```

**`WORKOUT_STYLES`** — remove the `"medium-long"` entry:
```ts
const WORKOUT_STYLES: Record<WorkoutType, WorkoutStyle | null> = {
  easy:      { color: "rgba(255,255,255,0.80)" },
  tempo:     { color: "oklch(0.78 0.15 80 / 0.9)" },
  long:      { color: "rgba(147,197,253,0.85)", bg: "rgba(80,130,255,0.07)", border: "rgba(100,160,255,0.2)" },
  strength:  { color: "oklch(0.65 0.15 300 / 0.85)" },
  rest:      null,
  intervals: { color: "oklch(0.72 0.18 40 / 0.90)" },
}
```

**`WEEK_TEMPLATES`** — replace both `"medium-long"` day entries with `"easy"`. The two entries are at index 3 of week 1 and index 3 of week 2:

Week 1, day index 3 (was 16 km medium-long):
```ts
{ type: "easy", title: "Easy Run", km: "16 km", desc: "16 km aerobic run." },
```

Week 2, day index 3 (was 18 km medium-long):
```ts
{ type: "easy", title: "Easy Run", km: "18 km", desc: "18 km aerobic run." },
```

- [ ] **Step 4: Fix `route.test.ts`**

In `apps/web/app/api/generate-plan/route.test.ts`, remove `"medium-long"` from `VALID_TYPES`:

```ts
const VALID_TYPES = new Set([
  "easy",
  "long",
  "progression",
  "mp",
  "tempo",
  "intervals",
  "rest",
  "race",
  "strength",
  "shakeout",
])
```

- [ ] **Step 5: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors. If any remain, they will point to stray `"medium-long"` references — fix and re-run.

- [ ] **Step 6: Commit**

```bash
git add packages/plan-engine/src/types.ts \
        apps/web/app/plan/workout-utils.ts \
        apps/web/app/plan-preview.tsx \
        apps/web/app/api/generate-plan/route.test.ts
git commit -m "refactor: remove medium-long dead WorkoutType"
```

---

### Task 2: Rename `progression` and update intensity zone colors

Update display names and colors in `workout-utils.ts` to reflect training stress zones: green = aerobic, amber = threshold, red = VO2max, purple = strength.

**Files:**
- Modify: `apps/web/app/plan/workout-utils.ts`

- [ ] **Step 1: Rename `progression` in `WORKOUT_NAMES`**

Change `"Progression Run"` → `"MP Finish"`:

```ts
progression: "MP Finish",
```

- [ ] **Step 2: Update `WORKOUT_TEXT_CLASS` — clear stale Tailwind classes**

All types that will use an oklch inline color must have `""` here so the Tailwind class doesn't conflict. Types with no inline color keep their class.

```ts
export const WORKOUT_TEXT_CLASS: Record<WorkoutType, string> = {
  easy:        "",   // now uses oklch green via getWorkoutColor
  long:        "",   // now uses oklch green via getWorkoutColor
  progression: "",   // now uses oklch green via getWorkoutColor
  mp:          "",
  tempo:       "",
  intervals:   "",
  strength:    "",
  rest:        "text-subtle-foreground",
  race:        "text-primary",
  shakeout:    "",   // now uses oklch green via getWorkoutColor
}
```

- [ ] **Step 3: Update `getWorkoutColor` with zone-based oklch values**

```ts
export function getWorkoutColor(type: WorkoutType): string {
  const map: Partial<Record<WorkoutType, string>> = {
    // Zone 1 — Aerobic (green)
    easy:        "oklch(0.72 0.17 150)",
    long:        "oklch(0.72 0.17 150)",
    progression: "oklch(0.72 0.17 150)",
    shakeout:    "oklch(0.72 0.17 150)",
    // Zone 3 — Threshold (amber)
    mp:          "oklch(0.76 0.17 75)",
    tempo:       "oklch(0.76 0.17 75)",
    // Zone 4–5 — VO2max / Hard (red)
    intervals:   "oklch(0.68 0.20 25)",
    // Accessory (purple)
    strength:    "oklch(0.70 0.14 285)",
  }
  return map[type] ?? ""
}
```

- [ ] **Step 4: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 5: Visual check**

Start the dev server (`pnpm dev`) and open a plan. Verify:
- Easy Run, Long Run, MP Finish, Shakeout cells show green text
- Tempo, Race Pace cells show amber text
- Intervals cells show red text
- Strength shows purple text
- "MP Finish" label appears where "Progression Run" used to appear

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/plan/workout-utils.ts
git commit -m "feat(plan): intensity zone colors + rename progression to MP Finish"
```

---

### Task 3: Move Settings out of nav, add temp dashboard link

Remove Settings from the primary nav (desktop + mobile). Add an unobtrusive Settings link at the bottom of the dashboard.

**Files:**
- Modify: `apps/web/app/(app)/components/app-nav.tsx`
- Modify: `apps/web/app/(app)/dashboard/dashboard-client.tsx`

- [ ] **Step 1: Remove Settings from `AppNav`**

In `apps/web/app/(app)/components/app-nav.tsx`, remove the Settings entry from `tabs`:

```ts
const tabs = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, activePrefix: "/dashboard" },
  { label: "Plan", href: planHref, icon: CalendarDays, activePrefix: "/plan" },
]
```

Also remove the unused `Settings` import from lucide-react:
```ts
import { LayoutDashboard, CalendarDays, User } from "lucide-react"
```

- [ ] **Step 2: Add temporary Settings link to dashboard**

In `apps/web/app/(app)/dashboard/dashboard-client.tsx`, add a Settings link after the "View full plan →" block. Find the closing `</div>` of the `mx-auto max-w-xl` container and add before it:

```tsx
<div className="pt-4 text-center">
  <Link
    href="/settings"
    className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
  >
    Settings
  </Link>
</div>
```

The full bottom of `DashboardClient`'s return (replace the existing `pt-2 text-center` block and closing tags):

```tsx
        <div className="pt-2 text-center">
          <Link
            href={`/plan/${resolvedPlan.id}`}
            className="text-sm text-primary hover:underline"
          >
            View full plan →
          </Link>
        </div>

        <div className="pt-4 text-center">
          <Link
            href="/settings"
            className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            Settings
          </Link>
        </div>

      </div>

    </main>
  )
}
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: Visual check**

Verify Settings no longer appears in the desktop top nav or mobile bottom tab bar. Verify a small "Settings" text link appears at the bottom of the dashboard.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/(app)/components/app-nav.tsx \
        apps/web/app/(app)/dashboard/dashboard-client.tsx
git commit -m "feat(nav): move Settings out of primary nav; add temp dashboard link"
```

---

### Task 4: Fix phase label spacing

`PhaseHeader` in `plan-calendar.tsx` currently uses `mt-3 mb-1` (12px above, 4px below), making it visually closer to the week below. Change to `mt-5 mb-2` for balanced spacing.

**Files:**
- Modify: `apps/web/app/plan/plan-calendar.tsx`

- [ ] **Step 1: Update `PhaseHeader` className**

Find the `PhaseHeader` function (lines 22–34). Change the grid div's className:

```tsx
function PhaseHeader({ label }: { label: string }) {
  return (
    <div className="grid grid-cols-[64px_repeat(7,1fr)] gap-1 mb-2 mt-5">
```

(Change `mb-1 mt-3` → `mb-2 mt-5`)

- [ ] **Step 2: Visual check**

Open a plan with multiple phases. Verify phase labels (e.g. "Base", "Build", "Peak") sit visually centered between the week above and the week below — not hugging the week below.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/plan/plan-calendar.tsx
git commit -m "fix(plan): balance phase label spacing above and below"
```

---

### Task 5: Flat saved plan header

Add a `variant` prop to `PlanHeader`. The `"saved"` variant renders a flat single-row layout (no back button, no border) matching the screenshot the user provided. The `"generation"` variant is the existing behavior and remains unchanged.

**Files:**
- Modify: `apps/web/app/plan/plan-header.tsx`
- Modify: `apps/web/app/(app)/plan/[id]/page.tsx`

- [ ] **Step 1: Add `variant` prop and implement `"saved"` layout in `PlanHeader`**

Replace the full contents of `apps/web/app/plan/plan-header.tsx`:

```tsx
"use client"

import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { formatDistance, distanceUnit } from "./workout-utils"
import { SavePlanButton, type SaveProps } from "./save-plan-button"

interface PlanHeaderProps {
  planName: string
  totalWeeks: number
  totalKm: number
  units: "km" | "miles"
  status: "generating" | "complete" | "error" | "rate-limited"
  goalTimeLabel?: string
  backHref?: string
  saveProps?: SaveProps
  onNewPlan?: () => void
  variant?: "generation" | "saved"
}

export function PlanHeader({
  planName,
  totalWeeks,
  totalKm,
  units,
  status,
  goalTimeLabel,
  backHref = "/",
  saveProps,
  onNewPlan,
  variant = "generation",
}: PlanHeaderProps) {
  const totalDisplay = formatDistance(totalKm, units)
  const unit = distanceUnit(units)

  const metaParts = [
    totalWeeks > 0 ? `${totalWeeks} weeks` : null,
    totalKm > 0 ? `${totalDisplay} ${unit}` : null,
    goalTimeLabel ? `Goal ${goalTimeLabel}` : null,
  ].filter(Boolean)

  if (variant === "saved") {
    return (
      <div className="flex items-center justify-between px-6 py-5">
        <div>
          <h1 className="text-base font-semibold tracking-tight">{planName}</h1>
          {metaParts.length > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">{metaParts.join(" · ")}</p>
          )}
        </div>
        {onNewPlan && (
          <button
            onClick={onNewPlan}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            New plan
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="border-b border-border">
      <div className="relative flex items-center justify-between px-4 py-6">
        <Link
          href={backHref}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Link>

        {/* Centered plan info — absolutely positioned so it doesn't shift with left/right content */}
        <div className="absolute inset-x-0 flex flex-col items-center pointer-events-none">
          <h1 className="text-base font-semibold tracking-tight">{planName}</h1>
          {metaParts.length > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">{metaParts.join(" · ")}</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {status === "error" && (
            <p className="text-xs text-destructive">Generation failed — go back and try again.</p>
          )}

          {status === "rate-limited" && (
            <p className="text-xs text-destructive">Too many plans generated today — try again tomorrow.</p>
          )}

          {saveProps && <SavePlanButton {...saveProps} />}

          {onNewPlan && (
            <button
              onClick={onNewPlan}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              New plan
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Pass `variant="saved"` in the saved plan page**

In `apps/web/app/(app)/plan/[id]/page.tsx`, update the `PlanHeader` call:

```tsx
<PlanHeader
  planName={plan.name}
  totalWeeks={plan.totalWeeks}
  totalKm={Number(plan.totalKm)}
  units={units}
  status="complete"
  goalTimeLabel={goalTimeLabel}
  backHref="/dashboard"
  onNewPlan={() => void handleStartNewPlan()}
  variant="saved"
/>
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: Visual check**

Open a saved plan (`/plan/[id]`). Verify:
- Title and meta are left-aligned, flat, no border below the header
- "New plan" button is on the right
- No back button

Open the generation preview (`/plan`). Verify the header still shows Back button + centered title + border — unchanged.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/plan/plan-header.tsx \
        apps/web/app/(app)/plan/[id]/page.tsx
git commit -m "feat(plan): flat saved plan header; add variant prop to PlanHeader"
```

---

### Task 6: Final verification

- [ ] **Step 1: Run all tests**

```bash
pnpm --filter web test
pnpm --filter @workspace/plan-engine test
```

Expected: all tests pass.

- [ ] **Step 2: Run full typecheck**

```bash
pnpm typecheck
```

Expected: no errors.
