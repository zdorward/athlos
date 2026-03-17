# Remove Adaptation Logic Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete the entire adaptive training system — adaptation engine, feedback UI, suggestion UI, DB tables, and API routes — leaving one-tap workout completion via the existing PATCH endpoint.

**Architecture:** Work proceeds in dependency order: delete the plan-engine module first (it has no dependents once the API layer is gone), then the DB schema, then the API layer, then the UI. The existing `PATCH /api/plans/[id]` already handles completion — only cleanup is needed there.

**Tech Stack:** Next.js 16 App Router, TypeScript, Drizzle ORM (PostgreSQL), pnpm monorepo with Turbo

---

## Files Changed

| File | Change |
|------|--------|
| `packages/plan-engine/src/adaptation.ts` | Delete |
| `packages/plan-engine/src/adaptation.test.ts` | Delete |
| `packages/plan-engine/src/index.ts` | Remove `export * from "./adaptation"` |
| `packages/plan-engine/src/types.ts` | Remove `effort` field from `WorkoutDay` |
| `packages/db/src/schema.ts` | Remove `workoutLogs` and `adaptationSuggestions` table definitions |
| `packages/db/drizzle/0004_*.sql` | New migration — drop both tables |
| `apps/web/lib/run-adaptation-check.ts` | Delete |
| `apps/web/app/api/plans/[id]/workouts/[date]/log/route.ts` | Delete |
| `apps/web/app/api/plans/[id]/suggestions/[suggestionId]/accept/route.ts` | Delete |
| `apps/web/app/api/plans/[id]/suggestions/[suggestionId]/dismiss/route.ts` | Delete |
| `apps/web/app/api/plans/[id]/route.ts` | Remove `effort` from body type + handler; rename variable |
| `apps/web/app/(app)/dashboard/workout-feedback-sheet.tsx` | Delete |
| `apps/web/app/(app)/dashboard/adaptation-suggestion-card.tsx` | Delete |
| `apps/web/app/(app)/dashboard/dashboard-client.tsx` | Remove adaptation state/handlers/renders; add one-tap `handleComplete` |
| `apps/web/app/(app)/dashboard/today-workout-card.tsx` | Remove `effort` label rendering |

---

## Task 1: Delete the plan-engine adaptation module

**Files:**
- Delete: `packages/plan-engine/src/adaptation.ts`
- Delete: `packages/plan-engine/src/adaptation.test.ts`
- Modify: `packages/plan-engine/src/index.ts`
- Modify: `packages/plan-engine/src/types.ts`

- [ ] **Step 1: Delete adaptation.ts and adaptation.test.ts**

```bash
rm packages/plan-engine/src/adaptation.ts
rm packages/plan-engine/src/adaptation.test.ts
```

- [ ] **Step 2: Remove the adaptation export from index.ts**

In `packages/plan-engine/src/index.ts`, remove line 9:
```
export * from "./adaptation"
```

The file should go from:
```ts
export {
  type WorkoutDay,
  type WorkoutType,
  type TrainingPlan,
  type PlanGenerationInput,
  type PhaseEntry,
} from "./types"
export { buildBridgeRuns, firstMondayOnOrAfter } from "./bridge-runs"
export * from "./adaptation"
export {
  calculatePaceZones,
  ...
```
To the same content with that one line removed.

- [ ] **Step 3: Remove `effort` from WorkoutDay**

In `packages/plan-engine/src/types.ts`, remove line 20:
```ts
  effort?: "hard" | "good" | "easy"
```

`WorkoutDay` should now be:
```ts
export interface WorkoutDay {
  date: string         // ISO "2026-06-16"
  type: WorkoutType
  distanceKm?: number  // always km; omitted for rest days only
  completed?: boolean
  targetHR?: string    // free text, e.g. "Zone 2 (130–145 bpm)"
  targetPace?: string  // free text, e.g. "5:30–6:00/km"
}
```

- [ ] **Step 4: Verify TypeScript compiles in plan-engine**

```bash
pnpm typecheck
```

