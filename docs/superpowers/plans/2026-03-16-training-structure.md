# Training Structure Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add goal-time–driven weekly structure constraints to plan generation and remove LLM strength day output in favor of code-side injection.

**Architecture:** Three independent changes: (1) a new `computeTrainingStructure()` pure function in `pace-calculator.ts` that maps goal time → weekly structure, (2) `buildPrompt()` changes in `race-prompt.ts` that inject the structure as hard constraints and stop asking the LLM to output strength entries, (3) a new `mergeStrengthDays()` function in `apps/web/app/plan/page.tsx` that injects strength entries after the LLM stream completes.

**Tech Stack:** TypeScript, Vitest (for `packages/ai` tests), React 19, Next.js App Router

**Spec:** `docs/superpowers/specs/2026-03-16-training-structure-design.md`

---

## Chunk 1: `computeTrainingStructure()`

### Task 1: Add `computeTrainingStructure()` with tests

**Files:**
- Modify: `packages/ai/src/pace-calculator.ts` (append after line 232)
- Modify: `packages/ai/src/pace-calculator.test.ts` (append new describe blocks)

#### Background for the implementer

`packages/ai/src/pace-calculator.ts` is the home of pure calculation functions for the AI package. `computeGoalPeakMileage()` at line 172 is the closest existing function — it also maps `(distance, goalMinutes)` to a structured result using `if` chains and a `switch`. Follow that same pattern.

The existing test file `packages/ai/src/pace-calculator.test.ts` uses Vitest `describe`/`it`/`expect`. Each function has its own `describe` block. Tests are grouped as "one describe per scenario" with individual `it` assertions.

**Note on function signature:** The spec's stated signature omits `weeklyMileageRange`, but the mileage-based fallback (used when `goalMinutes` is null and distance is not ultra) requires it. Add `weeklyMileageRange: string` as the 5th parameter.

#### Final function signature and lookup tables

```ts
export function computeTrainingStructure(
  goalMinutes: number | null,
  distance: string,
  trainingAge: string | undefined,
  selectedDaysCount: number,
  weeklyMileageRange: string,
): { runDaysPerWeek: number; restDaysPerWeek: number; maxQualityPerWeek: number }
```

**Full marathon lookup** (`distance === "full"`):

| goalMinutes range | run | rest | quality |
|-------------------|-----|------|---------|
| < 150             |  7  |   0  |    3    |
| < 165             |  7  |   0  |    2    |
| < 190             |  6  |   1  |    2    |
| < 225             |  6  |   1  |    2    |
| < 270             |  5  |   2  |    1    |
| >= 270            |  5  |   2  |    1    |

**Half marathon lookup** (`distance === "half"`):

| goalMinutes range | run | rest | quality |
|-------------------|-----|------|---------|
| < 75              |  7  |   0  |    3    |
| < 82              |  7  |   0  |    2    |
| < 95              |  6  |   1  |    2    |
| < 112             |  6  |   1  |    2    |
| < 135             |  5  |   2  |    1    |
| >= 135            |  5  |   2  |    1    |

**5K/10K** (`distance === "5k"` or `"10k"`): Apply full marathon lookup first, then:
- `maxQualityPerWeek += 1`
- `runDaysPerWeek = Math.min(runDaysPerWeek, 6)` — if this reduces run days (i.e., `run` was 7), `restDaysPerWeek += 1`

**Ultra** (`distance === "ultra"`): Skip goal-time lookup entirely; fall through to mileage fallback.

**Training age modifier** (applied after goal-time lookup, before selectedDaysCount clamp):
- `trainingAge === "under-1"`: `maxQualityPerWeek = Math.max(1, maxQualityPerWeek - 1)`. Then cap: `if (runDaysPerWeek > 6) { runDaysPerWeek = 6; restDaysPerWeek += 1 }`. Only "under-1" gets a modifier.
- `trainingAge === "1-3"`, `"3-or-more"`, or `undefined` (treated as "1-3"): no modifier

**selectedDaysCount clamp** (applied last):
- `runDaysPerWeek = Math.min(runDaysPerWeek, selectedDaysCount)`
- `restDaysPerWeek` is NOT adjusted

**Mileage fallback** (used when `goalMinutes` is null and distance is not `"full"` / `"half"` / `"5k"` / `"10k"`, i.e. ultra and unknown — OR when distance is `"ultra"` regardless of goalMinutes):

