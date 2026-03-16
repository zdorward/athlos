# Goal-Time-Driven Plan Generation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make goal time the primary driver of race plan generation by adding dual-source pace zones, a goal-implied peak mileage target, and new athlete profile fields — so the LLM builds toward the goal rather than mechanically from the starting mileage.

**Architecture:** Three backend changes (types → pace-calculator → race-prompt), no new files. The types update adds `recentRace`, `firstTimeDistance`, and `trainingAge` to `PlanGenerationInput`. Two new pure functions in `pace-calculator.ts` compute goal-implied peak mileage and raw goal race pace. The prompt builder in `race-prompt.ts` is restructured to lead with goal time and use dual pace zone blocks.

**Tech Stack:** TypeScript, Vitest (test runner: `pnpm --filter @workspace/ai test`)

---

## Chunk 1: Types + Pace Calculator Functions

### Task 1: Add new fields to `PlanGenerationInput`

**Files:**
- Modify: `packages/ai/src/types.ts`

- [ ] **Step 1: Add new fields**

Open `packages/ai/src/types.ts`. Add to `PlanGenerationInput` (after the existing `weeklyMileageRange` field):

```ts
export interface PlanGenerationInput {
  goal: "race"
  race: {
    name: string
    date: string
    distance: "5k" | "10k" | "half" | "full" | "ultra"
    city: string
  }
  goalTime?: { hours: number; minutes: number; seconds?: number }
  selectedDays: string[]
  longRunDay: string
  units: "km" | "miles"
  strengthTraining: boolean
  strengthDays?: string[]
  startDate?: string
  weeklyMileageRange: "under-40" | "40-60" | "60-80" | "80-plus"
  recentRace?: {
    distance: "5k" | "10k" | "half" | "full"
    hours: number
    minutes: number
    seconds: number
    weeksAgo: "under-8" | "8-16" | "16-24"
  }
  firstTimeDistance?: boolean
  trainingAge?: "under-1" | "1-3" | "3-or-more"
}
```

Note: `firstTimeDistance` and `trainingAge` are optional so existing callers don't break. The prompt builder defaults to conservative/standard behavior when absent.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/ai/src/types.ts
git commit -m "feat: add recentRace, firstTimeDistance, trainingAge to PlanGenerationInput"
```

---

### Task 2: Add `computeGoalPeakMileage` — tests first

**Files:**
- Modify: `packages/ai/src/pace-calculator.test.ts`

- [ ] **Step 1: Write failing tests**

Add this describe block at the end of `packages/ai/src/pace-calculator.test.ts`:

```ts
// ─── computeGoalPeakMileage ──────────────────────────────────────────────────

