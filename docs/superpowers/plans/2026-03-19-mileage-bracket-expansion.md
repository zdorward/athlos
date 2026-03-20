# Mileage Bracket Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the `"under-40"` mileage bracket into three granular brackets (`"0-10"`, `"10-25"`, `"25-40"`) so that feasibility warnings fire correctly for true beginners and the onboarding UI presents activity-level descriptions instead of raw km numbers.

**Architecture:** Four tasks in dependency order: (1) rename `"under-40"` → `"25-40"` everywhere with no behavior change, (2) write failing tests for the two new brackets, (3) expand the type and all plan-engine constants to make tests pass, (4) update the web app UI and wiring. Each task commits independently.

**Tech Stack:** TypeScript, pnpm monorepo, Vitest (plan-engine tests), Next.js 16 App Router, Tailwind CSS v4, React 19.

---

## File Map

| File | Change |
|---|---|
| `packages/plan-engine/src/types.ts` | Rename `"under-40"` → `"25-40"`, add `"0-10"` and `"10-25"` |
| `packages/plan-engine/src/volume-progression.ts` | Same rename + add two new entries to `WEEK1_VOLUME_KM` |
| `packages/plan-engine/src/constraints.ts` | Same rename + add two new entries to `MILEAGE_RANGE_HIGH` |
| `packages/plan-engine/src/phase-planner.ts` | Same rename + add two new entries to `GF_CAP` |
| `packages/plan-engine/src/training-parameters.ts` | Same rename + add two new if-else cases |
| `packages/plan-engine/src/constraints.test.ts` | Rename in existing tests + add 3 new tests |
| `packages/plan-engine/src/volume-progression.test.ts` | Rename in existing tests + add 2 new tests |
| `packages/plan-engine/src/phase-planner.test.ts` | Rename only |
| `packages/plan-engine/src/training-parameters.test.ts` | Rename only |
| `apps/web/app/api/generate-plan/route.test.ts` | Rename only |
| `apps/web/components/onboarding/onboarding-card.tsx` | Add optional `badge` prop (right-aligned text) |
| `apps/web/components/onboarding/steps/step-weekly-mileage.tsx` | 6-card redesign with activity labels + km badge |
| `apps/web/components/onboarding/types.ts` | Rename + expand local `weeklyMileageRange` union |
| `apps/web/app/plan/page.tsx` | Rename + expand `validRanges` array |

---

### Task 1: Rename `"under-40"` → `"25-40"` everywhere

Pure rename — no behavior change. After this task all existing tests must still pass.

**Files:**
- Modify: `packages/plan-engine/src/types.ts:36`
- Modify: `packages/plan-engine/src/volume-progression.ts:11`
- Modify: `packages/plan-engine/src/constraints.ts:6`
- Modify: `packages/plan-engine/src/phase-planner.ts:15`
- Modify: `packages/plan-engine/src/training-parameters.ts:101`
- Modify: `packages/plan-engine/src/constraints.test.ts` (lines 77, 123, 128, 144)
- Modify: `packages/plan-engine/src/phase-planner.test.ts` (lines 144, 145, 164, 165)
- Modify: `packages/plan-engine/src/volume-progression.test.ts` (lines 29, 31)
- Modify: `packages/plan-engine/src/training-parameters.test.ts:121`
- Modify: `apps/web/app/api/generate-plan/route.test.ts:170`
- Modify: `apps/web/components/onboarding/steps/step-weekly-mileage.tsx` (lines 7, 10, 17)
- Modify: `apps/web/components/onboarding/types.ts:36`
- Modify: `apps/web/app/plan/page.tsx:66`

- [ ] **Step 1: Update `WeeklyMileageRange` type**

In `packages/plan-engine/src/types.ts:36`, change:
```ts
// before
export type WeeklyMileageRange = "under-40" | "40-60" | "60-80" | "80-plus"

// after
export type WeeklyMileageRange = "25-40" | "40-60" | "60-80" | "80-plus"
```

