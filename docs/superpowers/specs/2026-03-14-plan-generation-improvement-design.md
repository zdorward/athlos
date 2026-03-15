# Plan Generation Improvement Design

## Goal

Improve plan quality for intermediate runners chasing a PR by adding fitness context to onboarding, computing training paces server-side, expanding the workout type vocabulary, and rewriting the LLM prompt with a proper phase-based coaching framework.

## Architecture

Server-side TypeScript computes pace zones and the phase schedule before calling the LLM. The LLM receives complete, deterministic context — it never does math or decides structure. This makes plan output reliable and consistent across generations.

## Tech Stack

Next.js 16, TypeScript, Claude API (streaming NDJSON), Riegel race equivalence formula for pace zone derivation.

---

## Section 1: New Onboarding Inputs

Two new steps added to the onboarding flow after strength days.

### Step: Weekly mileage (required)

A range picker with four options:

- Under 40 km/week
- 40–60 km/week
- 60–80 km/week
- 80+ km/week

Stored as `weeklyMileageRange: "under-40" | "40-60" | "60-80" | "80-plus"` on `OnboardingData` and `PlanGenerationInput`. Used as the explicit starting volume for week 1 of the plan — the LLM builds from this number rather than guessing.

### Step: Recent race (optional)

User can enter a recent race result: distance (5K / 10K / Half / Full) and finishing time (hours, minutes, seconds). A "Skip" button is available.

- If provided: used as the basis for pace zone calculation (actual fitness)
- If skipped: goal time used with a 5% conservative buffer (aspirational → realistic)

Stored as `recentRace?: { distance: "5k"|"10k"|"half"|"full"; hours: number; minutes: number; seconds: number }`.

---

## Section 2: Server-Side Pace Zone Calculator

New file: `packages/ai/src/pace-calculator.ts`

### Input

```ts
interface PaceInput {
  hours: number
  minutes: number
  seconds: number
  distance: "5k" | "10k" | "half" | "full"
}

interface PaceZones {
  easy: string        // e.g. "6:10–6:40/km"
  longRun: string
  mediumLong: string
  mp: string          // marathon/race pace
  threshold: string
  vo2max: string
  source: "recent-race" | "goal-time"
}
```

### Algorithm

1. Convert race time + distance to a per-km pace
2. If using goal time, apply a 5% conservative buffer (multiply by 1.05)
3. Normalise to equivalent marathon pace using the Riegel formula: `T2 = T1 × (D2/D1)^1.06`
4. Apply zone multipliers to the reference pace:

| Zone | Multiplier (slower than race pace) | Description |
|---|---|---|
| VO2max | 98–102% of 5K pace | Interval pace |
| Threshold | 110–115% of 5K pace | Comfortably hard, 20–40 min sustainable |
| Marathon pace | 107–110% of 5K pace | Goal race pace ±5 sec |
| Medium-long | 120–127% of 5K pace | Moderate easy effort |
| Long run | 120–133% of 5K pace | Conversational |
| Easy | 129–140% of 5K pace | Fully aerobic, recovery |

5. Format each zone as `"M:SS–M:SS/km"` string
6. Return `PaceZones` with `source` field

The function is pure — no side effects, fully testable. Called once in `buildPrompt()` before constructing the user message.

---

## Section 3: Expanded Workout Types

### New types added to `WorkoutType`

```ts
type WorkoutType =
  | "easy"
  | "long"
  | "medium-long"   // NEW — mid-week 60–75% of long run distance
  | "mp"            // NEW — marathon/race pace run
  | "tempo"
  | "intervals"
  | "rest"
  | "race"
  | "strength"
```

### Display config additions in `workout-utils.ts`

| Type | Label | Color treatment |
|---|---|---|
| `medium-long` | Medium-Long | Muted primary (lighter than `long`) |
| `mp` | Race Pace | Warm amber tone (between `easy` and `tempo`) |

Both types carry `distanceKm` and receive `targetPace` from the pace calculator. No other schema changes — `WorkoutDay` already supports all needed fields.

---

## Section 4: Prompt Redesign

### Phase schedule computation (TypeScript, pre-LLM)

Computed from total weeks in `buildPrompt()`:

**≤ 20 weeks — 4 phases:**

| Phase | Proportion |
|---|---|
| Base | 40% |
| Build | 30% |
| Peak | 15% |
| Taper | 15% (min 2 weeks for 5K/10K, 3 for half/full) |

**21+ weeks — 5 phases:**

| Phase | Proportion | Notes |
|---|---|---|
| General Fitness | ~20% | Easy running only, no quality work |
| Base | ~30% | Medium-long runs, strides |
| Build | ~25% | Threshold, early VO2max |
| Peak | ~10% | Race-specific, MP runs |
| Taper | ~15% (min 2–3 weeks) | Volume reduction, maintain intensity |

Example for 28-week plan:
```
General Fitness: weeks 1–6
Base:            weeks 7–14
Build:           weeks 15–21
Peak:            weeks 22–25
Taper:           weeks 26–28
```

Phase schedule injected into the user message as explicit week ranges.

### System prompt — rewritten rules

**Intensity distribution:**
- 80% of weekly volume must be easy, medium-long, or long run pace
- Maximum 2 quality sessions per week (tempo, intervals, mp, medium-long with quality segments)
- If only 3 running days available: max 1 quality session per week

