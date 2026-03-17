# Pure Calculation Plan Engine

**Date:** 2026-03-16
**Status:** Draft

## Overview

Refactor plan generation from LLM-based (Claude streaming NDJSON) to a fully deterministic, pure-calculation engine. The LLM currently acts as a constrained fill-in-the-blank generator; all meaningful decisions (volume, pace zones, phase structure, training structure) are already computed before the LLM is called. This refactor replaces the LLM with an explicit rule-based scheduler, eliminating API costs, latency, and non-determinism.

## Goals

- Identical inputs always produce identical plans (determinism)
- Plan generation completes in <5ms (vs. 10–30s streaming)
- Remove all LLM infrastructure (Anthropic SDK, prompt builder, rate limiting)
- Drop `description` from `WorkoutDay` — UI infers workout context from type, distance, and pace
- Rename `packages/ai` → `packages/plan-engine`

## What Changes

### Package: `packages/ai` → `packages/plan-engine`

All import paths referencing `@workspace/ai` are updated to `@workspace/plan-engine` across the monorepo. Turbo pipeline configuration (`turbo.json`, `package.json` workspace references) is updated accordingly.

**Deleted:**
- `providers/claude.ts` — Anthropic SDK integration
- `race-prompt.ts` — prompt builder
- `provider.ts` — AIProvider interface
- `config.ts` — AI_PROVIDER / AI_MODEL env config

**Added:**
- `workout-scheduler.ts` — core rule-based plan scheduler (replaces LLM)
- `volume-progression.ts` — weekly volume targets (progressive overload, recovery weeks, taper)

**Unchanged (calculation logic):**
- `pace-calculator.ts`
- `phases.ts`
- `training-structure.ts`
- `long-run-targets.ts`
- `bridge-runs.ts`
- `strength-recommendation.ts`
- `adaptation.ts`

### Type: `WorkoutDay`

Remove `description` from the type definition — it is gone entirely, not optional.

`effort` remains on the type but is never set by the scheduler. It is added in-place by the workout log endpoint when a user submits a completed workout. The scheduler always omits it.

`completed` is similarly omitted by the scheduler and set by the workout log endpoint.

```typescript
// WorkoutDay — full stored shape (some fields only present after workout logging)
WorkoutDay {
  date: string
  type: WorkoutType
  distanceKm?: number
  targetHR?: string
  targetPace?: string
  completed?: boolean           // omitted on generation; set to true by workout log endpoint
  effort?: "hard" | "good" | "easy"  // omitted on generation; set by workout log endpoint
}
```

The workout log endpoint patches the `WorkoutDay` object in-place within the `days` JSONB array on the `plans` record. There is no separate log document — the same object transitions from generated to logged by mutation.

**Preconditions (validated by the API route, returning 400 if violated):**
- `selectedDays.length >= 2` (long run day plus at least one other running day)
- `longRunDay` is in `selectedDays`
- Lower bound of `weeklyMileageRange` ≤ `peakWeeklyKm` (prevents plan where ramp immediately hits ceiling)

**Existing saved plans:** `description` is silently ignored by the UI going forward. No DB migration needed — JSONB columns tolerate extra fields. Descriptions were LLM-generated boilerplate, not user data.

### API Route: `POST /api/generate-plan`

**Before:** Streaming NDJSON, rate-limited via Upstash, 10–30s response
**After:** Synchronous JSON, no rate limiting, <5ms response

```typescript
// Response shape
{
  days: WorkoutDay[]
  totalWeeks: number
  totalKm: number     // sum of days[].distanceKm ?? 0; display-only, not used in downstream calculations
  peakWeekKm: number  // max value from weeklyVolumes array (actual generated peak, not the input peakWeeklyKm ceiling)
  phases: PhaseEntry[]
}
```

`totalKm` is display-only. Due to 0.5 km rounding of individual workout distances, the summed total may differ slightly from the theoretical sum; this is acceptable.