- [ ] **Step 2: Update plan-engine constant maps**

In `packages/plan-engine/src/volume-progression.ts`:
```ts
export const WEEK1_VOLUME_KM: Record<WeeklyMileageRange, number> = {
  "25-40": 30,   // was "under-40": 30
  "40-60": 40,
  "60-80": 60,
  "80-plus": 80,
}
```

In `packages/plan-engine/src/constraints.ts`:
```ts
const MILEAGE_RANGE_HIGH: Record<WeeklyMileageRange, number> = {
  "25-40":  40,   // was "under-40": 40
  "40-60":  60,
  "60-80":  80,
  "80-plus": 120,
}
```

In `packages/plan-engine/src/phase-planner.ts`:
```ts
const GF_CAP: Record<WeeklyMileageRange, number> = {
  "25-40":  12,   // was "under-40": 12
  "40-60":  10,
  "60-80":   8,
  "80-plus":  6,
}
```

In `packages/plan-engine/src/training-parameters.ts` lines 101–105:
```ts
if      (weeklyMileageRange === "25-40")   { run = 5; rest = 2; quality = 1 }  // was "under-40"
else if (weeklyMileageRange === "40-60")   { run = 6; rest = 1; quality = 1 }
else if (weeklyMileageRange === "60-80")   { run = 6; rest = 1; quality = 2 }
else if (weeklyMileageRange === "80-plus") { run = 7; rest = 0; quality = 2 }
```

- [ ] **Step 3: Update plan-engine test files**

`packages/plan-engine/src/constraints.test.ts` — five changes (listed in file order):
- Line 73 (comment): `"under-40 bracket starts at 30 km/week"` → `"25-40 bracket starts at 30 km/week"`
- Line 77: `weeklyMileageRange: "under-40"` → `weeklyMileageRange: "25-40" as const`
- Line 123 (comment): `"under-40 starts 30 km"` → `"25-40 starts 30 km"`
- Line 128: `weeklyMileageRange: "under-40"` → `weeklyMileageRange: "25-40" as const`
- Line 144: `weeklyMileageRange: "under-40"` → `weeklyMileageRange: "25-40" as const`

`packages/plan-engine/src/phase-planner.test.ts`:
- Line 144: comment `"under-40:"` → `"25-40:"`
- Line 145: `computePhases(29, "full", "under-40")` → `computePhases(29, "full", "25-40")`
- Line 153: comment `"under-40"` → `"25-40"`
- Line 164: comment `"under-40:"` → `"25-40:"`
- Line 165: `computePhases(52, "full", "under-40")` → `computePhases(52, "full", "25-40")`

`packages/plan-engine/src/volume-progression.test.ts`:
- Line 29: comment `"under-40=30"` → `"25-40=30"`
- Line 31: `weeklyMileageRange: "under-40"` → `weeklyMileageRange: "25-40" as const`

`packages/plan-engine/src/training-parameters.test.ts`:
- Line 121: `computeTrainingStructure(null, "full", 7, "under-40")` → `computeTrainingStructure(null, "full", 7, "25-40")`

`apps/web/app/api/generate-plan/route.test.ts`:
- Line 170: `weeklyMileageRange: "under-40"` → `weeklyMileageRange: "25-40" as const`

- [ ] **Step 4: Update web app files**

`apps/web/components/onboarding/steps/step-weekly-mileage.tsx`:
```ts
// line 7 — local type
type MileageRange = "25-40" | "40-60" | "60-80" | "80-plus"

// line 10 — KM_OPTIONS first entry
{ value: "25-40", label: "Under 40 km/week", description: "Building base fitness" },

// line 17 — MILES_OPTIONS first entry
{ value: "25-40", label: "Under 25 mi/week", description: "Building base fitness" },
```

`apps/web/components/onboarding/types.ts:36`:
```ts
weeklyMileageRange?: "25-40" | "40-60" | "60-80" | "80-plus"
```

