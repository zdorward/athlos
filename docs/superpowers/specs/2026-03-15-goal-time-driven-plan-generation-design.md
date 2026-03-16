# Goal-Time-Driven Plan Generation

**Date:** 2026-03-15
**Status:** Approved

## Problem

The current race plan prompt is dominated by the athlete's weekly mileage range input. The LLM receives a hard "Starting volume (week 1 total): X km" derived from a mileage bucket (30/50/70/90 km), and then builds the entire plan mechanically upward from that anchor using the 10% weekly increase rule. Goal time drives pace zones correctly, but has no influence over the plan's volume structure — how high mileage builds and therefore how ambitious the plan actually is. A runner targeting a 3:00 marathon starting at 40–60 km/week gets a plan that may only peak at 80 km — far below what that goal demands.

## Goal

Make goal time the primary driver of plan generation. Current mileage anchors week 1 only. The plan's overall shape — how high volume builds, what paces are used in training, how aggressively the plan progresses — is determined by the goal time and athlete profile.

## Design

### 1. New Onboarding Fields

Three new fields added to `PlanGenerationInput`:

```ts
recentRace?: {
  distance: "5k" | "10k" | "half" | "full"
  hours: number
  minutes: number
  seconds: number  // capture full precision; do not default to 0 in the UI
  weeksAgo: "under-8" | "8-16" | "16-24"  // 24 weeks ≈ 6 months; upper bound exclusive (e.g. "under-8" = < 8 weeks, "8-16" = 8–15 weeks, "16-24" = 16–23 weeks)
}
firstTimeDistance: boolean
trainingAge: "under-1" | "1-3" | "3-or-more"
```

**`recentRace`** — a race completed within the past 6 months (24 weeks). The `weeksAgo` bucket maps to the existing `context` multiplier in `pace-calculator.ts`:
- `under-8` → `active` (1.0x)
- `8-16` → `short-break` (1.05x)
- `16-24` → `long-break` (1.12x)

Races older than 24 weeks are excluded from the UI — too stale to anchor paces.

**`firstTimeDistance`** — whether the athlete has previously completed this race distance. Signals the LLM to be more conservative in early phases and emphasize completion confidence over performance targets.

**`trainingAge`** — years of consistent running. Controls how aggressively volume can build and how many quality sessions are appropriate in peak weeks:
- `under-1` → conservative build, max 1 quality session/week in all phases
- `1-3` → standard progression
- `3-or-more` → can handle faster volume build, up to 2 quality sessions in peak

### 2. Dual-Source Pace Zones

Pace zones are split into two semantically distinct sets:

**Training zones** — derived from recent race (if provided) using existing `calculatePaceZones` with the appropriate context multiplier, passing `seconds` from `recentRace` directly. If no recent race, derived from goal time with the existing 5% buffer. Covers: Easy, Long Run, Medium-Long, Threshold, VO2max.

**Goal race pace** — derived from goal time using a new `calculateRawGoalPace` function that runs the same Riegel formula as `calculatePaceZones` but skips the 5% buffer and returns only the `mp` zone as a formatted string (e.g. `"5:10–5:20/km"`). Signature: `calculateRawGoalPace(input: PaceInput): string | null`. Returns `null` if the input is invalid (same guard as `calculatePaceZones`). The caller in `race-prompt.ts` reads the returned string directly into the "Goal race pace" block. This is the target the plan is building toward, not a current training stimulus. Used only for `mp` workout types and race-pace segments within long runs.

Both sets are computed in TypeScript and passed to the LLM as two clearly labeled blocks. The LLM uses training zones for `targetPace` on all workouts; `mp` runs use the goal race pace zone.

When no recent race is provided, training zones and goal race pace are both derived from goal time. Training zones use the existing 5% buffer; goal race pace uses `calculateRawGoalPace` (no buffer). This means `mp` runs will be at the raw goal pace even without a recent race — a meaningful improvement over today where both use the same buffered zones.

**Edge case — recent race faster than goal time:** This is valid and expected (e.g. current 3:45 fitness targeting 3:30). Training zones will be faster than goal race pace. The LLM prompt will include a note: "Note: training zones reflect current fitness — they may be faster than goal race pace for athletes whose fitness already exceeds their race target." No special handling required beyond this callout.

**Prompt example for dual pace zone block** (this shows the zone block in isolation — it appears at position 5 in the full user message, after the volume targets section):

```
Training pace zones (current fitness — use for all workouts):
  Easy:         6:30–7:00/km
  Long run:     6:45–7:15/km
  Medium-long:  6:20–6:45/km
  Threshold:    5:45–6:00/km
  VO2max:       5:20–5:35/km

Goal race pace (target — use for mp workouts and race-pace segments only):
  Race pace:    5:10–5:20/km
```

### 3. Goal-Implied Peak Mileage

A new `computeGoalPeakMileage` function in `pace-calculator.ts` with signature:
`computeGoalPeakMileage(distance: string, goalTotalMinutes: number): { low: number; high: number } | null`

Returns `null` for `ultra` distance and for any `goalTotalMinutes <= 0` (invalid input guard). The caller in `race-prompt.ts` omits the peak volume directive entirely when `null` is returned.

**Marathon lookup (total minutes):**
| Goal time | Target peak (km/week) |
|-----------|----------------------|
| < 165 min (2:45) | 110–130 |
| 165–180 min (2:45–3:00) | 95–115 |
| 180–210 min (3:00–3:30) | 80–100 |
| 210–240 min (3:30–4:00) | 65–80 |
| 240–270 min (4:00–4:30) | 55–70 |
| 270+ min (4:30+) | 45–60 |

