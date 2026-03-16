# Units Propagation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix km/miles unit preference so settings changes propagate immediately everywhere, and new users get a locale-based default.

**Architecture:** Three independent changes — (1) a shared utility file for locale detection and race distance formatting, (2) threading units through the onboarding flow so labels display correctly, (3) fixing the settings save to refresh the session cache and persisting the preference on plan save.

**Tech Stack:** Next.js 16 App Router, React 19, Better Auth (`authClient.updateUser` for session-aware updates), TypeScript, pnpm monorepo (verify with `pnpm typecheck` and `pnpm lint`).

**Spec:** `docs/superpowers/specs/2026-03-15-units-propagation-design.md`

---

## File Map

| Status | File | Purpose |
|---|---|---|
| Create | `apps/web/lib/units.ts` | `detectUnits()` and `formatRaceDistance()` utilities |
| Modify | `apps/web/components/onboarding/types.ts` | Add `units` field to `OnboardingData` |
| Modify | `apps/web/components/onboarding/steps/step-weekly-mileage.tsx` | Dynamic km/miles labels |
| Modify | `apps/web/components/onboarding/final-screen.tsx` | Dynamic race distance via `formatRaceDistance` |
| Modify | `apps/web/components/onboarding/onboarding-flow.tsx` | Init units from session/locale; `LeftPanel` units prop; delete dead `DISTANCE_KM` constant |
| Modify | `apps/web/app/(app)/settings/page.tsx` | Use `authClient.updateUser` instead of custom PATCH |
| Modify | `apps/web/app/plan/page.tsx` | Persist units to DB after plan save |

---

## Chunk 1: Utilities and types

### Task 1: Create `lib/units.ts`

**Files:**
- Create: `apps/web/lib/units.ts`

- [ ] **Step 1.1: Create the file**

```ts
// apps/web/lib/units.ts

export function detectUnits(): "km" | "miles" {
  if (typeof navigator === "undefined") return "km"
  return navigator.language === "en-US" ? "miles" : "km"
}

export function formatRaceDistance(
  distance: "5k" | "10k" | "half" | "full" | "ultra",
  units: "km" | "miles",
): string {
  if (units === "miles") {
    const map: Record<string, string> = {
      "5k": "3.1 mi",
      "10k": "6.2 mi",
      "half": "13.1 mi",
      "full": "26.2 mi",
      "ultra": "Ultra",
    }
    return map[distance] ?? distance
  }
  const map: Record<string, string> = {
    "5k": "5 km",
    "10k": "10 km",
    "half": "21.1 km",
    "full": "42.2 km",
    "ultra": "Ultra",
  }
  return map[distance] ?? distance
}
```

- [ ] **Step 1.2: Typecheck**

```bash
pnpm typecheck
```

Expected: no new errors.

- [ ] **Step 1.3: Commit**

```bash
git add apps/web/lib/units.ts
git commit -m "feat: add units detection and race distance formatting utilities"
```

---

### Task 2: Add `units` to `OnboardingData`

**Files:**
- Modify: `apps/web/components/onboarding/types.ts`

- [ ] **Step 2.1: Add the field**

In `apps/web/components/onboarding/types.ts`, add one line inside the existing `OnboardingData` interface — after `weeklyMileageRange`:

```ts
  weeklyMileageRange?: "under-40" | "40-60" | "60-80" | "80-plus"
  units?: "km" | "miles"   // ← add this line
```

Do not replace the whole file — only insert this line. The rest of the file (other types, constants, `getSteps`, etc.) is untouched.

- [ ] **Step 2.2: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors (the field is optional so existing code remains valid).

- [ ] **Step 2.3: Commit**

```bash
git add apps/web/components/onboarding/types.ts
git commit -m "feat: add units field to OnboardingData"
```

---

## Chunk 2: Onboarding UI

### Task 3: Update `StepWeeklyMileage` for dynamic labels

**Files:**
- Modify: `apps/web/components/onboarding/steps/step-weekly-mileage.tsx`

- [ ] **Step 3.1: Replace the file contents**