| weeklyMileageRange | run | rest | quality |
|--------------------|-----|------|---------|
| `"under-40"`       |  5  |   2  |    1    |
| `"40-60"`          |  6  |   1  |    1    |
| `"60-80"`          |  6  |   1  |    2    |
| `"80-plus"`        |  7  |   0  |    2    |
| (unknown)          |  5  |   2  |    1    |

Training age modifier and selectedDaysCount clamp still apply after the mileage fallback.

---

- [ ] **Step 1: Write the failing tests**

  Append to `packages/ai/src/pace-calculator.test.ts`:

  ```ts
  // ─── computeTrainingStructure ─────────────────────────────────────────────

  describe("computeTrainingStructure — full marathon, 3:20 goal (200 min), 1-3, 7 days", () => {
    const result = computeTrainingStructure(200, "full", "1-3", 7, "40-60")
    it("runDaysPerWeek: 6", () => { expect(result.runDaysPerWeek).toBe(6) })
    it("restDaysPerWeek: 1", () => { expect(result.restDaysPerWeek).toBe(1) })
    it("maxQualityPerWeek: 2", () => { expect(result.maxQualityPerWeek).toBe(2) })
  })

  describe("computeTrainingStructure — full marathon, sub-2:30 (140 min), 3-or-more, 7 days", () => {
    const result = computeTrainingStructure(140, "full", "3-or-more", 7, "80-plus")
    it("runDaysPerWeek: 7", () => { expect(result.runDaysPerWeek).toBe(7) })
    it("restDaysPerWeek: 0", () => { expect(result.restDaysPerWeek).toBe(0) })
    it("maxQualityPerWeek: 3", () => { expect(result.maxQualityPerWeek).toBe(3) })
  })

  describe("computeTrainingStructure — full marathon, sub-2:30 (140 min), under-1, 7 days — training age caps run days", () => {
    const result = computeTrainingStructure(140, "full", "under-1", 7, "80-plus")
    it("runDaysPerWeek: 6 (capped by under-1)", () => { expect(result.runDaysPerWeek).toBe(6) })
    it("restDaysPerWeek: 1 (incremented due to cap)", () => { expect(result.restDaysPerWeek).toBe(1) })
    it("maxQualityPerWeek: 2 (reduced by under-1)", () => { expect(result.maxQualityPerWeek).toBe(2) })
  })

  describe("computeTrainingStructure — full marathon, 3:20 (200 min), 1-3, 5 selected days — selectedDaysCount clamp", () => {
    const result = computeTrainingStructure(200, "full", "1-3", 5, "40-60")
    it("runDaysPerWeek: 5 (clamped to selectedDaysCount)", () => { expect(result.runDaysPerWeek).toBe(5) })
    it("restDaysPerWeek: 1 (not adjusted by clamp)", () => { expect(result.restDaysPerWeek).toBe(1) })
    it("maxQualityPerWeek: 2", () => { expect(result.maxQualityPerWeek).toBe(2) })
  })

  describe("computeTrainingStructure — half marathon, sub-1:15 (70 min), 1-3, 7 days", () => {
    const result = computeTrainingStructure(70, "half", "1-3", 7, "60-80")
    it("runDaysPerWeek: 7", () => { expect(result.runDaysPerWeek).toBe(7) })
    it("restDaysPerWeek: 0", () => { expect(result.restDaysPerWeek).toBe(0) })
    it("maxQualityPerWeek: 3", () => { expect(result.maxQualityPerWeek).toBe(3) })
  })

  describe("computeTrainingStructure — 5k, 3:20 full equiv (200 min), 1-3, 7 days — maxQuality+1, runDays cap", () => {
    // Full marathon 200 min → 6 run, 1 rest, 2 quality. 5K: quality+1=3, runDays capped at 6 (no change)
    const result = computeTrainingStructure(200, "5k", "1-3", 7, "40-60")
    it("runDaysPerWeek: 6", () => { expect(result.runDaysPerWeek).toBe(6) })
    it("restDaysPerWeek: 1", () => { expect(result.restDaysPerWeek).toBe(1) })
    it("maxQualityPerWeek: 3 (5k bonus)", () => { expect(result.maxQualityPerWeek).toBe(3) })
  })

  describe("computeTrainingStructure — 5k, sub-2:30 equiv (140 min) — run days capped from 7 to 6", () => {
    // Full marathon 140 min → 7 run, 0 rest, 3 quality. 5K: quality+1=4... but runDays cap 7→6 → rest+1=1
    const result = computeTrainingStructure(140, "5k", "1-3", 7, "80-plus")
    it("runDaysPerWeek: 6 (capped from 7)", () => { expect(result.runDaysPerWeek).toBe(6) })
    it("restDaysPerWeek: 1 (incremented due to cap)", () => { expect(result.restDaysPerWeek).toBe(1) })
    it("maxQualityPerWeek: 4 (3+1 bonus)", () => { expect(result.maxQualityPerWeek).toBe(4) })
  })

  describe("computeTrainingStructure — ultra (goalMinutes ignored, uses mileage fallback)", () => {
    const result = computeTrainingStructure(200, "ultra", "1-3", 7, "60-80")
    it("runDaysPerWeek: 6", () => { expect(result.runDaysPerWeek).toBe(6) })
    it("restDaysPerWeek: 1", () => { expect(result.restDaysPerWeek).toBe(1) })
    it("maxQualityPerWeek: 2", () => { expect(result.maxQualityPerWeek).toBe(2) })
  })

  describe("computeTrainingStructure — no goal time, full marathon, uses mileage fallback", () => {
    const result = computeTrainingStructure(null, "full", "1-3", 7, "under-40")
    it("runDaysPerWeek: 5", () => { expect(result.runDaysPerWeek).toBe(5) })
    it("restDaysPerWeek: 2", () => { expect(result.restDaysPerWeek).toBe(2) })
    it("maxQualityPerWeek: 1", () => { expect(result.maxQualityPerWeek).toBe(1) })
  })

  describe("computeTrainingStructure — undefined trainingAge treated as 1-3 (no modifier)", () => {
    const withUndefined = computeTrainingStructure(200, "full", undefined, 7, "40-60")
    const with1_3 = computeTrainingStructure(200, "full", "1-3", 7, "40-60")
    it("runDaysPerWeek matches 1-3", () => { expect(withUndefined.runDaysPerWeek).toBe(with1_3.runDaysPerWeek) })
    it("restDaysPerWeek matches 1-3", () => { expect(withUndefined.restDaysPerWeek).toBe(with1_3.restDaysPerWeek) })
    it("maxQualityPerWeek matches 1-3", () => { expect(withUndefined.maxQualityPerWeek).toBe(with1_3.maxQualityPerWeek) })
  })
  ```