`apps/web/app/plan/page.tsx:66`:
```ts
const validRanges = ["25-40", "40-60", "60-80", "80-plus"]
```

- [ ] **Step 5: Run tests — all must pass**

```bash
pnpm --filter @workspace/plan-engine test
```

Expected: all existing tests pass (no behavioral change — pure rename).

- [ ] **Step 6: Run typecheck — must pass clean**

```bash
pnpm typecheck
```

Expected: no type errors.

- [ ] **Step 7: Commit**

```bash
git add packages/plan-engine/src/types.ts \
        packages/plan-engine/src/volume-progression.ts \
        packages/plan-engine/src/constraints.ts \
        packages/plan-engine/src/phase-planner.ts \
        packages/plan-engine/src/training-parameters.ts \
        packages/plan-engine/src/constraints.test.ts \
        packages/plan-engine/src/phase-planner.test.ts \
        packages/plan-engine/src/volume-progression.test.ts \
        packages/plan-engine/src/training-parameters.test.ts \
        apps/web/app/api/generate-plan/route.test.ts \
        apps/web/components/onboarding/steps/step-weekly-mileage.tsx \
        apps/web/components/onboarding/types.ts \
        apps/web/app/plan/page.tsx
git commit -m "refactor: rename mileage bracket under-40 to 25-40"
```

---

### Task 2: Write failing tests for new brackets

Write tests that will fail at compile time because `"0-10"` and `"10-25"` are not yet in `WeeklyMileageRange`.

**Files:**
- Modify: `packages/plan-engine/src/constraints.test.ts`
- Modify: `packages/plan-engine/src/volume-progression.test.ts`

- [ ] **Step 1: Add new tests to `constraints.test.ts`**

Append inside the `describe("feasibilityWarning")` block (after line 150, before the closing `})`):

```ts
    it("warns for '0-10' first-timer full marathon — long run far below 26 km", () => {
      // WEEK1=10, ramp=0.08, 17 pre-taper weeks
      // achievable = 10 * 1.08^17 ≈ 37 km; clamped by MILEAGE_RANGE_HIGH["0-10"]=25
      // peakWeeklyKm = 25; long run = 25 * 0.40 = 10 km < 26 km → warning fires
      const c = computeConstraints({
        ...base,
        isFirstAtDistance: true,
        weeklyMileageRange: "0-10" as const,
        totalWeeks: 20,
        goalMinutes: null,
      })
      expect(c.feasibilityWarning).toMatch(/Long run/)
    })

    it("warns for '10-25' first-timer full marathon — long run below 26 km", () => {
      // WEEK1=15, ramp=0.08, 17 pre-taper weeks
      // achievable = 15 * 1.08^17 ≈ 55 km; clamped by MILEAGE_RANGE_HIGH["10-25"]=35
      // peakWeeklyKm = 35; long run = 35 * 0.40 = 14 km < 26 km → warning fires
      const c = computeConstraints({
        ...base,
        isFirstAtDistance: true,
        weeklyMileageRange: "10-25" as const,
        totalWeeks: 20,
        goalMinutes: null,
      })
      expect(c.feasibilityWarning).toMatch(/Long run/)
    })

    it("warns for '10-25' first-timer half marathon — long run below 16 km threshold", () => {
      // WEEK1=15, ramp=0.08, 17 pre-taper weeks
      // clamped by MILEAGE_RANGE_HIGH["10-25"]=35; long run = 35 * 0.38 ≈ 13.3 km < 16 km
      const c = computeConstraints({
        ...base,
        distance: "half",
        isFirstAtDistance: true,
        weeklyMileageRange: "10-25" as const,
        totalWeeks: 20,
        goalMinutes: null,
      })
      expect(c.feasibilityWarning).toMatch(/Long run/)
    })
```

- [ ] **Step 2: Add new tests to `volume-progression.test.ts`**