**Half marathon lookup (total minutes):**
| Goal time | Target peak (km/week) |
|-----------|----------------------|
| < 80 min (1:20) | 80–95 |
| 80–95 min (1:20–1:35) | 65–80 |
| 95–110 min (1:35–1:50) | 55–70 |
| 110–130 min (1:50–2:10) | 45–60 |
| 130+ min (2:10+) | 35–50 |

**10k lookup (total minutes):**
| Goal time | Target peak (km/week) |
|-----------|----------------------|
| < 35 min | 60–75 |
| 35–40 min | 50–65 |
| 40–50 min | 40–55 |
| 50+ min | 30–45 |

**5k lookup (total minutes):**
| Goal time | Target peak (km/week) |
|-----------|----------------------|
| < 18 min | 55–65 |
| 18–22 min | 45–55 |
| 22–28 min | 35–45 |
| 28+ min | 25–35 |

The 5k table is intentionally lower than 10k — 5k-specific training emphasizes intensity over volume.

The target is passed to the LLM as a **soft directive**: the LLM adjusts downward if the training timeline is short (< 12 weeks), the athlete is a first-timer at the distance, or training age is `under-1`.

**Edge case — starting volume already meets or exceeds soft peak target:** When `startingVolume >= peakTarget.low`, the prompt note changes to: "Current weekly volume already meets the target peak range. Prioritize maintaining volume and increasing workout quality rather than further mileage buildup." The LLM should hold volume relatively flat and focus on progressive quality session intensity.

### 4. Prompt Restructuring

The user message is reordered so goal time leads, mileage is explicitly framed as a starting point only, and all goal-relevant context is grouped near the top. The existing `Fitness source: goal time` line is removed — it is replaced by the new dual-block pace zone structure which makes the source explicit.

**New order:**
1. Primary objective (goal time — first, prominent)
2. Athlete profile (training age, first time at distance)
3. Current fitness (recent race if provided, mileage range as "starting point only")
4. Volume targets (week 1 volume → soft peak km/week, or "hold and focus on quality" if already at peak)
5. Pace zones (two labeled blocks: training zones + goal race pace)
6. Schedule (running days, long run day, strength)
7. Phase schedule
8. Week schedule

**Goal time framing (opens the user message):**
> "Primary objective: Run [Race Name] in 3h30m. Every decision in this plan — volume, workout selection, pace targets, phase structure — exists to serve this single goal."

**Mileage framing:**
> "Current weekly mileage (starting point only — does not cap peak volume): 40–60 km/week"
> "Week 1 volume: ~50 km"
> "Target peak volume (soft — scale back if timeline is short or athlete is a first-timer): ~80–100 km/week"

**Athlete profile block (new):**
> "Athlete profile:"
> "  Training age: 1–3 years of consistent running"
> "  First time at this distance: No"

**System prompt — training age guidance (new section):**

Add after the existing Intensity Distribution section:

```
## Athlete Training Age

Apply the following constraints based on the training age in the user message.
When constraints conflict, apply the most restrictive rule (e.g. a 3-or-more year athlete
with only 3 available running days is still capped at 1 quality session/week by the
running-days rule — training age does not override it).

- under-1 year: max 8% weekly volume increase; max 1 quality session/week in all phases;
  no VO2max intervals until the Build phase; emphasise easy aerobic development
- 1-3 years: standard 10% rule; standard quality session limits per existing rules
- 3-or-more years: may increase up to 12% in strong weeks; up to 2 quality sessions from
  mid-Build phase onward (subject to running-days cap)
```

## Data Flow

```
PlanGenerationInput
  ├── goalTime { hours, minutes, seconds }
  │     ├── computeGoalPeakMileage(distance, goalTotalMinutes) → { low, high } | null
  │     └── calculateRawGoalPace({ hours, minutes, seconds: goalTime.seconds ?? 0, distance }) → mp string | null
  ├── recentRace?
  │     ├── calculatePaceZones({ hours, minutes, seconds, distance, context }, "recent-race") → training zones
  │     └── fallback if absent: calculatePaceZones({ ...goalTime, seconds: goalTime.seconds ?? 0, distance }, "goal-time") → training zones
  ├── weeklyMileageRange → startingVolume (week 1 anchor, unchanged)
  ├── startingVolume vs peakRange → volume directive or "hold and focus on quality"
  ├── trainingAge → athlete profile block + system prompt training age guidance
  └── firstTimeDistance → athlete profile block + LLM conservatism signal
```

Note: `goalTime` seconds defaults to `0` when calling `calculateRawGoalPace` if `goalTime` has no `seconds` field (the current `PlanGenerationInput` type only has `hours` and `minutes`). Adding `seconds?: number` to `goalTime` in `types.ts` is included in the files changed so users can optionally provide sub-minute goal precision.

## Files Changed

- `packages/ai/src/types.ts` — add `recentRace`, `firstTimeDistance`, `trainingAge` to `PlanGenerationInput`
- `packages/ai/src/pace-calculator.ts` — add `computeGoalPeakMileage()` and `calculateRawGoalPace()` functions; export both
- `packages/ai/src/pace-calculator.test.ts` — add tests for `computeGoalPeakMileage` and `calculateRawGoalPace`
- `packages/ai/src/race-prompt.ts` — restructure user message, add dual pace zones, add peak mileage target, add athlete profile block, update system prompt with training age guidance, remove `fitnessSource` line
- Onboarding UI — add recent race, first-time distance, and training age questions (separate ticket)

## Out of Scope

- Injury history input
- Age-based recovery adjustments
- Recent race validation (UI responsibility)
- Ultra distance peak mileage targets
