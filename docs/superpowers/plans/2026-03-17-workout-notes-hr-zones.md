# Workout Notes and HR Zones Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add static instructional notes and HR zone labels to the workout day detail view.

**Architecture:** Two new exported functions in `workout-utils.ts` — `getWorkoutNote` and `getHRZone` — both pure lookups with no dependencies on external state. `plan-day-detail.tsx` calls them in view mode only. No schema changes, no scheduler changes.

**Tech Stack:** TypeScript (strict), React 19, Next.js 16 App Router, Vitest, Tailwind CSS v4, pnpm monorepo.

---

## File Map

| File | Change |
|------|--------|
| `apps/web/app/plan/workout-utils.ts` | Add `getWorkoutNote` and `getHRZone` |
| `apps/web/app/plan/plan-day-detail.tsx` | Render note + default HR zone in view mode |

---

## Task 1: Add `getWorkoutNote` and `getHRZone` to `workout-utils.ts`

**Files:**
- Modify: `apps/web/app/plan/workout-utils.ts`

### Background

`workout-utils.ts` already exports `formatDistance` and `distanceUnit` — use them for the progression note. `WorkoutDay` is imported from `@workspace/plan-engine`. The file already imports `WorkoutType` and `WorkoutDay`.

### The two functions

```ts
export function getWorkoutNote(day: WorkoutDay, units: "km" | "miles"): string {
  switch (day.type) {
    case "easy":
      return "Keep it genuinely easy — conversational pace throughout."
    case "long":
      return "Easy effort throughout. Protect your quality sessions."
    case "progression": {
      if (day.distanceKm == null) return "Last 25–30% at marathon pace."
      const mpKm = day.distanceKm * 0.25
      return `Last ${formatDistance(mpKm, units)} ${distanceUnit(units)} at marathon pace.`
    }
    case "medium-long":
      return "Comfortably aerobic — slightly harder than easy."
    case "mp":
      return "Marathon pace throughout — race-specific effort."
    case "tempo":
      return "Comfortably hard — lactate threshold pace."
    case "intervals":
      return "Hard efforts with full recovery between reps."
    case "strength":
      return "Heavy resistance training after your run — compound lifts at ≥80% 1RM. Focus: squats, deadlifts, single-leg work. Plyometrics optional as a complement."
    case "rest":
      return "Full recovery day."
    case "race":
      return "Race day — execute your plan."
  }
}

export function getHRZone(type: WorkoutType): string {
  switch (type) {
    case "easy":        return "Zone 1"
    case "long":        return "Zone 1"
    case "progression": return "Zone 1 / Zone 3 finish"
    case "medium-long": return "Zone 1–2"
    case "mp":          return "Zone 3"
    case "tempo":       return "Zone 3–4"
    case "intervals":   return "Zone 4–5"
    case "strength":
    case "rest":
    case "race":        return "—"
  }
}
```

- [ ] **Step 1: Add `getWorkoutNote` to `workout-utils.ts`**

Append the `getWorkoutNote` function above at the end of the file, after `getTaperWeeks`.

- [ ] **Step 2: Add `getHRZone` to `workout-utils.ts`**

Append `getHRZone` immediately after `getWorkoutNote`.

- [ ] **Step 3: Run typecheck**

```bash
cd /Users/zackdorward/dev/athlos && pnpm typecheck 2>&1 | tail -6
```
Expected: no errors. TypeScript will enforce exhaustiveness on both switches since `WorkoutType` is a union.

- [ ] **Step 4: Commit**

```bash
cd /Users/zackdorward/dev/athlos
git add apps/web/app/plan/workout-utils.ts
git commit -m "$(cat <<'EOF'
feat: add getWorkoutNote and getHRZone to workout-utils

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Render note and HR zone in `plan-day-detail.tsx`

**Files:**
- Modify: `apps/web/app/plan/plan-day-detail.tsx`

### Background

The view mode (non-edit) `return` block starts at line 227. Current structure:

```
<div>  ← header: date label + h2 workout name (lines 238–258)
<div>  ← distance block (lines 260–270), guarded by distanceKm != null
<div>  ← Target HR Zone (lines 272–277)
<div>  ← Target Pace (lines 279–284)
button ← Mark as complete / Completed (lines 286–303)
```

Two changes:
1. **Note** — insert below the `<h2>` workout name, before the distance block. Only shown when `day.type !== "rest"`. Uses `getWorkoutNote(day, units)`.
2. **HR Zone** — change `day.targetHR ?? "—"` to `day.targetHR ?? getHRZone(day.type)`.

### Import addition

Add `getWorkoutNote` and `getHRZone` to the import from `./workout-utils`:

```ts
import {
  WORKOUT_NAMES,
  WORKOUT_TEXT_CLASS,
  getWorkoutColor,
  formatDistance,
  distanceUnit,
  getWorkoutNote,
  getHRZone,
} from "./workout-utils"
```

### Note element

Insert this block between the closing `</div>` of the header block and the opening `<div>` of the distance block:

```tsx
{day.type !== "rest" && (
  <p className="text-sm text-muted-foreground">
    {getWorkoutNote(day, units)}
  </p>
)}
```

### HR Zone change

Find the existing line:
```tsx
<p className="text-sm text-subtle-foreground">{day.targetHR ?? "—"}</p>
```
Change to:
```tsx
<p className="text-sm text-subtle-foreground">{day.targetHR ?? getHRZone(day.type)}</p>
```

- [ ] **Step 1: Update the import in `plan-day-detail.tsx`**

Add `getWorkoutNote` and `getHRZone` to the `workout-utils` import.

- [ ] **Step 2: Insert the note element**

In the view-mode return block, insert the note `<p>` between the header `</div>` and the distance `<div>`.

- [ ] **Step 3: Update the HR zone fallback**

Change `day.targetHR ?? "—"` to `day.targetHR ?? getHRZone(day.type)`.

- [ ] **Step 4: Run typecheck**

```bash
cd /Users/zackdorward/dev/athlos && pnpm typecheck 2>&1 | tail -6
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/zackdorward/dev/athlos
git add apps/web/app/plan/plan-day-detail.tsx
git commit -m "$(cat <<'EOF'
feat: show workout notes and HR zones in day detail

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Final verification

- [ ] **Step 1: Run typecheck**

```bash
cd /Users/zackdorward/dev/athlos && pnpm typecheck 2>&1 | tail -6
```
Expected: no errors.

- [ ] **Step 2: Run lint**

```bash
cd /Users/zackdorward/dev/athlos && pnpm lint 2>&1 | tail -10
```
Expected: 0 errors.

- [ ] **Step 3: Manual smoke test**

```bash
pnpm dev
```

Generate a plan. Open the day detail for:
- A **progression run** — note should say "Last X km at marathon pace." (where X = ~25% of the run distance), HR zone "Zone 1 / Zone 3 finish"
- An **easy run** — note "Keep it genuinely easy — conversational pace throughout.", HR zone "Zone 1"
- A **tempo run** — note "Comfortably hard — lactate threshold pace.", HR zone "Zone 3–4"
- A **strength day** — note the full compound lifts description, HR zone "—"
- A **rest day** — no note shown, HR zone "—"

Also verify: if a workout has a user-edited `targetHR`, that value shows (not the computed zone).
