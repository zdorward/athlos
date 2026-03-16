# Marathon-Only Distances Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Narrow the product's supported race distances to `"half" | "full"` only, removing 5K, 10K, and ultra from the type system and all dependent code.

**Architecture:** Start with the root `Distance` type in `onboarding/types.ts` — this is the source of truth for the web app. Then fix the cascade in web app files, then the AI package. The typecheck is the verification gate at each stage. No runtime behaviour changes; this is pure type narrowing and dead code removal.

**Tech Stack:** TypeScript, Next.js 16, pnpm monorepo (run all commands from repo root `/Users/zackdorward/dev/athlos`).

---

## Task 1: Narrow root `Distance` type and remove 10K races

**Files:**
- Modify: `apps/web/components/onboarding/types.ts`
- Modify: `apps/web/data/races.ts`

- [ ] **Narrow `Distance` in `types.ts`**

  Replace the type and labels:

  ```ts
  // apps/web/components/onboarding/types.ts
  export type Distance = "half" | "full"

  export const DISTANCE_LABELS: Record<Distance, string> = {
    "half": "Half Marathon",
    "full": "Full Marathon",
  }
  ```

  The rest of the file (`Day`, `DAY_LABELS`, `ORDERED_DAYS`, `RaceData`, `OnboardingData`, `StepProps`, `getSteps`) is unchanged.

- [ ] **Remove the two 10K races from `races.ts`**

  Delete the entire object for `toronto-yonge-10k-2026`:
  ```ts
  {
    id: "toronto-yonge-10k-2026",
    name: "Sporting Life 10K",
    city: "Toronto",
    province: "ON",
    date: "2026-05-10",
    distance: "10k",
    url: "https://sportinglife10k.ca/",
  },
  ```

  Delete the entire object for `sun-run-10k-2026`:
  ```ts
  {
    id: "sun-run-10k-2026",
    name: "Vancouver Sun Run",
    city: "Vancouver",
    province: "BC",
    date: "2026-04-19",
    distance: "10k",
    url: "https://www.vancouversunrun.com/",
  },
  ```

  No other entries in `races.ts` have `distance: "5k"` or `distance: "ultra"` — no other removals needed.

- [ ] **Run typecheck to see the cascade errors**

  ```bash
  cd /Users/zackdorward/dev/athlos && pnpm typecheck 2>&1 | head -60
  ```

  Expected: errors in `units.ts`, `workout-utils.ts`, `plan/page.tsx`, `plan-calendar.tsx`, `plan-feed.tsx`, `packages/ai/src/types.ts`, `packages/ai/src/race-prompt.ts`. This is expected — the errors guide the next tasks.

- [ ] **Commit**

  ```bash
  git add apps/web/components/onboarding/types.ts apps/web/data/races.ts
  git commit -m "refactor: narrow Distance type to half/full and remove 10K races"
  ```

---

## Task 2: Fix web app cascade

**Files:**
- Modify: `apps/web/lib/units.ts`
- Modify: `apps/web/app/plan/workout-utils.ts`
- Modify: `apps/web/app/plan/page.tsx`
- Modify: `apps/web/app/plan/plan-calendar.tsx`
- Modify: `apps/web/app/plan/plan-feed.tsx`

- [ ] **Fix `units.ts` — narrow parameter and remove dead map entries**

  Replace the entire `formatRaceDistance` function:

  ```ts
  export function formatRaceDistance(
    distance: "half" | "full",
    units: "km" | "miles",
  ): string {
    if (units === "miles") {
      const map: Record<string, string> = {
        "half": "13.1 mi",
        "full": "26.2 mi",
      }
      return map[distance] ?? distance
    }
    const map: Record<string, string> = {
      "half": "21.1 km",
      "full": "42.2 km",
    }
    return map[distance] ?? distance
  }
  ```

- [ ] **Fix `workout-utils.ts` — narrow parameter and remove dead branch**

  Replace `getTaperWeeks`:

  ```ts
  export function getTaperWeeks(distance?: "half" | "full"): number {
    if (!distance) return 0
    return 3
  }
  ```

  The `if (distance === "5k" || distance === "10k") return 2` branch is removed — all supported distances use a 3-week taper.