Expected: no errors in `packages/plan-engine`. (There will be errors in `apps/web` until later tasks — that's fine for now.)

- [ ] **Step 5: Commit**

```bash
git add packages/plan-engine/src/
git commit -m "feat: remove adaptation module from plan-engine"
```

---

## Task 2: Remove adaptation tables from DB schema

**Files:**
- Modify: `packages/db/src/schema.ts`

- [ ] **Step 1: Remove workoutLogs and adaptationSuggestions from schema.ts**

In `packages/db/src/schema.ts`, delete lines 88–134 (the entire `workoutLogs` and `adaptationSuggestions` table definitions). The file currently ends at line 134 after the `adaptationSuggestions` definition — remove everything from line 88 to the end.

The file should end with the closing of the `plans` table:
```ts
  createdAt: timestamp("created_at").notNull().defaultNow(),
})
```

- [ ] **Step 2: Generate Drizzle migration**

Run from the repo root:
```bash
cd packages/db && pnpm db:generate
```

When prompted to name the migration, use: `drop_adaptation_tables`

This generates a new `.sql` file in `packages/db/drizzle/` (e.g. `0004_drop_adaptation_tables.sql`) containing:
```sql
DROP TABLE "adaptation_suggestions";
DROP TABLE "workout_logs";
```

> **Note:** Do NOT run `pnpm db:migrate` yet — that applies the migration to the live database. Save that for deployment. The migration file is what matters for now.

- [ ] **Step 3: Commit**

```bash
cd ../..
git add packages/db/src/schema.ts packages/db/drizzle/
git commit -m "feat: remove workoutLogs and adaptationSuggestions from DB schema"
```

---

## Task 3: Delete server-side adaptation files

**Files:**
- Delete: `apps/web/lib/run-adaptation-check.ts`
- Delete: `apps/web/app/api/plans/[id]/workouts/[date]/log/route.ts`
- Delete: `apps/web/app/api/plans/[id]/suggestions/[suggestionId]/accept/route.ts`
- Delete: `apps/web/app/api/plans/[id]/suggestions/[suggestionId]/dismiss/route.ts`

- [ ] **Step 1: Delete the files**

```bash
rm apps/web/lib/run-adaptation-check.ts
rm apps/web/app/api/plans/\[id\]/workouts/\[date\]/log/route.ts
rm apps/web/app/api/plans/\[id\]/suggestions/\[suggestionId\]/accept/route.ts
rm apps/web/app/api/plans/\[id\]/suggestions/\[suggestionId\]/dismiss/route.ts
```

Also remove the now-empty directories:
```bash
rmdir apps/web/app/api/plans/\[id\]/workouts/\[date\]/log
rmdir apps/web/app/api/plans/\[id\]/workouts/\[date\]
rmdir apps/web/app/api/plans/\[id\]/workouts
rmdir apps/web/app/api/plans/\[id\]/suggestions/\[suggestionId\]/accept
rmdir apps/web/app/api/plans/\[id\]/suggestions/\[suggestionId\]/dismiss
rmdir apps/web/app/api/plans/\[id\]/suggestions/\[suggestionId\]
rmdir apps/web/app/api/plans/\[id\]/suggestions
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: delete adaptation API routes and server orchestration"
```

---

## Task 4: Clean up existing PATCH /api/plans/[id]

**Files:**
- Modify: `apps/web/app/api/plans/[id]/route.ts`

The PATCH handler currently accepts an `effort` field and has logic to write it. Remove that.

- [ ] **Step 1: Update the PATCH handler**

Replace the body type definition and validation logic. Currently (lines 92–115):
```ts
  type FieldUpdate = {
    type?: WorkoutType
    distanceKm?: number | null
    targetHR?: string
    targetPace?: string
  }
  const body = (await req.json()) as {
    date?: string
    type?: WorkoutType
    completed?: boolean
    effort?: "hard" | "good" | "easy"
    update?: FieldUpdate
  }

  const isFieldUpdate = body.update !== undefined
  const isCompletionOrEffort = !isFieldUpdate && (body.completed !== undefined || body.effort !== undefined)

  if (!isFieldUpdate && !isCompletionOrEffort) {
    return Response.json({ error: "Bad request" }, { status: 400 })
  }

  if ((isCompletionOrEffort || isFieldUpdate) && (body.date === undefined || body.type === undefined)) {
    return Response.json({ error: "Bad request" }, { status: 400 })
  }
```

Replace with:
```ts
  type FieldUpdate = {
    type?: WorkoutType
    distanceKm?: number | null
    targetHR?: string
    targetPace?: string
  }
  const body = (await req.json()) as {
    date?: string
    type?: WorkoutType
    completed?: boolean
    update?: FieldUpdate
  }

  const isFieldUpdate = body.update !== undefined
  const isCompletion = !isFieldUpdate && body.completed !== undefined

  if (!isFieldUpdate && !isCompletion) {
    return Response.json({ error: "Bad request" }, { status: 400 })
  }

  if ((isCompletion || isFieldUpdate) && (body.date === undefined || body.type === undefined)) {
    return Response.json({ error: "Bad request" }, { status: 400 })
  }
```

- [ ] **Step 2: Remove the effort-writing block**

Currently (lines 146–154):
```ts
    } else {
      if (body.completed !== undefined) entry.completed = body.completed
      if (body.effort !== undefined) {
        if (!["hard", "good", "easy"].includes(body.effort)) {
          return Response.json({ error: "Bad request" }, { status: 400 })
        }
        entry.effort = body.effort
      }
    }
```

Replace with:
```ts
    } else {
      if (body.completed !== undefined) entry.completed = body.completed
    }
```

- [ ] **Step 3: Update the isCompletionOrEffort references**

The variable was renamed to `isCompletion` in Step 1. Confirm no other references to `isCompletionOrEffort` remain in the file.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/plans/\[id\]/route.ts
git commit -m "feat: remove effort handling from plan PATCH endpoint"
```

---

## Task 5: Delete adaptation UI components

**Files:**
- Delete: `apps/web/app/(app)/dashboard/workout-feedback-sheet.tsx`
- Delete: `apps/web/app/(app)/dashboard/adaptation-suggestion-card.tsx`

- [ ] **Step 1: Delete the files**

```bash
rm "apps/web/app/(app)/dashboard/workout-feedback-sheet.tsx"
rm "apps/web/app/(app)/dashboard/adaptation-suggestion-card.tsx"
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: delete workout feedback sheet and adaptation suggestion card"
```

---

## Task 6: Update dashboard-client.tsx

**Files:**
- Modify: `apps/web/app/(app)/dashboard/dashboard-client.tsx`

- [ ] **Step 1: Remove adaptation imports (lines 12–13)**

Delete:
```ts
import { WorkoutFeedbackSheet, type AdaptationSuggestion } from "./workout-feedback-sheet"
import { AdaptationSuggestionCard } from "./adaptation-suggestion-card"
```

- [ ] **Step 2: Remove adaptation state (lines 67–68)**

Delete:
```ts
  const [feedbackEntry, setFeedbackEntry] = useState<WorkoutDay | null>(null)
  const [suggestion, setSuggestion] = useState<AdaptationSuggestion | null>(null)
```

- [ ] **Step 3: Replace all adaptation handlers with a single handleComplete**

Delete these five functions (lines 110–151):
- `handleComplete` (lines 110–112) — opens feedback sheet, not needed
- `handleFeedbackDismiss` (lines 114–130) — contains the completion logic we want to keep
- `handleFeedbackLogged` (lines 132–142)
- `handleSuggestionAccepted` (lines 144–147)
- `handleSuggestionDismissed` (lines 149–151)

Replace them with a single handler that uses the optimistic-update pattern from the old `handleFeedbackDismiss`:
```ts
  function handleComplete(entry: WorkoutDay) {
    const prevDays = resolvedPlan.days
    const updated = resolvedPlan.days.map((d: WorkoutDay) =>
      d.date === entry.date && d.type === entry.type ? { ...d, completed: true } : d
    )
    setPlan((p) => (typeof p === "string" ? p : { ...p, days: updated } as Plan))
    fetch(`/api/plans/${resolvedPlan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: entry.date, type: entry.type, completed: true }),
    }).catch(() => {
      setPlan((p) => (typeof p === "string" ? p : { ...p, days: prevDays } as Plan))
    })
  }
```

- [ ] **Step 4: Remove AdaptationSuggestionCard render and suggestion conditional**

Delete lines 205–212:
```tsx
            {suggestion && (
              <AdaptationSuggestionCard
                suggestion={suggestion}
                planId={resolvedPlan.id}
                onAccepted={handleSuggestionAccepted}
                onDismissed={handleSuggestionDismissed}
              />
            )}
```

- [ ] **Step 5: Remove WorkoutFeedbackSheet render**

Delete lines 268–274:
```tsx
      <WorkoutFeedbackSheet
        open={feedbackEntry !== null}
        entry={feedbackEntry}
        planId={resolvedPlan.id}
        onLogged={handleFeedbackLogged}
        onDismiss={handleFeedbackDismiss}
      />
```

- [ ] **Step 6: Update onComplete wiring**

The `TodayWorkoutCard` `onComplete` prop currently calls `() => handleComplete(entry)`. After replacing `handleComplete`, this is already correct — the arrow function passes the entry to the new handler. No change needed here.

- [ ] **Step 7: Commit**

```bash
git add "apps/web/app/(app)/dashboard/dashboard-client.tsx"
git commit -m "feat: replace feedback flow with one-tap workout completion"
```

---

## Task 7: Remove effort rendering from today-workout-card.tsx

**Files:**
- Modify: `apps/web/app/(app)/dashboard/today-workout-card.tsx`

- [ ] **Step 1: Remove the effort label block**

In the completed state render, delete lines 45–49:
```tsx
            {entry.effort && (
              <p className="text-xs text-green-600/60 dark:text-green-500/60 mt-0.5">
                {entry.effort === "hard" ? "😓 Hard" : entry.effort === "good" ? "😊 Good" : "⚡ Easy"}
              </p>
            )}
```

- [ ] **Step 2: Commit**

```bash
git add "apps/web/app/(app)/dashboard/today-workout-card.tsx"
git commit -m "feat: remove effort label from completed workout card"
```

---

## Task 8: Final verification

- [ ] **Step 1: Run type checking**

```bash
pnpm typecheck
```

Expected: zero errors.

- [ ] **Step 2: Run lint**

```bash
pnpm lint
```

Expected: zero errors or warnings.

- [ ] **Step 3: Run build**

```bash
pnpm build
```

Expected: successful build with no type errors.

- [ ] **Step 4: Manual smoke test**

Start the dev server:
```bash
pnpm dev
```

Verify:
1. Dashboard loads without errors
2. Tapping "Mark Complete" on a workout immediately marks it complete (green checkmark, no sheet opens)
3. No feedback sheet appears anywhere
4. No adaptation suggestion card appears
5. Completed workouts show name + distance but no effort label

- [ ] **Step 5: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "chore: final cleanup after adaptation logic removal"
```