```tsx
// apps/web/components/onboarding/steps/step-weekly-mileage.tsx
"use client"

import { useState } from "react"
import { OnboardingCard } from "../onboarding-card"
import type { StepProps } from "../types"

type MileageRange = "under-40" | "40-60" | "60-80" | "80-plus"

const KM_OPTIONS: { value: MileageRange; label: string; description: string }[] = [
  { value: "under-40", label: "Under 40 km/week",  description: "Building base fitness" },
  { value: "40-60",   label: "40–60 km/week",      description: "Solid recreational runner" },
  { value: "60-80",   label: "60–80 km/week",      description: "Committed club runner" },
  { value: "80-plus", label: "80+ km/week",         description: "High mileage athlete" },
]

const MILES_OPTIONS: { value: MileageRange; label: string; description: string }[] = [
  { value: "under-40", label: "Under 25 mi/week",  description: "Building base fitness" },
  { value: "40-60",   label: "25–37 mi/week",      description: "Solid recreational runner" },
  { value: "60-80",   label: "37–50 mi/week",      description: "Committed club runner" },
  { value: "80-plus", label: "50+ mi/week",         description: "High mileage athlete" },
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
          {units === "miles"
            ? "How many miles do you run per week?"
            : "How many kilometres do you run per week?"}
        </h2>
        <p className="text-sm text-muted-foreground">
          This sets your starting volume for week 1 of the plan.
        </p>
      </div>
      <div className="space-y-3">
        {options.map((opt) => (
          <OnboardingCard
            key={opt.value}
            label={opt.label}
            description={opt.description}
            selected={selected === opt.value}
            onClick={() => handleSelect(opt.value)}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3.2: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3.3: Commit**

```bash
git add apps/web/components/onboarding/steps/step-weekly-mileage.tsx
git commit -m "feat: dynamic km/miles labels in weekly mileage step"
```

---

### Task 4: Update `FinalScreen` race distance labels

**Files:**
- Modify: `apps/web/components/onboarding/final-screen.tsx`

- [ ] **Step 4.1: Replace local `DISTANCE_KM` with `formatRaceDistance`**

Do all three of these edits in one pass (removing the constant and adding the import must be atomic — the file won't compile in between):

1. Remove the local `DISTANCE_KM` constant (lines ~13–19 — the block starting with `const DISTANCE_KM`).
2. Add the import at the top of the file:

```ts
import { formatRaceDistance } from "@/lib/units"
```

3. Replace the usage of `DISTANCE_KM[race.distance]` (in the `distanceLabel` line) with:

```ts
const distanceLabel = isRace ? formatRaceDistance(race.distance, formData.units ?? "km") : null
```

The full updated relevant section (for reference):

```tsx
export function FinalScreen({ formData }: FinalScreenProps) {
  const router = useRouter()
  const { race, goal, selectedDays, longRunDay, goalTime, strengthDays } = formData

  // ...

  const isRace = goal === "race" && race
  const distanceLabel = isRace ? formatRaceDistance(race.distance, formData.units ?? "km") : null
  // rest unchanged
```

- [ ] **Step 4.2: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4.3: Commit**

```bash
git add apps/web/components/onboarding/final-screen.tsx
git commit -m "feat: dynamic race distance label in final screen"
```

---

### Task 5: Update `OnboardingFlow` — init units, `LeftPanel` props, remove dead constant

**Files:**
- Modify: `apps/web/components/onboarding/onboarding-flow.tsx`

This task has three sub-changes applied in one pass to the same file.

- [ ] **Step 5.1: Add imports**

At the top of `apps/web/components/onboarding/onboarding-flow.tsx`, add:

```ts
import { authClient } from "@/lib/auth-client"
import { detectUnits, formatRaceDistance } from "@/lib/units"
```

- [ ] **Step 5.2: Delete the dead `DISTANCE_KM` constant**

Remove the entire block (lines ~27–33):

```ts
// DELETE THIS ENTIRE BLOCK:
const DISTANCE_KM: Record<string, string> = {
  "5k":   "5 km",
  "10k":  "10 km",
  "half": "21.1 km",
  "full": "42.2 km",
  "ultra": "Ultra",
}
```

- [ ] **Step 5.3: Add `units` to `LeftPanel` props and update its internals**

Update `LeftPanel`'s props interface:

```ts
function LeftPanel({
  race,
  steps,
  currentStep,
  isComplete,
  units,
}: {
  race?: RaceData
  steps: readonly string[]
  currentStep: number
  isComplete: boolean
  units: "km" | "miles"
}) {
```

Inside `LeftPanel`, replace the line that used `DISTANCE_KM`:

```tsx
// Before:
{DISTANCE_KM[race.distance]}

// After:
{formatRaceDistance(race.distance, units)}
```

- [ ] **Step 5.4: Initialize units on mount in `OnboardingFlow`**

Inside `OnboardingFlow`, add `useSession` and the units init `useEffect`. Add after the existing state declarations:

```ts
const { data: sessionData, isPending: sessionPending } = authClient.useSession()

useEffect(() => {
  if (formData.units) return        // already set in restored draft — skip
  if (sessionPending) return        // wait for session to resolve
  const sessionUnits = (sessionData?.user as { units?: "km" | "miles" } | undefined)?.units
  setFormData((prev) => ({ ...prev, units: sessionUnits ?? detectUnits() }))
}, [sessionData, sessionPending, formData.units])
```

- [ ] **Step 5.5: Pass `units` prop to `LeftPanel`**

In the `return` of `OnboardingFlow`, update the `<LeftPanel>` usage:

```tsx
<LeftPanel
  race={formData.race}
  steps={steps}
  currentStep={currentStep}
  isComplete={isComplete}
  units={formData.units ?? "km"}
/>
```

- [ ] **Step 5.6: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 5.7: Lint**

```bash
pnpm lint
```

Expected: no new lint errors.

- [ ] **Step 5.8: Commit**

```bash
git add apps/web/components/onboarding/onboarding-flow.tsx
git commit -m "feat: thread units through onboarding flow with locale detection"
```

---

## Chunk 3: Persistence

### Task 6: Fix settings page — use `authClient.updateUser`

**Files:**
- Modify: `apps/web/app/(app)/settings/page.tsx`

- [ ] **Step 6.1: Replace the fetch call in `handleUnitsChange`**

In `apps/web/app/(app)/settings/page.tsx`, find `handleUnitsChange` and replace the body:

```ts
// Before:
async function handleUnitsChange(value: "km" | "miles") {
  if (value === displayedUnits) return
  setPendingUnits(value)
  setSaving(true)
  try {
    const res = await fetch("/api/user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ units: value }),
    })
    if (!res.ok) throw new Error("Save failed")
  } catch {
    setPendingUnits(null)
  } finally {
    setSaving(false)
  }
}

// After:
async function handleUnitsChange(value: "km" | "miles") {
  if (value === displayedUnits) return
  setPendingUnits(value)
  setSaving(true)
  try {
    await authClient.updateUser({ units: value })
  } catch {
    setPendingUnits(null)
  } finally {
    setSaving(false)
  }
}
```

- [ ] **Step 6.2: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors. `inferAdditionalFields` makes `units` a valid field on `authClient.updateUser`.

- [ ] **Step 6.3: Manual smoke test**

Start dev server (`pnpm dev`), sign in, go to Settings, toggle units from km → miles. Verify:
- The toggle updates immediately
- Navigate to dashboard — units should reflect the change without a hard refresh
- Navigate back to Settings — the toggle should still show "miles"

- [ ] **Step 6.4: Commit**

```bash
git add apps/web/app/(app)/settings/page.tsx
git commit -m "fix: use authClient.updateUser to refresh session on units change"
```

---

### Task 7: Persist units preference on plan save

**Files:**
- Modify: `apps/web/app/plan/page.tsx`

- [ ] **Step 7.1: Add the `authClient.updateUser` call inside `savePlanToServer`**

In `apps/web/app/plan/page.tsx`, `savePlanToServer` is defined at line ~343. After the successful save (after `if (!res.ok) throw new Error("Save failed")`), there is a `return true`. We need to persist units just before returning.

However, `savePlanToServer` doesn't have access to `sessionData` or `input` directly — it's a standalone async function. The cleanest approach: add a `unitsToSync?: "km" | "miles"` parameter:

```ts
async function savePlanToServer(
  planInput: PlanGenerationInput,
  days: WorkoutDay[],
  totalWeeks: number,
  totalKm: number,
  peakWeekKm: number,
): Promise<boolean> {
  setIsSaving(true)
  setSaveError(false)
  try {
    const res = await fetch("/api/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: planInput, days, totalWeeks, totalKm, peakWeekKm }),
    })
    if (res.status === 401) {
      setShowSignInSheet(true)
      return false
    }
    if (!res.ok) throw new Error("Save failed")
    // Sync units preference to DB so all pages reflect the correct unit on session read
    await authClient.updateUser({ units: planInput.units })
    return true
  } catch {
    setSaveError(true)
    return false
  } finally {
    setIsSaving(false)
  }
}
```

The key change is adding `await authClient.updateUser({ units: planInput.units })` after the successful save. Since `savePlanToServer` already receives `planInput`, no signature change is needed.

Note: `authClient` is already imported at the top of this file (`import { authClient } from "@/lib/auth-client"`).

- [ ] **Step 7.2: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 7.3: Manual smoke test (new user flow)**

1. Clear sessionStorage and sign out
2. Go through onboarding with a US-locale browser — verify "miles" labels appear in the weekly mileage step
3. Complete onboarding, generate and save a plan
4. Go to Settings — verify units shows "miles"
5. Go to Dashboard and plan view — verify distances shown in miles

- [ ] **Step 7.4: Manual smoke test (existing user flow)**

1. Sign in as a user who has "km" set in Settings
2. Go through onboarding again (create a new plan)
3. Verify onboarding shows "km" labels (session preference respected over locale)
4. Save the plan — verify Settings still shows "km"

- [ ] **Step 7.5: Commit**

```bash
git add apps/web/app/plan/page.tsx
git commit -m "feat: persist locale-detected units to DB on plan save"
```

---

## Done

All tasks complete. Verify end-to-end:

```bash
pnpm typecheck && pnpm lint
```

Expected: clean.