Add a new test after the existing `"week 1 lower bounds"` test. Note: `base` in that file uses `weeklyMileageRange: "40-60"` and `peakWeeklyKm: 60` — pass matching `peakWeeklyKm` values for the new brackets so the linear interpolation starts at the right point:

```ts
  it("week 1 lower bounds: 0-10=10, 10-25=15", () => {
    expect(
      computeWeeklyVolumes({ ...base, weeklyMileageRange: "0-10", peakWeeklyKm: 25 })[0]
    ).toBe(10)
    expect(
      computeWeeklyVolumes({ ...base, weeklyMileageRange: "10-25", peakWeeklyKm: 35 })[0]
    ).toBe(15)
  })
```

- [ ] **Step 3: Run tests — expect TypeScript compile failure**

```bash
pnpm --filter @workspace/plan-engine test
```

Expected: TypeScript errors — `"0-10"` and `"10-25"` are not assignable to `WeeklyMileageRange`. This confirms the tests are written correctly and will be meaningful when we expand the type.

---

### Task 3: Expand plan-engine type and constants

Add `"0-10"` and `"10-25"` to all five plan-engine files. This makes the Task 2 tests pass.

**Files:**
- Modify: `packages/plan-engine/src/types.ts:36`
- Modify: `packages/plan-engine/src/volume-progression.ts:10-15`
- Modify: `packages/plan-engine/src/constraints.ts:5-10`
- Modify: `packages/plan-engine/src/phase-planner.ts:14-19`
- Modify: `packages/plan-engine/src/training-parameters.ts:101-106`

- [ ] **Step 1: Expand the `WeeklyMileageRange` type**

`packages/plan-engine/src/types.ts:36`:
```ts
export type WeeklyMileageRange = "0-10" | "10-25" | "25-40" | "40-60" | "60-80" | "80-plus"
```

- [ ] **Step 2: Expand `WEEK1_VOLUME_KM`**

`packages/plan-engine/src/volume-progression.ts`:
```ts
export const WEEK1_VOLUME_KM: Record<WeeklyMileageRange, number> = {
  "0-10":   10,
  "10-25":  15,
  "25-40":  30,
  "40-60":  40,
  "60-80":  60,
  "80-plus": 80,
}
```

- [ ] **Step 3: Expand `MILEAGE_RANGE_HIGH`**

`packages/plan-engine/src/constraints.ts`:
```ts
const MILEAGE_RANGE_HIGH: Record<WeeklyMileageRange, number> = {
  "0-10":   25,
  "10-25":  35,
  "25-40":  40,
  "40-60":  60,
  "60-80":  80,
  "80-plus": 120,
}
```

- [ ] **Step 4: Expand `GF_CAP`**

`packages/plan-engine/src/phase-planner.ts`:
```ts
const GF_CAP: Record<WeeklyMileageRange, number> = {
  "0-10":   12,
  "10-25":  12,
  "25-40":  12,
  "40-60":  10,
  "60-80":   8,
  "80-plus":  6,
}
```

- [ ] **Step 5: Expand training structure fallback**

`packages/plan-engine/src/training-parameters.ts` — the mileage fallback block (around line 101):
```ts
if      (weeklyMileageRange === "0-10")    { run = 3; rest = 4; quality = 0 }
else if (weeklyMileageRange === "10-25")   { run = 4; rest = 3; quality = 1 }
else if (weeklyMileageRange === "25-40")   { run = 5; rest = 2; quality = 1 }
else if (weeklyMileageRange === "40-60")   { run = 6; rest = 1; quality = 1 }
else if (weeklyMileageRange === "60-80")   { run = 6; rest = 1; quality = 2 }
else if (weeklyMileageRange === "80-plus") { run = 7; rest = 0; quality = 2 }
```

