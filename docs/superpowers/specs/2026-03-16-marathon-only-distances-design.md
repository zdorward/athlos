# Marathon-Only Distances — Design Spec

**Date:** 2026-03-16
**Status:** Approved

---

## Overview

Narrow the product's supported race distances to full marathon and half marathon only. Athlos targets BQ-qualifying athletes training with Pfitzinger methodology — 5K, 10K, and ultra distances are out of scope. The `Distance` type should reflect this so the type system enforces the constraint everywhere.

No UI layout changes. No new components.

---

## Changes

### `apps/web/components/onboarding/types.ts`

Narrow `Distance` and remove the corresponding `DISTANCE_LABELS` entries.

Old:
```ts
export type Distance = "5k" | "10k" | "half" | "full" | "ultra"

export const DISTANCE_LABELS: Record<Distance, string> = {
  "5k":    "5K",
  "10k":   "10K",
  "half":  "Half Marathon",
  "full":  "Full Marathon",
  "ultra": "Ultra",
}
```

New:
```ts
export type Distance = "half" | "full"

export const DISTANCE_LABELS: Record<Distance, string> = {
  "half": "Half Marathon",
  "full": "Full Marathon",
}
```

---

### `apps/web/data/races.ts`

Remove the two 10K races currently in the array:
- `toronto-yonge-10k-2026` (Sporting Life 10K, Toronto, ON)
- `sun-run-10k-2026` (Vancouver Sun Run, Vancouver, BC)

No 5K or ultra races exist in the array — no other removals needed.

---

### `apps/web/lib/units.ts`

Narrow the `formatRaceDistance` parameter type and remove the unreachable map entries.

Old:
```ts
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

New:
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

---

### `apps/web/app/plan/workout-utils.ts`

Narrow the `getTaperWeeks` parameter type and remove the dead branch. All supported distances are marathon-distance (half and full), so all plans use a 3-week taper.

Old:
```ts
export function getTaperWeeks(distance?: "5k" | "10k" | "half" | "full" | "ultra"): number {
  if (!distance) return 0
  if (distance === "5k" || distance === "10k") return 2
  return 3
}
```

New:
```ts
export function getTaperWeeks(distance?: "half" | "full"): number {
  if (!distance) return 0
  return 3
}
```

---

### `packages/ai/src/types.ts`

Narrow `PlanGenerationInput.race.distance` from the full union to `"half" | "full"`.

Old:
```ts
distance: "5k" | "10k" | "half" | "full" | "ultra"
```

New:
```ts
distance: "half" | "full"
```

---

### `packages/ai/src/race-prompt.ts`

Remove the `ultra` guard in the two `calculatePaceZones` / `calculateRawGoalPace` call sites. After narrowing `PlanGenerationInput.race.distance`, `distance` is already `"half" | "full"` — the cast and guard are dead code.

Old (both occurrences):
```ts
distance: distance === "ultra" ? "full" : distance as "5k" | "10k" | "half" | "full"
```

New (both occurrences):
```ts
distance: distance
```

---

## Downstream effects (no code changes required)

- **Manual entry dropdown** (`step-find-race.tsx`): uses `Object.entries(DISTANCE_LABELS)` — automatically reflects the narrowed type
- **Landing page race search** (`page.tsx`): uses `RACES` directly — 10K races disappear once removed from the array
- **TypeScript**: any remaining code referencing `"5k"`, `"10k"`, or `"ultra"` as `Distance` will surface as a compile error — expected and desirable

---

## Intentionally left broad

**`packages/ai/src/pace-calculator.ts`** — `PaceInput.distance` retains `"5k" | "10k" | "half" | "full"`. The pace calculator is a pure math utility (Riegel formula) not tied to the product's `Distance` type. Its tests use 10K as a convenient reference input. The narrowing at `PlanGenerationInput.race.distance` in `packages/ai/src/types.ts` is the correct enforcement point — no 5K/10K race data can reach the pace calculator from user input after that change.

---

## Files

- Modify: `apps/web/components/onboarding/types.ts`
- Modify: `apps/web/data/races.ts`
- Modify: `apps/web/lib/units.ts`
- Modify: `apps/web/app/plan/workout-utils.ts`
- Modify: `packages/ai/src/types.ts`
- Modify: `packages/ai/src/race-prompt.ts`

---

## Out of Scope

- Adding new full or half marathon races
- UI changes to the race search or manual entry form
- Plan generation logic changes
- `packages/ai/src/pace-calculator.ts` (intentionally left broad — see above)