`peakWeekKm` is the maximum of the generated `weeklyVolumes` array — the actual highest-volume week in the plan. For shorter plans where the 10% ramp never reaches the input `peakWeeklyKm` ceiling, this value will be less than `peakWeeklyKm`.

Both values are derived by the API route after the scheduler returns `days[]`. The scheduler does not return aggregate stats.

Remove Upstash rate limiting dependency from this route (no API costs to protect).

### Frontend: `apps/web/app/plan/page.tsx`

**Deleted:**
- `ReadableStream` / NDJSON parsing loop
- `_meta` first-line handling
- "Generating week #N..." progress state
- Stream accumulation logic

**Replaced with:**
```typescript
const controller = new AbortController()
const res = await fetch('/api/generate-plan', { method: 'POST', body: ..., signal: controller.signal })
const plan = await res.json()
// Bridge runs + strength injection proceed as before
```

If the user triggers a new generation while one is in flight, the prior `AbortController` is aborted before starting the new fetch. This prevents overlapping animation states.

**Staggered reveal animation:**
- `isNewlyGenerated` is an in-memory React state flag — not persisted to localStorage or sessionStorage
- Set to `true` immediately before the fetch
- Set to `false` after save completes OR on save failure — either way the animation does not replay
- If the user navigates away before saving, the flag is lost — on return they see the plan without animation (acceptable; they can regenerate if needed)
- While `isNewlyGenerated` is true, each week row gets `animationDelay: ${weekIndex * 30}ms` inline style
- 18-week plan fully revealed in ~540ms
- Implemented with CSS `@keyframes` fade-in — no new dependencies

**Unchanged:**
- Bridge run merge
- Strength day injection
- Save flow
- Cross-tab localStorage preservation
- All plan display components (`plan-calendar.tsx`, `plan-feed.tsx`, `plan-header.tsx`, `plan-day-detail.tsx`)

---

## Core Algorithm: `workout-scheduler.ts`

The scheduler receives all pre-computed inputs and returns `WorkoutDay[]`.

### Inputs

```typescript
interface SchedulerInput {
  startDate: string                      // ISO date, first Monday of plan
  selectedDays: string[]                 // ["mon", "wed", "fri", "sat"] — must have ≥ 2 days
  longRunDay: string                     // "sat" — must be in selectedDays
  weeklyMileageRange: WeeklyMileageRange // e.g. "40-60" — determines week 1 starting volume
  phases: PhaseEntry[]                   // from computePhases()
  totalWeeks: number
  peakWeeklyKm: number                   // ceiling for volume ramp; lower bound of weeklyMileageRange must be ≤ this
  trainingStructure: TrainingStructure   // from computeTrainingStructure()
  longRunTargets: LongRunTargets         // from computeLongRunTargets(); contains peakLongRunKm
  paceZones: PaceZones                   // from calculatePaceZones()
}
```

### Volume Progression (`volume-progression.ts`)

Signature: `computeWeeklyVolumes(input: VolumeProgressionInput): number[]`

Returns an array of length `totalWeeks` where each entry is the target km for that week. Weeks are 1-indexed in the rules below (week 1 = index 0 of the returned array).

```typescript
interface VolumeProgressionInput {
  totalWeeks: number
  weeklyMileageRange: WeeklyMileageRange  // starting volume
  peakWeeklyKm: number
  phases: PhaseEntry[]  // used to identify taper phase weeks
}
```

Rules are checked in this exact order; the first matching rule wins:

1. **Taper weeks:** If a week falls within the taper phase, use fixed reductions from `peakWeeklyKm`. Taper overrides all other rules:
   - First taper week: 80% of peak
   - Second taper week: 60% of peak
   - Third taper week (if exists): 40% of peak