- [ ] **Step 2: Run tests — verify they fail**

  ```bash
  cd /path/to/repo && pnpm --filter @workspace/ai test
  ```

  Expected: failures referencing `computeTrainingStructure is not a function` or import error.

- [ ] **Step 3: Implement `computeTrainingStructure()`**

  Add the following to `packages/ai/src/pace-calculator.ts` after the `calculateRawGoalPace` function (after line 232):

  ```ts
  // ─── Training structure ──────────────────────────────────────────────────────

  /**
   * Derive the optimal weekly training structure from goal time, distance,
   * training age, and availability. Used to inject Pfitzinger-based hard
   * constraints into the LLM prompt.
   *
   * The weeklyMileageRange fallback is used when goalMinutes is null (no goal
   * time provided) or when distance is "ultra".
   */
  export function computeTrainingStructure(
    goalMinutes: number | null,
    distance: string,
    trainingAge: string | undefined,
    selectedDaysCount: number,
    weeklyMileageRange: string,
  ): { runDaysPerWeek: number; restDaysPerWeek: number; maxQualityPerWeek: number } {
    let run: number
    let rest: number
    let quality: number

    const useMileageFallback =
      goalMinutes === null ||
      distance === "ultra" ||
      (distance !== "full" && distance !== "half" && distance !== "5k" && distance !== "10k")

    if (!useMileageFallback && distance === "full") {
      if (goalMinutes < 150)      { run = 7; rest = 0; quality = 3 }
      else if (goalMinutes < 165) { run = 7; rest = 0; quality = 2 }
      else if (goalMinutes < 190) { run = 6; rest = 1; quality = 2 }
      else if (goalMinutes < 225) { run = 6; rest = 1; quality = 2 }
      else if (goalMinutes < 270) { run = 5; rest = 2; quality = 1 }
      else                        { run = 5; rest = 2; quality = 1 }
    } else if (!useMileageFallback && distance === "half") {
      if (goalMinutes < 75)       { run = 7; rest = 0; quality = 3 }
      else if (goalMinutes < 82)  { run = 7; rest = 0; quality = 2 }
      else if (goalMinutes < 95)  { run = 6; rest = 1; quality = 2 }
      else if (goalMinutes < 112) { run = 6; rest = 1; quality = 2 }
      else if (goalMinutes < 135) { run = 5; rest = 2; quality = 1 }
      else                        { run = 5; rest = 2; quality = 1 }
    } else if (!useMileageFallback && (distance === "5k" || distance === "10k")) {
      // Use full marathon table as base
      if (goalMinutes! < 150)      { run = 7; rest = 0; quality = 3 }
      else if (goalMinutes! < 165) { run = 7; rest = 0; quality = 2 }
      else if (goalMinutes! < 190) { run = 6; rest = 1; quality = 2 }
      else if (goalMinutes! < 225) { run = 6; rest = 1; quality = 2 }
      else if (goalMinutes! < 270) { run = 5; rest = 2; quality = 1 }
      else                         { run = 5; rest = 2; quality = 1 }
      // 5k/10k modifier: +1 quality, cap run days at 6
      quality += 1
      if (run > 6) { run = 6; rest += 1 }
    } else {
      // Mileage fallback (ultra, no goal time, unknown distance)
      if (weeklyMileageRange === "under-40")     { run = 5; rest = 2; quality = 1 }
      else if (weeklyMileageRange === "40-60")   { run = 6; rest = 1; quality = 1 }
      else if (weeklyMileageRange === "60-80")   { run = 6; rest = 1; quality = 2 }
      else if (weeklyMileageRange === "80-plus") { run = 7; rest = 0; quality = 2 }
      else                                        { run = 5; rest = 2; quality = 1 }
    }

    // Training age modifier
    if (trainingAge === "under-1") {
      quality = Math.max(1, quality - 1)
      if (run > 6) { run = 6; rest += 1 }
    }
    // "1-3", "3-or-more", undefined: no modifier

    // selectedDaysCount clamp
    run = Math.min(run, selectedDaysCount)

    return { runDaysPerWeek: run, restDaysPerWeek: rest, maxQualityPerWeek: quality }
  }
  ```