Note: `quality = 0` for `"0-10"` is the mileage-fallback default only — it is used when no goal time is provided and distance is ultra or unknown. When a goal time IS provided (the common path), `computeTrainingStructure` ignores the mileage fallback entirely and derives quality from the goal-time buckets above. Additionally, `computeConstraints()` in `constraints.ts` sets `maxQualitySessions: 1` for first-timers regardless of this value — the scheduler reads from `constraints.maxQualitySessions`, not from the training structure returned here. So `quality = 0` in this fallback only affects the ultra/no-goal-time code path and does not mean `"0-10"` users get zero quality sessions in practice. The `else` catch-all at the end of the block (`{ run = 5; rest = 2; quality = 1 }`) remains unchanged.

- [ ] **Step 6: Run tests — all must pass**

```bash
pnpm --filter @workspace/plan-engine test
```

Expected: all tests pass, including the three new feasibility tests and two new WEEK1 tests from Task 2.

- [ ] **Step 7: Run typecheck**

```bash
pnpm typecheck
```

Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add packages/plan-engine/src/types.ts \
        packages/plan-engine/src/volume-progression.ts \
        packages/plan-engine/src/constraints.ts \
        packages/plan-engine/src/phase-planner.ts \
        packages/plan-engine/src/training-parameters.ts \
        packages/plan-engine/src/constraints.test.ts \
        packages/plan-engine/src/volume-progression.test.ts
git commit -m "feat: add 0-10 and 10-25 mileage brackets to plan engine"
```

---

### Task 4: Update web app UI and wiring

Update the weekly mileage step to show 6 activity-level cards with km ranges, add badge support to OnboardingCard, and expand the web-level type and validation wiring.

**Files:**
- Modify: `apps/web/components/onboarding/onboarding-card.tsx`
- Modify: `apps/web/components/onboarding/steps/step-weekly-mileage.tsx`
- Modify: `apps/web/components/onboarding/types.ts:36`
- Modify: `apps/web/app/plan/page.tsx:66`

- [ ] **Step 1: Add `badge` prop to `OnboardingCard`**

`apps/web/components/onboarding/onboarding-card.tsx` — full file replacement:

```tsx
import { cn } from "@workspace/ui/lib/utils"

interface OnboardingCardProps {
  label: string
  description?: string
  badge?: string
  selected: boolean
  onClick: () => void
}

export function OnboardingCard({ label, description, badge, selected, onClick }: OnboardingCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full cursor-pointer rounded-xl border p-5 text-left transition-all",
        selected
          ? "ring-2 ring-primary bg-primary/5 border-primary/20"
          : "border-border bg-card hover:bg-muted/50"
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="font-medium">{label}</div>
          {description && (
            <div className="mt-1 text-sm text-muted-foreground">{description}</div>
          )}
        </div>
        {badge && (
          <div className="shrink-0 text-xs text-muted-foreground">{badge}</div>
        )}
      </div>
    </button>
  )
}
```

The `flex items-center justify-between` wrapper div is always rendered — this is a minor DOM structure change for all callers, but has no visual effect when `badge` is omitted because a single flex child fills the container normally. All existing callers pass no `badge` and their rendered output is unchanged.

- [ ] **Step 2: Rewrite `step-weekly-mileage.tsx`**

Replace the entire file:

```tsx
"use client"

import { useState } from "react"
import { OnboardingCard } from "../onboarding-card"
import type { StepProps } from "../types"

type MileageRange = "0-10" | "10-25" | "25-40" | "40-60" | "60-80" | "80-plus"

const KM_OPTIONS: { value: MileageRange; label: string; description: string; badge: string }[] = [
  { value: "0-10",   label: "Just getting started", description: "Little or no current running",              badge: "0–10 km/wk"  },
  { value: "10-25",  label: "Occasional runner",     description: "1–2 runs a week, mostly short",            badge: "10–25 km/wk" },
  { value: "25-40",  label: "Regular runner",        description: "3–4 days/week, comfortable up to ~10 km",  badge: "25–40 km/wk" },
  { value: "40-60",  label: "Consistent runner",     description: "4–5 days/week, regular long runs",         badge: "40–60 km/wk" },
  { value: "60-80",  label: "Club runner",           description: "5–6 days/week, comfortable at distance",   badge: "60–80 km/wk" },
  { value: "80-plus",label: "High mileage runner",   description: "6–7 days/week, high weekly volume",        badge: "80+ km/wk"   },
]