describe("computeGoalPeakMileage", () => {
  // Import will fail until function is exported — that's expected

  it("marathon 3:30 (210 min) → 65–80 km/week", () => {
    const result = computeGoalPeakMileage("full", 210)
    expect(result).toEqual({ low: 65, high: 80 })
  })

  it("marathon 2:30 (150 min, sub-2:45) → 110–130 km/week", () => {
    expect(computeGoalPeakMileage("full", 150)).toEqual({ low: 110, high: 130 })
  })

  it("marathon 2:45 exactly (165 min) → 95–115 km/week (lower bound inclusive)", () => {
    expect(computeGoalPeakMileage("full", 165)).toEqual({ low: 95, high: 115 })
  })

  it("marathon 3:29 (209 min) → 80–100 km/week (just below 3:30 boundary)", () => {
    expect(computeGoalPeakMileage("full", 209)).toEqual({ low: 80, high: 100 })
  })

  it("marathon 5:00 (300 min) → 45–60 km/week", () => {
    expect(computeGoalPeakMileage("full", 300)).toEqual({ low: 45, high: 60 })
  })

  it("half 1:45 (105 min) → 55–70 km/week", () => {
    expect(computeGoalPeakMileage("half", 105)).toEqual({ low: 55, high: 70 })
  })

  it("half 1:15 (75 min, sub-1:20) → 80–95 km/week", () => {
    expect(computeGoalPeakMileage("half", 75)).toEqual({ low: 80, high: 95 })
  })

  it("10k 0:42 (42 min) → 40–55 km/week", () => {
    expect(computeGoalPeakMileage("10k", 42)).toEqual({ low: 40, high: 55 })
  })

  it("10k 0:30 (30 min, sub-35) → 60–75 km/week", () => {
    expect(computeGoalPeakMileage("10k", 30)).toEqual({ low: 60, high: 75 })
  })

  it("5k 0:20 (20 min) → 45–55 km/week", () => {
    expect(computeGoalPeakMileage("5k", 20)).toEqual({ low: 45, high: 55 })
  })

  it("5k 0:15 (15 min, sub-18) → 55–65 km/week", () => {
    expect(computeGoalPeakMileage("5k", 15)).toEqual({ low: 55, high: 65 })
  })

  it("ultra returns null", () => {
    expect(computeGoalPeakMileage("ultra", 360)).toBeNull()
  })

  it("returns null for goalTotalMinutes <= 0", () => {
    expect(computeGoalPeakMileage("full", 0)).toBeNull()
    expect(computeGoalPeakMileage("full", -1)).toBeNull()
  })
})
```

Also update the import at the top of the test file:

```ts
import { calculatePaceZones, computePhases, computeGoalPeakMileage, calculateRawGoalPace } from "./pace-calculator"
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pnpm --filter @workspace/ai test
```

Expected: test suite fails — `computeGoalPeakMileage is not a function` (or similar import error).

---

### Task 3: Implement `computeGoalPeakMileage`

**Files:**
- Modify: `packages/ai/src/pace-calculator.ts`

- [ ] **Step 1: Add the function**

Add after the `computePhases` function at the bottom of `packages/ai/src/pace-calculator.ts`:

```ts
// ─── Goal-implied peak mileage ───────────────────────────────────────────────

/**
 * Return a soft target peak mileage range (km/week) for the given race distance
 * and goal time. The LLM uses this as a guideline, not a hard cap.
 *
 * Returns null for ultra (too variable) and invalid input (goalTotalMinutes <= 0).
 * Bucket boundaries are lower-bound inclusive, upper-bound exclusive.
 */
export function computeGoalPeakMileage(
  distance: string,
  goalTotalMinutes: number,
): { low: number; high: number } | null {
  if (goalTotalMinutes <= 0) return null

  switch (distance) {
    case "full":
      if (goalTotalMinutes < 165) return { low: 110, high: 130 }
      if (goalTotalMinutes < 180) return { low: 95,  high: 115 }
      if (goalTotalMinutes < 210) return { low: 80,  high: 100 }
      if (goalTotalMinutes < 240) return { low: 65,  high: 80  }
      if (goalTotalMinutes < 270) return { low: 55,  high: 70  }
      return { low: 45, high: 60 }

    case "half":
      if (goalTotalMinutes < 80)  return { low: 80, high: 95 }
      if (goalTotalMinutes < 95)  return { low: 65, high: 80 }
      if (goalTotalMinutes < 110) return { low: 55, high: 70 }
      if (goalTotalMinutes < 130) return { low: 45, high: 60 }
      return { low: 35, high: 50 }

    case "10k":
      if (goalTotalMinutes < 35) return { low: 60, high: 75 }
      if (goalTotalMinutes < 40) return { low: 50, high: 65 }
      if (goalTotalMinutes < 50) return { low: 40, high: 55 }
      return { low: 30, high: 45 }

    case "5k":
      if (goalTotalMinutes < 18) return { low: 55, high: 65 }
      if (goalTotalMinutes < 22) return { low: 45, high: 55 }
      if (goalTotalMinutes < 28) return { low: 35, high: 45 }
      return { low: 25, high: 35 }

    default:
      return null  // ultra and unknown distances
  }
}
```

- [ ] **Step 2: Run tests — verify `computeGoalPeakMileage` tests pass**

```bash
pnpm --filter @workspace/ai test
```

Expected: `computeGoalPeakMileage` describe block passes. `calculateRawGoalPace` tests still fail (not yet implemented).

---

### Task 4: Add `calculateRawGoalPace` — tests first

**Files:**
- Modify: `packages/ai/src/pace-calculator.test.ts`

- [ ] **Step 1: Write failing tests**

Add this describe block after the `computeGoalPeakMileage` block in the test file:

```ts
// ─── calculateRawGoalPace ────────────────────────────────────────────────────