- [ ] **Step 4: Add import to test file**

  At the top of `packages/ai/src/pace-calculator.test.ts`, add `computeTrainingStructure` to the import:

  ```ts
  import { calculatePaceZones, computePhases, computeGoalPeakMileage, calculateRawGoalPace, computeTrainingStructure } from "./pace-calculator"
  ```

- [ ] **Step 5: Run tests — verify they pass**

  ```bash
  pnpm --filter @workspace/ai test
  ```

  Expected: all tests pass, including the new `computeTrainingStructure` describes.

- [ ] **Step 6: Typecheck**

  ```bash
  pnpm typecheck
  ```

  Expected: no errors.

- [ ] **Step 7: Commit**

  ```bash
  git add packages/ai/src/pace-calculator.ts packages/ai/src/pace-calculator.test.ts
  git commit -m "feat: add computeTrainingStructure() with Pfitzinger-based weekly structure lookup"
  ```

---

## Chunk 2: `buildPrompt()` changes in `race-prompt.ts`

### Task 2: Inject training structure block and fix strength days prompt

**Files:**
- Modify: `packages/ai/src/race-prompt.ts`

#### Background for the implementer

`buildPrompt()` is in `packages/ai/src/race-prompt.ts`. The function builds a `{ system, user }` pair for the Claude API. The system prompt is generated by `buildSystemPrompt()` (lines 1–108). The user message is built by pushing lines onto an array.

The user message sections are:
1. Primary objective (line 232)
2. Athlete profile (line 240)
3. Current fitness (line 250)
4. Volume targets (line 255)
5. Pace zones (line 270)
6. Schedule (line 298 — "Available running days", long run day, strength days)
7. Phase schedule (line 322)
8. Week schedule (line 331)

**Changes needed:**
1. **System prompt:** Remove lines 103–104 from `buildSystemPrompt()`. Update line 101's hard constraint wording.
2. **User message section 5→6 boundary:** After the pace zones block (section 5), inject a new "Prescribed training structure" block.
3. **User message strength days block (lines 306–317):** Replace the current emit-instructions block with a simpler "don't emit strength lines" instruction.

---