2. **Final non-taper week** (only when there is no taper phase — i.e. `week === totalWeeks`): treated as a standard progression week. This rule explicitly takes priority over rule 3 — if the final non-taper week happens to be `weekNumber % 4 === 0`, the recovery rule is still suppressed.
3. **Recovery weeks:** `weekNumber % 4 === 0` (1-indexed). Only reaches this rule for non-taper, non-final weeks. Volume = 70% of the prior week's volume.
4. **Week 1:** Lower bound of `weeklyMileageRange` (e.g. `"40-60"` → 40 km)
5. **All other weeks:** Prior week's volume × 1.10 (fixed 10% — Pfitzinger's 10% rule)
6. **Cap (always applied after the rule above):** result is `Math.min(result, peakWeeklyKm)`. This ensures `weeklyKm` never exceeds `peakWeeklyKm`.

### Per-Week Slot Allocation

The scheduler iterates over weeks 1–N. For each week it:
1. Looks up `weeklyKm` from `computeWeeklyVolumes()`
2. Determines the week's phase from `phases[]`
3. Assigns slots in priority order: long run → quality sessions → easy runs → rest days

#### Adjacency definition

For the purposes of quality session placement, "adjacent to `longRunDay`" means the calendar day immediately before or immediately after `longRunDay` within a Mon–Sun week ordering. Days are ordered Mon(0)–Sun(6); adjacency does not wrap (Sun is not adjacent to Mon of the same week).

#### 1. Long Run
- Day: always `longRunDay`
- `progressFactor` = `Math.min(weeklyKm / peakWeeklyKm, 1.0)` — clamped to [0, 1]. Since rule 6 of `computeWeeklyVolumes` guarantees `weeklyKm ≤ peakWeeklyKm`, this clamp is a safety guard; it will not change values in practice but prevents floating-point overshoot from producing long runs larger than `peakLongRunKm`.
- Raw distance: `peakLongRunKm × progressFactor` (where `peakLongRunKm` = `longRunTargets.peakLongRunKm`)
- Final distance: `min(rawDistance, weeklyKm × 0.35)`
  - In high-volume weeks the raw distance is typically the binding constraint
  - In low-volume early weeks the 35% cap may bind, keeping the long run proportional to the week's total
- Pace: `paceZones.longRun`
- Type: `"long"`

#### 2. Quality Sessions

**Count per phase:**
- **General Fitness:** 0
- **Base:** 1/week — `"tempo"`
- **Build (first half):** 1/week — type alternates by local week index within Build phase: even local index → `"tempo"`, odd local index → `"intervals"`
  - "First half" = local index < `Math.floor(buildPhaseLength / 2)`
  - If `buildPhaseLength < 2` (1-week Build): `Math.floor(1/2) = 0`, so there is no first half — the single week falls into second half but gets only 1 session (`"tempo"`). The 2-session count is suppressed to avoid overloading a 1-week build transition.
- **Build (second half):** 2/week — `"tempo"` placed first, then `"intervals"`. Exception: if `buildPhaseLength < 2`, second half gets only 1 session (`"tempo"`).
  - "Second half" = local index ≥ `Math.floor(buildPhaseLength / 2)`
- **Peak:** 2/week — `"intervals"` placed first, then `"mp"`
- **Taper:** 1 in first taper week (`"tempo"`), 0 in remaining taper weeks
- Count is also capped by `trainingStructure.maxQualitySessions`

**Distance:** 12% of `weeklyKm` per session, rounded to nearest 0.5 km

**Placement (applied sequentially, one session at a time, in the order listed above):**