const MILES_OPTIONS: { value: MileageRange; label: string; description: string; badge: string }[] = [
  { value: "0-10",   label: "Just getting started", description: "Little or no current running",              badge: "0–6 mi/wk"   },
  { value: "10-25",  label: "Occasional runner",     description: "1–2 runs a week, mostly short",            badge: "6–15 mi/wk"  },
  { value: "25-40",  label: "Regular runner",        description: "3–4 days/week, comfortable up to ~10 km",  badge: "15–25 mi/wk" },
  { value: "40-60",  label: "Consistent runner",     description: "4–5 days/week, regular long runs",         badge: "25–37 mi/wk" },
  { value: "60-80",  label: "Club runner",           description: "5–6 days/week, comfortable at distance",   badge: "37–50 mi/wk" },
  { value: "80-plus",label: "High mileage runner",   description: "6–7 days/week, high weekly volume",        badge: "50+ mi/wk"   },
]

export function StepWeeklyMileage({ formData, onNext }: Pick<StepProps, "formData" | "onNext">) {
  const [selected, setSelected] = useState<MileageRange | undefined>(formData.weeklyMileageRange)
  const units = formData.units ?? "km"
  const options = units === "miles" ? MILES_OPTIONS : KM_OPTIONS

  function handleSelect(value: MileageRange) {
    setSelected(value)
    setTimeout(() => onNext({ weeklyMileageRange: value }), 150)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          How would you describe your current running?
        </h2>
        <p className="text-sm text-muted-foreground">
          Pick the one that fits best — we'll build your plan from here.
        </p>
      </div>
      <div className="space-y-3">
        {options.map((opt) => (
          <OnboardingCard
            key={opt.value}
            label={opt.label}
            description={opt.description}
            badge={opt.badge}
            selected={selected === opt.value}
            onClick={() => handleSelect(opt.value)}
          />
        ))}
      </div>
    </div>
  )
}
```

Note: the heading no longer mentions km vs miles since the description is activity-level. The badge handles the unit-specific display.

- [ ] **Step 3: Update `onboarding/types.ts` local union**

`apps/web/components/onboarding/types.ts:36` — expand `weeklyMileageRange`:
```ts
weeklyMileageRange?: "0-10" | "10-25" | "25-40" | "40-60" | "60-80" | "80-plus"
```

- [ ] **Step 4: Update `plan/page.tsx` validation**

`apps/web/app/plan/page.tsx:66-69` — expand `validRanges`; default fallback stays `"40-60"`:
```ts
const validRanges = ["0-10", "10-25", "25-40", "40-60", "60-80", "80-plus"]
input.weeklyMileageRange = validRanges.includes(rawRange ?? "")
  ? (rawRange as PlanGenerationInput["weeklyMileageRange"])
  : "40-60"
```

The default fallback remains `"40-60"` — if `weeklyMileageRange` is missing from sessionStorage (e.g., old cached session), this gives a reasonable mid-range plan rather than a potentially broken one. Users with stale sessions will see an outdated plan; they should regenerate via the onboarding flow.

- [ ] **Step 5: Run typecheck**

```bash
pnpm typecheck
```

Expected: clean. No type errors across the monorepo.

- [ ] **Step 6: Run all plan-engine tests**

```bash
pnpm --filter @workspace/plan-engine test
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/onboarding/onboarding-card.tsx \
        apps/web/components/onboarding/steps/step-weekly-mileage.tsx \
        apps/web/components/onboarding/types.ts \
        apps/web/app/plan/page.tsx
git commit -m "feat: 6-option activity-level mileage selector with km badges"
```