- [ ] **Step 1: Update the system prompt**

  In `packages/ai/src/race-prompt.ts`, inside `buildSystemPrompt()`:

  **Change line 101** from:
  ```
  - Only schedule runs on the athlete's available running days — days that are neither running days nor strength days must be type "rest"
  ```
  To:
  ```
  - Only schedule runs on the athlete's available running days. Assign rest days to achieve the prescribed rest days per week — you may designate any available running day as rest if needed to hit this target, except the long run day which must always remain a run day. Days not in the available running days list (and not strength days) are always rest.
  ```

  **Delete lines 103–104** entirely:
  ```
  - Strength training NEVER replaces a run. If a day appears in both the running days list AND the strength days list, emit TWO lines for that date: the run workout first, then a strength line. The run is determined by the training plan as normal; strength is always additive.
  - If a strength day is NOT a running day, emit a single "strength" type line for that date (no run, no distanceKm)
  ```

  After these two edits, the Hard Constraints block (lines 99–107) should look like:

  ```
  ## Hard Constraints

  - Only schedule runs on the athlete's available running days. Assign rest days to achieve the prescribed rest days per week — you may designate any available running day as rest if needed to hit this target, except the long run day which must always remain a run day. Days not in the available running days list (and not strength days) are always rest.
  - Long run MUST be on the designated long run day every single week, no exceptions
  - Follow the 10% weekly mileage increase rule; include a recovery week (30% mileage reduction) every 4th week
  - Always output distances in ${unitLabel}
  - Descriptions must be specific (e.g. "2 ${u} warm-up, 5 × 1000 m at vo2max zone with 90 sec jog, 2 ${u} cool-down") not vague (e.g. "do intervals")
  ```

- [ ] **Step 2: Add `computeTrainingStructure` to the import**

  At line 2 of `packages/ai/src/race-prompt.ts`, add `computeTrainingStructure` to the import:

  ```ts
  import { calculatePaceZones, computePhases, computeGoalPeakMileage, calculateRawGoalPace, computeTrainingStructure } from "./pace-calculator"
  ```

- [ ] **Step 3: Compute `trainingStructure` in `buildPrompt()`**

  After the `goalMinutes` / `peakMileage` block (around line 227), add:

  ```ts
  // ── Training structure ───────────────────────────────────────────────────
  const trainingStructure = computeTrainingStructure(
    goalMinutes,
    distance,
    input.trainingAge,
    input.selectedDays.length,
    input.weeklyMileageRange,
  )
  ```

- [ ] **Step 4: Inject "Prescribed training structure" block into the user message**

  Find the section 5→6 boundary in the user message builder. It currently looks like (around lines 296–303):

  ```ts
  // 6. Schedule
  const runDayNames = input.selectedDays.map(d => DAY_NAMES[d] ?? d).join(", ")
  ```

  Just before `// 6. Schedule`, add the new block:

  ```ts
  // 5b. Prescribed training structure
  lines.push("")
  lines.push("Prescribed training structure (Pfitzinger-based — treat as hard constraints):")
  lines.push(`  Running days per week: ${trainingStructure.runDaysPerWeek}`)
  lines.push(`  Rest days per week: ${trainingStructure.restDaysPerWeek} (place on the day that best aids recovery — typically before a quality session or after the long run; never designate the long run day as rest)`)
  lines.push(`  Max quality sessions per week: ${trainingStructure.maxQualityPerWeek}`)
  ```

- [ ] **Step 5: Replace the strength days user message block**

  Find the strength training block (lines 306–317). Current code:

  ```ts
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
  ```

  Replace with:

  ```ts
  if (input.strengthTraining && input.strengthDays?.length) {
    const strengthDayNames = input.strengthDays.map(d => DAY_NAMES[d] ?? d).join(", ")
    lines.push(`Strength training days: ${strengthDayNames} — treat these as heavy days; do not schedule quality running sessions (tempo, intervals, race pace) on these days. The strength schedule is already defined and will be merged into the final output separately — do not emit any strength type lines.`)
  } else {
    lines.push("Strength training: none")
  }
  ```

- [ ] **Step 6: Typecheck**

  ```bash
  pnpm typecheck
  ```

  Expected: no errors.

- [ ] **Step 7: Commit**

  ```bash
  git add packages/ai/src/race-prompt.ts
  git commit -m "feat: inject Pfitzinger training structure into LLM prompt and remove strength day output"
  ```

---

## Chunk 3: `mergeStrengthDays()` in `apps/web/app/plan/page.tsx`

### Task 3: Add `mergeStrengthDays()` and call it in the stream done block

**Files:**
- Modify: `apps/web/app/plan/page.tsx`

#### Background for the implementer

`apps/web/app/plan/page.tsx` is the plan generation page. It streams NDJSON from `/api/generate-plan`, incrementally building `plan.days` via `setPlan`. When the stream finishes (`done === true`), it optionally merges bridge runs via `buildBridgeRuns`, then calls `setStatus("complete")`.

