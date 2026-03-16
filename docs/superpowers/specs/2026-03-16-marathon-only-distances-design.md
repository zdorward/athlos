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

Narrow `Distance` from `"5k" | "10k" | "half" | "full" | "ultra"` to `"half" | "full"`.

Remove the corresponding entries from `DISTANCE_LABELS`:

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

### `apps/web/data/races.ts`

Remove the two 10K races currently in the array:
- `toronto-yonge-10k-2026` (Sporting Life 10K, Toronto, ON)
- `sun-run-10k-2026` (Vancouver Sun Run, Vancouver, BC)

No 5K or ultra races exist in the array — no other removals needed.

---

## Downstream effects (no code changes required)

- **Manual entry dropdown** (`step-find-race.tsx`): uses `Object.entries(DISTANCE_LABELS)` — automatically reflects the narrowed type
- **Landing page race search** (`page.tsx`): uses `RACES` directly — 10K races disappear once removed from the array
- **TypeScript**: any code referencing `"5k"`, `"10k"`, or `"ultra"` as `Distance` will surface as a compile error — expected and desirable

---

## Files

- Modify: `apps/web/components/onboarding/types.ts`
- Modify: `apps/web/data/races.ts`

---

## Out of Scope

- Adding new full or half marathon races
- UI changes to the race search or manual entry form
- Plan generation logic changes