describe("calculateRawGoalPace", () => {
  it("3:30 marathon — returns raw mp zone (no 5% buffer)", () => {
    // total = 12600s, no buffer
    // t5k = 12600 * (5/42.195)^1.06 = 12600 * 0.104263 = 1313.71s → ref = 262.74 s/km
    // mp lower: round(262.74 * 1.13) = round(296.90) = 297 → 4:57
    // mp upper: round(262.74 * 1.20) = round(315.29) = 315 → 5:15
    const result = calculateRawGoalPace({ hours: 3, minutes: 30, seconds: 0, distance: "full" })
    expect(result).toBe("4:57–5:15/km")
  })

  it("3:30 marathon raw goal pace is faster than goal-time calculatePaceZones mp (which has 5% buffer)", () => {
    // calculatePaceZones with goal-time applies 5% buffer → slower paces
    const buffered = calculatePaceZones({ hours: 3, minutes: 30, seconds: 0, distance: "full" }, "goal-time")!
    const raw = calculateRawGoalPace({ hours: 3, minutes: 30, seconds: 0, distance: "full" })!
    // raw mp lower bound should be faster (fewer seconds) than buffered mp lower bound
    function loSec(zone: string): number {
      const [m, s] = zone.split("–")[0]!.split(":").map(Number)
      return m! * 60 + s!
    }
    expect(loSec(raw)).toBeLessThan(loSec(buffered.mp))
  })

  it("returns null for zero time", () => {
    expect(calculateRawGoalPace({ hours: 0, minutes: 0, seconds: 0, distance: "full" })).toBeNull()
  })

  it("returns null for impossibly fast pace", () => {
    expect(calculateRawGoalPace({ hours: 0, minutes: 10, seconds: 0, distance: "10k" })).toBeNull()
  })

  it("works for half marathon", () => {
    const result = calculateRawGoalPace({ hours: 1, minutes: 45, seconds: 0, distance: "half" })
    expect(result).not.toBeNull()
    expect(result).toMatch(/^\d+:\d{2}–\d+:\d{2}\/km$/)
  })

  it("seconds parameter affects output", () => {
    const withoutSec = calculateRawGoalPace({ hours: 3, minutes: 30, seconds: 0, distance: "full" })
    const withSec    = calculateRawGoalPace({ hours: 3, minutes: 29, seconds: 30, distance: "full" })
    // 29:30 is slightly faster than 30:00 — raw pace should differ
    expect(withoutSec).not.toBe(withSec)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pnpm --filter @workspace/ai test
```

Expected: `calculateRawGoalPace` tests fail — function not yet implemented.

---

### Task 5: Implement `calculateRawGoalPace`

**Files:**
- Modify: `packages/ai/src/pace-calculator.ts`

- [ ] **Step 1: Add the function**

Add after `computeGoalPeakMileage` in `packages/ai/src/pace-calculator.ts`:

```ts
/**
 * Calculate the raw goal race pace (mp zone only) from a goal time.
 * Unlike calculatePaceZones, this does NOT apply the 5% training buffer —
 * it returns the actual target race pace the athlete is training toward.
 *
 * Returns null if input is invalid (zero time or impossibly fast pace).
 */
export function calculateRawGoalPace(input: PaceInput): string | null {
  const distKm = DISTANCE_KM[input.distance]
  if (!distKm) return null

  const totalSec = input.hours * 3600 + input.minutes * 60 + input.seconds
  if (totalSec <= 0) return null

  // Riegel formula — no buffer
  const t5kSec = totalSec * Math.pow(5 / distKm, 1.06)
  const ref = t5kSec / 5

  if (ref < 120) return null

  return formatZone(...ZONES.mp, ref)
}
```

- [ ] **Step 2: Run all tests — verify everything passes**

```bash
pnpm --filter @workspace/ai test
```

Expected: ALL tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/ai/src/pace-calculator.ts packages/ai/src/pace-calculator.test.ts
git commit -m "feat: add computeGoalPeakMileage and calculateRawGoalPace to pace-calculator"
```

---

## Chunk 2: Prompt Restructuring

### Task 6: Restructure `race-prompt.ts`

**Files:**
- Modify: `packages/ai/src/race-prompt.ts`

This task restructures the prompt builder. The changes are:
1. Add training age guidance to system prompt (after Intensity Distribution section)
2. Restructure user message to: goal first → athlete profile → current fitness → volume targets → dual pace zones → schedule → phases → week schedule
3. Remove `fitnessSource` line
4. Add `computeGoalPeakMileage` and `calculateRawGoalPace` to imports
5. Map `recentRace.weeksAgo` to the existing `context` values
6. Compute training zones from `recentRace` if present, else from goal time
7. Compute raw goal pace from goal time
8. Compute peak mileage target from goal time + distance
9. Handle edge case: starting volume already at/above peak target

- [ ] **Step 1: Update the import at the top of `race-prompt.ts`**

Change:
```ts
import { calculatePaceZones, computePhases } from "./pace-calculator"
```
To:
```ts
import { calculatePaceZones, computePhases, computeGoalPeakMileage, calculateRawGoalPace } from "./pace-calculator"
```

- [ ] **Step 2: Update `buildSystemPrompt` — add training age section**

In `buildSystemPrompt`, insert the training age block between the `## Intensity Distribution (80/20 Rule)` section and the `## Weekly Structure Rules` section — specifically after the bullet `- If athlete has only 3 running days: max 1 quality session per week`:

```ts
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

- [ ] **Step 3: Add a helper to map `weeksAgo` → `context`**

Add this helper above `buildPrompt` in `race-prompt.ts`:

```ts
const WEEKS_AGO_CONTEXT: Record<string, "active" | "short-break" | "long-break"> = {
  "under-8": "active",
  "8-16": "short-break",
  "16-24": "long-break",
}
```

- [ ] **Step 4: Rewrite `buildPrompt` — compute dual pace zones and peak mileage**

**Important:** The variables `distance` (from `const { name, distance, city } = input.race` on line 172), `u` (from `const u = input.units === "km" ? "km" : "mi"` just above `const lines`), `startingVolume`, `rangeLabel`, `phaseScheduleLines`, and `phasesJson` are already in scope above the replacement region. Do not remove them. The steps below only replace specific sub-sections.

Replace the section from `// ── Pace zones` through `// ── Fitness source description` (lines ~175–201) with:

```ts
  // ── Goal time string ─────────────────────────────────────────────────────
  const goalTimeStr = input.goalTime
    ? `${input.goalTime.hours}h${input.goalTime.minutes.toString().padStart(2, "0")}m`
    : null

  // ── Pace zones (dual source) ─────────────────────────────────────────────
  let trainingZones = null
  let rawGoalPace: string | null = null

  if (input.recentRace) {
    const { hours, minutes, seconds, distance: rDist, weeksAgo } = input.recentRace
    const context = WEEKS_AGO_CONTEXT[weeksAgo] ?? "active"
    trainingZones = calculatePaceZones(
      { hours, minutes, seconds, distance: rDist, context },
      "recent-race"
    )
  } else if (input.goalTime) {
    const { hours, minutes } = input.goalTime
    trainingZones = calculatePaceZones(
      { hours, minutes, seconds: input.goalTime.seconds ?? 0, distance: distance === "ultra" ? "full" : distance as "5k" | "10k" | "half" | "full" },
      "goal-time"
    )
  }

  if (input.goalTime) {
    rawGoalPace = calculateRawGoalPace({
      hours: input.goalTime.hours,
      minutes: input.goalTime.minutes,
      seconds: input.goalTime.seconds ?? 0,
      distance: distance === "ultra" ? "full" : distance as "5k" | "10k" | "half" | "full",
    })
  }

  // ── Goal-implied peak mileage ────────────────────────────────────────────
  const goalMinutes = input.goalTime
    ? input.goalTime.hours * 60 + input.goalTime.minutes + (input.goalTime.seconds ?? 0) / 60
    : null
  const peakMileage = goalMinutes ? computeGoalPeakMileage(distance, goalMinutes) : null
```

- [ ] **Step 5: Rewrite the user message (`lines` array) in `buildPrompt`**

Replace the entire section from `const lines: string[] = []` through `lines.push(\`Week schedule...`)` with:

```ts
  const lines: string[] = []

  // 1. Primary objective
  if (goalTimeStr) {
    lines.push(`Primary objective: Run ${name} in ${goalTimeStr}. Every decision in this plan — volume, workout selection, pace targets, phase structure — exists to serve this single goal.`)
  } else {
    lines.push(`Goal: Race — ${name} in ${city} on ${toISO(endDate)} (${raceKm} ${u} / ${distance})`)
    lines.push("Objective: finish — build fitness and endurance to complete the race comfortably.")
  }

  // 2. Athlete profile
  lines.push("")
  lines.push("Athlete profile:")
  const trainingAgeLabel: Record<string, string> = {
    "under-1": "under 1 year of consistent running",
    "1-3": "1–3 years of consistent running",
    "3-or-more": "3 or more years of consistent running",
  }
  lines.push(`  Training age: ${trainingAgeLabel[input.trainingAge ?? "1-3"] ?? "1–3 years of consistent running"}`)
  lines.push(`  First time at this distance: ${input.firstTimeDistance ? "Yes — emphasise completion and confidence over performance targets" : "No"}`)

  // 3. Current fitness
  lines.push("")
  lines.push("Current fitness:")
  if (input.recentRace) {
    const { hours: rh, minutes: rm, seconds: rs, distance: rd, weeksAgo } = input.recentRace
    const raceTimeStr = `${rh}h${rm.toString().padStart(2, "0")}m${rs > 0 ? rs.toString().padStart(2, "0") + "s" : ""}`
    const weeksAgoLabel: Record<string, string> = {
      "under-8": "< 8 weeks ago",
      "8-16": "8–15 weeks ago",
      "16-24": "16–23 weeks ago",
    }
    lines.push(`  Recent race: ${rd.toUpperCase()} in ${raceTimeStr} (${weeksAgoLabel[weeksAgo] ?? weeksAgo}) — used to calibrate training paces`)
  }
  lines.push(`  Current weekly mileage (starting point only — does not cap peak volume): ${rangeLabel} ${u}/week`)

  // 4. Volume targets
  // Note: startingVolume and peakMileage are always in km regardless of units preference.
  // The prompt communicates volumes in km only — this is consistent with how distanceKm
  // is always stored and computed in km throughout the codebase.
  lines.push("")
  lines.push("Volume targets (all distances in km):")
  lines.push(`  Week 1 volume: ~${startingVolume} km`)
  if (peakMileage) {
    if (startingVolume >= peakMileage.low) {
      lines.push(`  Current weekly volume already meets the target peak range (~${peakMileage.low}–${peakMileage.high} km/week). Prioritise maintaining volume and increasing workout quality rather than further mileage buildup.`)
    } else {
      lines.push(`  Target peak volume (soft — scale back if timeline is short, athlete is a first-timer, or training age is under-1): ~${peakMileage.low}–${peakMileage.high} km/week`)
    }
  }

  // 5. Pace zones (dual block)
  lines.push("")
  if (trainingZones) {
    lines.push("Training pace zones (current fitness — use for targetPace on all workouts):")
    lines.push(`  Easy:         ${trainingZones.easy}`)
    lines.push(`  Long run:     ${trainingZones.longRun}`)
    lines.push(`  Medium-long:  ${trainingZones.mediumLong}`)
    lines.push(`  Threshold:    ${trainingZones.threshold}`)
    lines.push(`  VO2max:       ${trainingZones.vo2max}`)
  } else {
    lines.push("Training pace zones: not available — calibrate paces to the athlete's fitness level.")
  }
  lines.push("")
  if (rawGoalPace) {
    lines.push("Goal race pace (target — use for mp workouts and race-pace segments only):")
    lines.push(`  Race pace:    ${rawGoalPace}`)
    // Only emit the "faster than goal" note when training zones are genuinely faster
    // (i.e. the athlete's current fitness exceeds the goal time).
    // Compare the lower-bound seconds of each mp zone string to determine which is faster.
    if (trainingZones) {
      function mpLoSec(zone: string): number {
        const [m, s] = zone.split("–")[0]!.split(":").map(Number)
        return m! * 60 + s!
      }
      if (mpLoSec(trainingZones.mp) < mpLoSec(rawGoalPace)) {
        lines.push("  Note: training zones reflect current fitness — they may be faster than goal race pace for athletes whose fitness already exceeds their race target.")
      }
    }
  } else {
    lines.push("Goal race pace: not specified — use mp zone from training zones above for race-pace work.")
  }

  // 6. Schedule
  const runDayNames = input.selectedDays.map(d => DAY_NAMES[d] ?? d).join(", ")
  const longRunDayName = DAY_NAMES[input.longRunDay] ?? input.longRunDay

  lines.push("")
  lines.push(`Available running days: ${runDayNames}`)
  lines.push(`Long run day: ${longRunDayName} — every week's long run MUST be on ${longRunDayName}, no exceptions.`)

  if (input.strengthTraining && input.strengthDays?.length) {
    const strengthDayNames = input.strengthDays.map(d => DAY_NAMES[d] ?? d).join(", ")
    const runDaySet = new Set(input.selectedDays)
    const bothDays = input.strengthDays.filter(d => runDaySet.has(d)).map(d => DAY_NAMES[d] ?? d)
    const strengthOnlyDays = input.strengthDays.filter(d => !runDaySet.has(d)).map(d => DAY_NAMES[d] ?? d)
    lines.push(`Strength training days: ${strengthDayNames}`)
    if (bothDays.length > 0) {
      lines.push(`  → Days with BOTH a run AND strength: ${bothDays.join(", ")} — emit TWO JSON lines for each of these dates every week (run first, strength second)`)
    }
    if (strengthOnlyDays.length > 0) {
      lines.push(`  → Strength-only days (no run): ${strengthOnlyDays.join(", ")} — emit ONE strength JSON line for each of these dates`)
    }
  } else {
    lines.push("Strength training: none")
  }

  // 7. Phase schedule
  lines.push("")
  lines.push("Phase schedule (follow exactly):")
  lines.push(phaseScheduleLines)

  lines.push("")
  lines.push(`Meta line phases (copy verbatim into your first JSON line's "phases" field):`)
  lines.push(phasesJson)

  // 8. Week schedule
  lines.push("")
  lines.push(`Week schedule (use ONLY these exact dates — do not invent or shift any dates):\n${buildWeekSchedule(startDate, endDate)}`)
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
pnpm typecheck
```

Expected: no errors. Fix any type errors before continuing.

- [ ] **Step 7: Also update `mapToInput` in `apps/web/app/plan/page.tsx` to pass through new fields**

In `mapToInput`, first update the existing `goalTime` block (lines 58–64) to also read `seconds`:

```ts
  if (raw["timeGoal"] === true && raw["goalTime"]) {
    const gt = raw["goalTime"] as Record<string, unknown>
    input.goalTime = {
      hours: Number(gt["hours"] ?? 0),
      minutes: Number(gt["minutes"] ?? 0),
      seconds: Number(gt["seconds"] ?? 0),
    }
  }
```

Then, after the `weeklyMileageRange` block, add:

```ts
  // Pass through new athlete profile fields if present in sessionStorage
  const rawRecentRace = raw["recentRace"] as Record<string, unknown> | undefined
  if (rawRecentRace && typeof rawRecentRace === "object") {
    const weeksAgo = rawRecentRace["weeksAgo"] as string | undefined
    const validWeeksAgo = ["under-8", "8-16", "16-24"]
    const validDistances = ["5k", "10k", "half", "full"]
    const dist = rawRecentRace["distance"] as string | undefined
    if (dist && validDistances.includes(dist) && weeksAgo && validWeeksAgo.includes(weeksAgo)) {
      input.recentRace = {
        distance: dist as "5k" | "10k" | "half" | "full",
        hours: Number(rawRecentRace["hours"] ?? 0),
        minutes: Number(rawRecentRace["minutes"] ?? 0),
        seconds: Number(rawRecentRace["seconds"] ?? 0),
        weeksAgo: weeksAgo as "under-8" | "8-16" | "16-24",
      }
    }
  }

  const rawFirstTime = raw["firstTimeDistance"]
  if (typeof rawFirstTime === "boolean") input.firstTimeDistance = rawFirstTime

  const rawTrainingAge = raw["trainingAge"] as string | undefined
  const validTrainingAges = ["under-1", "1-3", "3-or-more"]
  if (rawTrainingAge && validTrainingAges.includes(rawTrainingAge)) {
    input.trainingAge = rawTrainingAge as PlanGenerationInput["trainingAge"]
  }
```

- [ ] **Step 8: Run tests**

```bash
pnpm --filter @workspace/ai test
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add packages/ai/src/race-prompt.ts apps/web/app/plan/page.tsx
git commit -m "feat: restructure race prompt to make goal time the primary driver"
```

---

### Task 7: Manual smoke test

Before declaring done, verify the prompt output looks correct by reading the generated prompt string.

- [ ] **Step 1: Create a temporary test script**

Create `packages/ai/src/smoke-test.ts` (will be deleted after):

```ts
import { buildPrompt } from "./race-prompt"

const prompt = buildPrompt({
  goal: "race",
  race: { name: "Boston Marathon", date: "2027-04-19", distance: "full", city: "Boston" },
  goalTime: { hours: 3, minutes: 30, seconds: 0 },
  selectedDays: ["mon", "wed", "thu", "sat", "sun"],
  longRunDay: "sun",
  units: "km",
  strengthTraining: false,
  weeklyMileageRange: "40-60",
  trainingAge: "1-3",
  firstTimeDistance: false,
  recentRace: {
    distance: "half",
    hours: 1,
    minutes: 45,
    seconds: 0,
    weeksAgo: "under-8",
  },
})

console.log("=== SYSTEM ===")
console.log(prompt.system.slice(0, 500) + "...\n")
console.log("=== USER ===")
console.log(prompt.user)
```

- [ ] **Step 2: Run it**

```bash
cd /Users/zackdorward/dev/athlos && node --loader ts-node/esm packages/ai/src/smoke-test.ts 2>/dev/null || pnpm tsx packages/ai/src/smoke-test.ts
```

Verify in the output:
- User message opens with "Primary objective: Run Boston Marathon in 3h30m"
- "Athlete profile:" block appears before fitness/mileage
- "Training pace zones" block appears (derived from recent race — 1:45 half marathon)
- "Goal race pace" block appears separately, and its race pace is FASTER (fewer min:sec) than the training zone mp — because the 1:45 half implies ~3:42 marathon equivalent fitness, which is slower than the 3:30 goal. So goal race pace should be faster than training zone mp.
- The "Note: training zones reflect current fitness..." line does NOT appear (training zones are slower than goal pace in this scenario, so the note is correctly suppressed)
- "Target peak volume" line shows ~65–80 km/week (3:30 = exactly 210 min → 210–240 bucket → 65–80)
- "Volume targets (all distances in km)" header appears
- "Current weekly mileage (starting point only" appears in the "Current fitness:" section

- [ ] **Step 3: Delete the smoke test file**

```bash
rm packages/ai/src/smoke-test.ts
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: goal-time-driven plan generation complete"
```

---

## Done

All backend changes are complete. The onboarding UI (new questions for recent race, training age, first-time distance, and units with locale default) is a separate ticket — the `mapToInput` function in `plan/page.tsx` already reads these fields from `sessionStorage`, so the UI just needs to write them there.
