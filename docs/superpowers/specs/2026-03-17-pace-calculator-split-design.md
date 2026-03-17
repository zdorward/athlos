# pace-calculator.ts Split — Three-File Refactor Design

**Date:** 2026-03-17
**Status:** Approved

## Overview

`pace-calculator.ts` currently houses three unrelated responsibilities: pure pace math, phase schedule computation, and goal-derived training parameters. At ~370 lines it has grown large enough that each concern is harder to locate and modify in isolation. This refactor extracts each responsibility into its own file and splits the test file to match.

No public API changes. All existing exports remain available from `index.ts`. Downstream consumers are unaffected.

---

## File Boundaries

### `pace-calculator.ts` (unchanged name)

Pure pace math only. Stays in this file:

- `PaceInput` interface
- `PaceZones` interface
- `DISTANCE_KM`, `CONTEXT_MULTIPLIER`, `ZONES` constants
- `formatPace`, `formatZone` private helpers
- `calculatePaceZones`
- `calculateRawGoalPace`

~100 lines after the move.

### `phase-planner.ts` (new)

Phase schedule computation. Moves here:

- `getTaperMin` (private helper)
- `getPeakMin` (private helper)
- `GF_CAP` constant
- `computePhases`

Imports: `PhaseEntry`, `WeeklyMileageRange` from `./types`.

~80 lines.

### `training-parameters.ts` (new)

Goal-derived training parameters. Moves here:

- `computeGoalPeakMileage`
- `computeTrainingStructure`
- `computeLongRunTargets`

No named imports from `pace-calculator` or `phase-planner`. The `peakWeeklyKm` parameter accepted by `computeLongRunTargets` is typed as the structurally anonymous `{ low: number; high: number } | null` — this shape is the return type of `computeGoalPeakMileage` but no named type alias is shared between the two functions. Keep it anonymous; do not introduce a named type as part of this refactor.

~140 lines.

---

## index.ts Changes

Import sources update; exported names are unchanged:

```ts
// Before (single source)
export {
  calculatePaceZones,
  computePhases,
  computeGoalPeakMileage,
  computeTrainingStructure,
  computeLongRunTargets,
  calculateRawGoalPace,
  type PaceZones,
} from "./pace-calculator"

// After (three sources)
export { calculatePaceZones, calculateRawGoalPace, type PaceZones } from "./pace-calculator"
export { computePhases } from "./phase-planner"
export {
  computeGoalPeakMileage,
  computeTrainingStructure,
  computeLongRunTargets,
} from "./training-parameters"
```

No changes to any other file in `packages/plan-engine/src/` or in `apps/`.

---

## Test File Split

Each test file mirrors its implementation file. The `loSec` helper stays in `pace-calculator.test.ts` (used only by `calculateRawGoalPace` tests).

| Test file | Describe blocks (in file order) |
|-----------|----------------|
| `pace-calculator.test.ts` | `calculatePaceZones` (recent-race, context multipliers, goal-time, invalid input), `calculateRawGoalPace`, `calculatePaceZones — slow runner (no zone overlap)` |
| `phase-planner.test.ts` | All `computePhases` describe blocks (28-week, 16-week, 4-week, 22-week, 21-week boundary, 20-week boundary, 29-week mileage range, 52-week caps, peakMin invariant) |
| `training-parameters.test.ts` | `computeGoalPeakMileage`, `computeTrainingStructure`, `computeLongRunTargets` |

**Updated import in `pace-calculator.test.ts`** (after split):
```ts
import { calculatePaceZones, calculateRawGoalPace } from "./pace-calculator"
```

**Imports in new test files** follow the same `import type` convention as the source files:
```ts
// phase-planner.test.ts
import { computePhases } from "./phase-planner"

// training-parameters.test.ts
import { computeGoalPeakMileage, computeTrainingStructure, computeLongRunTargets } from "./training-parameters"
```

---

## Out of Scope

- No logic changes. All functions move verbatim.
- No new exports or types.
- No changes to `types.ts`, `workout-scheduler.ts`, `volume-progression.ts`, or any app code.
- `PaceInput` type export: `PaceInput` is exported from `pace-calculator.ts` but is **not** re-exported from `index.ts` (pre-existing omission, not introduced by this refactor). Do not add it to `index.ts` as part of this change — preserving the existing public API surface is the goal.

---

## Files Changed

| File | Change |
|------|--------|
| `packages/plan-engine/src/pace-calculator.ts` | Remove `computePhases`, `getTaperMin`, `getPeakMin`, `GF_CAP`, `computeGoalPeakMileage`, `computeTrainingStructure`, `computeLongRunTargets` |
| `packages/plan-engine/src/phase-planner.ts` | New file — `computePhases` and helpers |
| `packages/plan-engine/src/training-parameters.ts` | New file — `computeGoalPeakMileage`, `computeTrainingStructure`, `computeLongRunTargets` |
| `packages/plan-engine/src/index.ts` | Update import sources (3 lines replace 1 block) |
| `packages/plan-engine/src/pace-calculator.test.ts` | Remove `computePhases`, `computeGoalPeakMileage`, `computeTrainingStructure`, `computeLongRunTargets` describe blocks and their imports |
| `packages/plan-engine/src/phase-planner.test.ts` | New file — all `computePhases` tests |
| `packages/plan-engine/src/training-parameters.test.ts` | New file — all training-parameters tests |
