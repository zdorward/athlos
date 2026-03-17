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

Remove `description: string`. It is not optional — it is gone. The UI infers workout context from `type`, `distanceKm`, `targetPace`, and `targetHR`.

```typescript
// Before
WorkoutDay {
  date: string
  type: WorkoutType
  distanceKm?: number
  description: string       // ← removed
  completed?: boolean
  targetHR?: string
  targetPace?: string
  effort?: "hard" | "good" | "easy"
}

// After
WorkoutDay {
  date: string
  type: WorkoutType
  distanceKm?: number
  completed?: boolean
  targetHR?: string
  targetPace?: string
  effort?: "hard" | "good" | "easy"
}
```

No DB migration needed. Existing saved plans have descriptions in JSONB; new plans won't. Both are valid.

### API Route: `POST /api/generate-plan`

**Before:** Streaming NDJSON, rate-limited via Upstash, 10–30s response
**After:** Synchronous JSON, no rate limiting, <5ms response

```typescript
// Response shape (unchanged fields, no streaming)
{
  days: WorkoutDay[]
  totalWeeks: number
  totalKm: number
  peakWeekKm: number
  phases: PhaseEntry[]
}
```

Remove Upstash rate limiting dependency from this route (no API costs to protect).

### Frontend: `apps/web/app/plan/page.tsx`

**Deleted:**
- `ReadableStream` / NDJSON parsing loop
- `_meta` first-line handling
- "Generating week #N..." progress state
- Stream accumulation logic

**Replaced with:**
```typescript
const res = await fetch('/api/generate-plan', { method: 'POST', body: ... })
const plan = await res.json()
// Bridge runs + strength injection proceed as before
```

**Staggered reveal animation:**
- Plan data arrives instantly; weeks animate in sequentially
- Each week row gets `animationDelay: ${weekIndex * 30}ms` inline style
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
  startDate: string                    // ISO date, first Monday of plan
  selectedDays: string[]               // ["mon", "wed", "fri", "sat"]
  longRunDay: string                   // "sat"
  phases: PhaseEntry[]                 // from computePhases()
  totalWeeks: number
  peakWeeklyKm: number
  trainingStructure: TrainingStructure // from computeTrainingStructure()
  longRunTargets: LongRunTargets       // from computeLongRunTargets()
  paceZones: PaceZones                 // from calculatePaceZones()
}
```

### Volume Progression

New module `volume-progression.ts` computes a target weekly volume for each week:

1. **Week 1:** lower bound of user's `weeklyMileageRange`
2. **Weeks 2–N:** +8–10% per week (Pfitzinger 10% rule)
3. **Recovery weeks:** every 4th week, drop to ~70% of prior week
4. **Taper:** fixed reductions in final 2–3 weeks (e.g., -20% week 1 taper, -40% week 2)
5. **Cap:** never exceeds `peakWeeklyKm`

### Per-Week Slot Allocation

For each week, slots are assigned in priority order:

#### 1. Long Run
- Day: always `longRunDay`
- Distance: `min(peakLongRunKm × progressFactor, weeklyKm × 0.35)`
- Pace: `paceZones.longRun`
- Type: `"long"`

#### 2. Quality Sessions
- Count determined by phase and `trainingStructure.maxQualitySessions`:
  - **General Fitness:** 0
  - **Base:** 1/week — `"tempo"`
  - **Build:** 1–2/week — alternating `"tempo"` and `"intervals"`
  - **Peak:** 2/week — `"intervals"` and `"mp"`
  - **Taper:** 0–1/week — `"tempo"` only
- Distance: ~12% of weekly volume each
- Placement rules:
  - Never on consecutive days
  - Never the day immediately before or after `longRunDay`
  - If no valid slot exists, degrade to `"easy"` (no error thrown)
- Pace: matched to type (`threshold` for tempo, `vo2max` for intervals, `mp` for MP)

#### 3. Easy Runs
- All remaining running days in `selectedDays`
- Distance: remaining weekly volume divided evenly
- Pace: `paceZones.easy`
- Type: `"easy"`

#### 4. Rest Days
- All days of the week not in `selectedDays`
- Type: `"rest"`, no `distanceKm`, no `targetPace`

### Pace Assignment by Workout Type

| Type | Pace Zone |
|------|-----------|
| `easy` | `paceZones.easy` |
| `long` | `paceZones.longRun` |
| `medium-long` | `paceZones.mediumLong` |
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

- Unit test `volume-progression.ts`: verify progressive overload, recovery week drops, taper
- Unit test `workout-scheduler.ts`: verify placement rules, quality session constraints, distance allocation
- Snapshot test: given fixed inputs, output is identical across runs (determinism)
- Integration test: full `POST /api/generate-plan` round-trip returns valid plan shape