**Weekly structure rules:**
- Never schedule two quality sessions on consecutive days
- The day after the long run must be rest or easy only
- At least one easy/rest day before each quality session

**Phase-specific workout guidance:**

*General Fitness:*
- Easy runs and long runs only
- No threshold, no intervals, no MP work
- Progressive mileage build from the athlete's current weekly volume
- Optional: strides (4–6 × 20 sec) at end of easy runs from week 3 onward

*Base:*
- Easy runs, long runs, medium-long runs
- Strides on easy days
- Introduce one threshold run (20–25 min) in the final week of this phase only

*Build:*
- One threshold session per week (25–40 min or cruise intervals)
- One VO2max session per week in the latter half of this phase
- Medium-long run mid-week
- Long run builds toward peak distance

*Peak:*
- Highest mileage weeks
- MP segments in long runs (e.g. last 10–16 km of long run at MP)
- One VO2max session per week
- One threshold or MP standalone run per week

*Taper:*
- Volume drops 20% in first taper week, 40% in final week(s)
- Maintain workout intensity — do not remove quality sessions, just shorten them
- No new stimuli — familiar workout types only
- Long run reduced to 60–70% of peak long run

**Workout type definitions (in system prompt):**
- `easy` — fully aerobic, conversational pace, use easy zone
- `long` — weekly long run, long run pace, on designated long run day
- `medium-long` — 60–75% of long run distance, medium-long zone, mid-week
- `mp` — at marathon/race pace, use mp zone
- `tempo` — sustained threshold effort 20–40 min, use threshold zone
- `intervals` — short repetitions (600m–1600m) with recovery, use vo2max zone
- `strength` — no distanceKm
- `rest` — full rest, no distanceKm

### User message — updated structure

```
Goal: Race — [name] in [city] on [date] ([dist]km)
Time goal: [time]

Fitness baseline:
  Current weekly mileage: 50–60 km/week
  Starting volume (week 1 total): 55 km
  Fitness source: recent 10K in 47:30

Pace zones (use these exactly for targetPace on every non-rest workout):
  Easy:         6:10–6:40/km
  Long run:     6:00–6:30/km
  Medium-long:  5:55–6:20/km
  Race pace:    5:05–5:15/km
  Threshold:    4:55–5:05/km
  VO2max:       4:35–4:45/km

Available running days: Monday, Wednesday, Thursday, Saturday
Long run day: Saturday
Strength training: none

Phase schedule (follow exactly):
  General Fitness: weeks 1–6
  Base:            weeks 7–14
  Build:           weeks 15–21
  Peak:            weeks 22–25
  Taper:           weeks 26–28

Week schedule (use ONLY these exact dates):
Week 1 [2026-03-16 – 2026-03-22]: ...
```

---

## Section 5: Data Model and File Structure

### Type changes

**`packages/ai/src/types.ts`**
- Add `"medium-long"` and `"mp"` to `WorkoutType`
- Add `weeklyMileageRange: "under-40" | "40-60" | "60-80" | "80-plus"` to `PlanGenerationInput`
- Add `recentRace?: { distance: "5k"|"10k"|"half"|"full"; hours: number; minutes: number; seconds: number }` to `PlanGenerationInput`

**`apps/web/components/onboarding/types.ts`**
- Add `weeklyMileageRange?: "under-40" | "40-60" | "60-80" | "80-plus"` to `OnboardingData`
- Add `recentRace?: { distance: Distance; hours: number; minutes: number; seconds: number }` to `OnboardingData`

### Files created

| File | Purpose |
|---|---|
| `packages/ai/src/pace-calculator.ts` | Riegel formula + zone multipliers → PaceZones |
| `apps/web/components/onboarding/steps/step-weekly-mileage.tsx` | Range picker step |
| `apps/web/components/onboarding/steps/step-recent-race.tsx` | Optional recent race entry with skip |

### Files modified

| File | Change |
|---|---|
| `packages/ai/src/types.ts` | New types, new input fields |
| `packages/ai/src/race-prompt.ts` | Full rewrite — calls pace calculator, builds phase schedule, new system prompt |
| `apps/web/components/onboarding/types.ts` | New OnboardingData fields, new steps in getSteps() |
| `apps/web/components/onboarding/onboarding-flow.tsx` | Wire in two new steps |
| `apps/web/app/plan/workout-utils.ts` | Add medium-long and mp to display config |
| `apps/web/app/dashboard/today-workout-card.tsx` | Handle medium-long and mp types |
| `apps/web/app/plan/final-screen.tsx` | Pass new fields through to sessionStorage |
| `apps/web/app/plan/page.tsx` (mapToInput) | Map new onboarding fields to PlanGenerationInput |

`plan-calendar.tsx`, `plan-feed.tsx`, and `plan-day-detail.tsx` inherit display config from `workout-utils.ts` and require no direct changes.

---

## Error Handling

- If pace calculator receives invalid input (zero time, impossible pace), fall back to goal time with 5% buffer
- If `weeklyMileageRange` is missing for any reason, default to `"40-60"` as a safe middle ground
- Phase schedule always produces at least a taper — even a 4-week plan gets: Base (1 week) → Build (1 week) → Peak (0 weeks) → Taper (2 weeks)

## Out of Scope

- Ultra distance (needs its own prompt and coaching model)
- Age-adjusted recovery (future enhancement)
- Heart rate zones (fields exist on WorkoutDay but not populated in this iteration)