The LLM no longer outputs `type: "strength"` entries (we just removed those instructions from the prompt). `mergeStrengthDays()` fills that gap by injecting strength entries for every occurrence of each strength day between the plan's first and last date.

The `WorkoutDay` type (from `@workspace/ai`) has these fields:
- `date: string` — required, ISO "YYYY-MM-DD"
- `type: WorkoutType` — required
- `description: string` — required
- `distanceKm?: number` — optional
- `targetHR?: string` — optional
- `targetPace?: string` — optional
- `completed?: boolean` — optional
- `effort?: ...` — optional

Strength entries only need `date`, `type: "strength"`, and `description: "Strength training"`.

The `planInput` variable (type `PlanGenerationInput`) has `strengthTraining: boolean` and `strengthDays?: string[]`. Day keys are 3-letter lowercase: `"mon"`, `"tue"`, `"wed"`, `"thu"`, `"fri"`, `"sat"`, `"sun"`.

The existing `toLocaleDateString("en-CA")` pattern for ISO date formatting is used throughout the file (e.g., `getTodayISO()` in `dashboard/page.tsx` uses it). Use the same pattern here.

---

- [ ] **Step 1: Add `mergeStrengthDays()` as a module-level function**

  Add this function near the top of `apps/web/app/plan/page.tsx`, after the constant declarations (after `VALID_WORKOUT_TYPES`, before `interface SavedPlanSnapshot`):

  ```ts
  const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const

  function mergeStrengthDays(
    days: WorkoutDay[],
    strengthDays: string[],
    startDate: Date,
    endDate: Date,
  ): WorkoutDay[] {
    if (strengthDays.length === 0) return days
    const strengthSet = new Set(strengthDays)
    const result = [...days]
    const d = new Date(startDate.getTime())
    while (d <= endDate) {
      const key = DAY_KEYS[d.getDay()]
      if (key && strengthSet.has(key)) {
        result.push({
          date: d.toLocaleDateString("en-CA"),
          type: "strength",
          description: "Strength training",
        })
      }
      d.setDate(d.getDate() + 1)
    }
    return result
  }
  ```

- [ ] **Step 2: Call `mergeStrengthDays()` in the stream done block**

  Find the `done` block in the `stream()` function (around line 278). Current code:

  ```ts
  if (done) {
    if (totalWeeksRef.current === 0 || dayCountRef.current === 0) {
      setStatus("error")
    } else {
      const bridgeDays = buildBridgeRuns(planInput, localDays, new Date())
      if (bridgeDays.length > 0) {
        const mergedDays = [...bridgeDays, ...localDays].sort(
          (a, b) => a.date.localeCompare(b.date),
        )
        // Recompute totalKm from scratch — replaces the running total from streaming
        const newTotalKm = mergedDays.reduce((sum, d) => sum + (d.distanceKm ?? 0), 0)
        setPlan((p) => ({ ...p, days: mergedDays, totalKm: newTotalKm }))
      }
      setStatus("complete")
    }
    break
  }
  ```

  Replace with:

  ```ts
  if (done) {
    if (totalWeeksRef.current === 0 || dayCountRef.current === 0) {
      setStatus("error")
    } else {
      const bridgeDays = buildBridgeRuns(planInput, localDays, new Date())
      let finalDays: WorkoutDay[] = bridgeDays.length > 0
        ? [...bridgeDays, ...localDays].sort((a, b) => a.date.localeCompare(b.date))
        : localDays

      // Inject strength days (LLM no longer outputs them)
      if (planInput.strengthDays?.length && finalDays.length > 0) {
        finalDays = mergeStrengthDays(
          finalDays,
          planInput.strengthDays,
          new Date(finalDays[0]!.date + "T00:00:00"),
          new Date(finalDays[finalDays.length - 1]!.date + "T00:00:00"),
        )
      }

      const newTotalKm = finalDays.reduce((sum, d) => sum + (d.distanceKm ?? 0), 0)
      setPlan((p) => ({ ...p, days: finalDays, totalKm: newTotalKm }))
      setStatus("complete")
    }
    break
  }
  ```

- [ ] **Step 3: Typecheck**

  ```bash
  pnpm typecheck
  ```

  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add apps/web/app/plan/page.tsx
  git commit -m "feat: inject strength days in code after LLM stream instead of via LLM output"
  ```