For each quality session that needs to be placed:
1. Collect candidate days: running days in `selectedDays` that are not `longRunDay`, not already assigned to any workout type, not adjacent to `longRunDay` (per the adjacency definition above), and not consecutive with an already-placed quality session
2. If one or more candidates exist: place the quality session on the first available candidate in day-of-week order (Mon < Tue < … < Sun)
3. If no candidates exist: the session is **dropped** — no day is assigned to it and it does not appear in the output. Its planned distance (12% of weeklyKm) is not subtracted from the easy run volume calculation, so that volume rolls naturally into the easy pool. Any running days that were not claimed by the long run or a successfully placed quality session are picked up as easy runs in step 3. Note: with 2-day `selectedDays` schedules (long run + 1 other day), quality sessions will always drop because the only non-long-run day is adjacent to or consecutive with the long run. The resulting volume shortfall (easy cap may prevent full distribution) is accepted.

**Pace:** `threshold` for tempo, `vo2max` for intervals, `mp` for MP

#### 3. Easy Runs
- All remaining running days in `selectedDays` after long run and quality sessions are placed (including days freed by degradation)
- Total easy volume: `weeklyKm − longRunKm − sum(actualQualitySessionKm)` where `actualQualitySessionKm` sums only successfully placed quality sessions
- Distributed evenly across easy days, rounded to nearest 0.5 km; remainder (from rounding) added to the first easy day
- Each easy run is capped at `longRunKm − 1 km`. If this cap prevents distributing all easy volume, the shortfall is accepted. No minimum weekly volume floor is enforced. Shortfalls are not reported to the caller.
- Pace: `paceZones.easy`
- Type: `"easy"`

#### 4. Rest Days
- All days of the week not in `selectedDays`
- Type: `"rest"`, no `distanceKm`, no `targetPace`

### `medium-long` Workout Type

`medium-long` is a valid `WorkoutType` with a corresponding pace zone (`paceZones.mediumLong`), but the scheduler does not assign it in v1. Reserved for a future enhancement (replacing the second-longest easy run in high-mileage Build/Peak weeks with 5+ running days). Not included in the pace assignment table below.

### Pace Assignment by Workout Type

| Type | Pace Zone |
|------|-----------|
| `easy` | `paceZones.easy` |
| `long` | `paceZones.longRun` |
| `tempo` | `paceZones.threshold` |
| `intervals` | `paceZones.vo2max` |
| `mp` | `paceZones.mp` |
| `rest` | none |

---

## What Stays the Same

- **Adaptation logic** (`adaptation.ts`) — workout log analysis and suggestion generation are unaffected
- **Bridge runs** (`bridge-runs.ts`) — pre-plan gap filling is unaffected
- **Strength injection** — phase-aware strength day merging in `plan/page.tsx` is unaffected
- **Database schema** — `plans` table JSONB fields are compatible with new `WorkoutDay` shape
- **Onboarding** — no changes to input collection
- **All plan display UI** — components don't care how data was generated

## Dependencies Removed

- `@anthropic-ai/sdk` from `packages/plan-engine`
- Upstash rate limiting from `/api/generate-plan`
- `AI_PROVIDER`, `AI_MODEL`, `ANTHROPIC_API_KEY` environment variables

## Testing Considerations

- Unit test `volume-progression.ts`:
  - Progressive overload at exactly 10% per week
  - Recovery week at `weekNumber % 4 === 0` (1-indexed), not applied in taper or final week
  - Taper week overrides recovery week logic
  - Final week recovery suppression when no taper phase
  - Cap at `peakWeeklyKm`
- Unit test `workout-scheduler.ts`:
  - Adjacency: Mon–Sun ordering, no wrap at week boundary
  - Placement rules (no consecutive quality sessions, none adjacent to long run)
  - Quality session degradation on 2-day schedules; shortfall accepted
  - Easy run distance cap and volume shortfall acceptance
  - Build phase transitions: 1-week Build treated as all-second-half; midpoint split for longer phases
  - Build second half: tempo placed before intervals; Peak: intervals placed before MP
  - Long run: `min(rawDistance, weeklyKm × 0.35)` behavior in both early and peak weeks
- Snapshot test: given fixed inputs, output is identical across runs (determinism)
- Integration test: full `POST /api/generate-plan` round-trip returns valid plan shape, validates all preconditions