- [ ] **Fix `apps/web/app/plan/page.tsx` line ~71 — narrow the `mapToInput` cast**

  Find this line in the `mapToInput` function:
  ```ts
  distance: race["distance"] as "5k" | "10k" | "half" | "full" | "ultra",
  ```

  Replace with:
  ```ts
  distance: race["distance"] as "half" | "full",
  ```

- [ ] **Fix `plan-calendar.tsx` — narrow `raceDistance` prop type**

  Find `PlanCalendarProps` interface. Change:
  ```ts
  raceDistance?: "5k" | "10k" | "half" | "full" | "ultra"
  ```
  To:
  ```ts
  raceDistance?: "half" | "full"
  ```

- [ ] **Fix `plan-feed.tsx` — narrow `raceDistance` prop type**

  Find `PlanFeedProps` interface. Change:
  ```ts
  raceDistance?: "5k" | "10k" | "half" | "full" | "ultra"
  ```
  To:
  ```ts
  raceDistance?: "half" | "full"
  ```

- [ ] **Run typecheck — expect only AI package errors remaining**

  ```bash
  cd /Users/zackdorward/dev/athlos && pnpm typecheck 2>&1 | grep -v "packages/ai" | head -30
  ```

  Expected: zero errors outside `packages/ai`. If there are web app errors, fix them before proceeding.

- [ ] **Commit**

  ```bash
  git add apps/web/lib/units.ts apps/web/app/plan/workout-utils.ts apps/web/app/plan/page.tsx apps/web/app/plan/plan-calendar.tsx apps/web/app/plan/plan-feed.tsx
  git commit -m "refactor: fix Distance cascade in web app files"
  ```

---

## Task 3: Fix AI package

**Files:**
- Modify: `packages/ai/src/types.ts`
- Modify: `packages/ai/src/race-prompt.ts`

**Important context:** `packages/ai/src/pace-calculator.ts` uses its own `PaceInput` interface with a broad distance union `"5k" | "10k" | "half" | "full"`. This is intentional — it is a pure math utility. Do NOT modify `pace-calculator.ts` or `pace-calculator.test.ts`.

- [ ] **Fix `packages/ai/src/types.ts` — narrow `PlanGenerationInput.race.distance`**

  Find the `race` property inside `PlanGenerationInput`. It currently has:
  ```ts
  distance: "5k" | "10k" | "half" | "full" | "ultra"
  ```

  Change to:
  ```ts
  distance: "half" | "full"
  ```

- [ ] **Fix `packages/ai/src/race-prompt.ts` — remove dead `DISTANCE_KM_MAP` entries**

  Find `DISTANCE_KM_MAP` (near the top of the file, after the imports):
  ```ts
  const DISTANCE_KM_MAP: Record<string, number> = {
    "5k": 5, "10k": 10, half: 21.1, full: 42.2, ultra: 80,
  }
  ```

  Replace with:
  ```ts
  const DISTANCE_KM_MAP: Record<string, number> = {
    half: 21.1, full: 42.2,
  }
  ```

- [ ] **Fix `packages/ai/src/race-prompt.ts` — remove `ultra` guards at both call sites**

  There are two occurrences of this pattern (in the `calculatePaceZones` call and the `calculateRawGoalPace` call):
  ```ts
  distance: distance === "ultra" ? "full" : distance as "5k" | "10k" | "half" | "full"
  ```

  Replace both occurrences with:
  ```ts
  distance: distance
  ```

  Search for the pattern `distance === "ultra"` to locate both occurrences.

- [ ] **Run full typecheck — expect zero errors**

  ```bash
  cd /Users/zackdorward/dev/athlos && pnpm typecheck
  ```

  Expected: zero errors. If errors remain, fix them before committing.

- [ ] **Commit**

  ```bash
  git add "packages/ai/src/types.ts" "packages/ai/src/race-prompt.ts"
  git commit -m "refactor: fix Distance cascade in AI package"
  ```
