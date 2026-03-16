# Pfitzinger Audit Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close four Pfitzinger methodology gaps in the race prompt by adding `computeLongRunTargets()` (with tests) and making two system prompt text edits plus a user message injection.

**Architecture:** `computeLongRunTargets()` is a pure lookup function in `pace-calculator.ts` — same pattern as `computeTrainingStructure`. `buildPrompt()` calls it after `computeTrainingStructure`, injects the results as a user message block, and the system prompt gets two one-line text changes (recovery week frequency, day-after-long-run rule).

**Tech Stack:** TypeScript, Vitest (packages/ai test runner), pnpm monorepo with Turbo

---

## Chunk 1: `computeLongRunTargets` function + tests

### Task 1: `computeLongRunTargets` — tests first, then implementation

**Files:**
- Modify: `packages/ai/src/pace-calculator.test.ts` (append describe blocks at end of file)
- Modify: `packages/ai/src/pace-calculator.ts` (append function after `computeTrainingStructure`)

- [ ] **Step 1: Update the import in the test file**

  In `packages/ai/src/pace-calculator.test.ts`, line 2, change:
  ```ts
  import { calculatePaceZones, computePhases, computeGoalPeakMileage, calculateRawGoalPace, computeTrainingStructure } from "./pace-calculator"
  ```
  To:
  ```ts
  import { calculatePaceZones, computePhases, computeGoalPeakMileage, calculateRawGoalPace, computeTrainingStructure, computeLongRunTargets } from "./pace-calculator"
  ```

- [ ] **Step 2: Append the failing tests to `pace-calculator.test.ts`**

  Append to the end of `packages/ai/src/pace-calculator.test.ts`:

  ```ts
  // ─── computeLongRunTargets ─────────────────────────────────────────────────

  describe("computeLongRunTargets — full marathon, null peakWeeklyKm (mid-range fallback)", () => {
    const result = computeLongRunTargets("full", null, "1-3")
    it("peakLongRunKm: 35", () => { expect(result.peakLongRunKm).toBe(35) })
    it("recoveryRunMaxKm: 13", () => { expect(result.recoveryRunMaxKm).toBe(13) })
  })

  describe("computeLongRunTargets — full marathon, high=60 (< 65 bucket)", () => {
    const result = computeLongRunTargets("full", { low: 45, high: 60 }, "1-3")
    it("peakLongRunKm: 29", () => { expect(result.peakLongRunKm).toBe(29) })
    it("recoveryRunMaxKm: 11", () => { expect(result.recoveryRunMaxKm).toBe(11) })
  })

  describe("computeLongRunTargets — full marathon, high=80 (< 90 bucket)", () => {
    const result = computeLongRunTargets("full", { low: 65, high: 80 }, "1-3")
    it("peakLongRunKm: 35", () => { expect(result.peakLongRunKm).toBe(35) })
    it("recoveryRunMaxKm: 13", () => { expect(result.recoveryRunMaxKm).toBe(13) })
  })

  describe("computeLongRunTargets — full marathon, high=100 (< 116 bucket)", () => {
    const result = computeLongRunTargets("full", { low: 80, high: 100 }, "1-3")
    it("peakLongRunKm: 38", () => { expect(result.peakLongRunKm).toBe(38) })
    it("recoveryRunMaxKm: 16", () => { expect(result.recoveryRunMaxKm).toBe(16) })
  })

  describe("computeLongRunTargets — full marathon, high=130 (>= 116 bucket)", () => {
    const result = computeLongRunTargets("full", { low: 110, high: 130 }, "1-3")
    it("peakLongRunKm: 38", () => { expect(result.peakLongRunKm).toBe(38) })
    it("recoveryRunMaxKm: 16", () => { expect(result.recoveryRunMaxKm).toBe(16) })
  })

  describe("computeLongRunTargets — half marathon, null peakWeeklyKm (mid-range fallback)", () => {
    const result = computeLongRunTargets("half", null, undefined)
    it("peakLongRunKm: 22", () => { expect(result.peakLongRunKm).toBe(22) })
    it("recoveryRunMaxKm: 11", () => { expect(result.recoveryRunMaxKm).toBe(11) })
  })

  describe("computeLongRunTargets — half marathon, high=45 (< 50 bucket)", () => {
    const result = computeLongRunTargets("half", { low: 35, high: 45 }, "1-3")
    it("peakLongRunKm: 19", () => { expect(result.peakLongRunKm).toBe(19) })
    it("recoveryRunMaxKm: 9", () => { expect(result.recoveryRunMaxKm).toBe(9) })
  })

  describe("computeLongRunTargets — half marathon, high=65 (< 75 bucket)", () => {
    const result = computeLongRunTargets("half", { low: 55, high: 65 }, "1-3")
    it("peakLongRunKm: 22", () => { expect(result.peakLongRunKm).toBe(22) })
    it("recoveryRunMaxKm: 11", () => { expect(result.recoveryRunMaxKm).toBe(11) })
  })

  describe("computeLongRunTargets — half marathon, high=80 (>= 75 bucket)", () => {
    const result = computeLongRunTargets("half", { low: 65, high: 80 }, "1-3")
    it("peakLongRunKm: 26", () => { expect(result.peakLongRunKm).toBe(26) })
    it("recoveryRunMaxKm: 13", () => { expect(result.recoveryRunMaxKm).toBe(13) })
  })

  describe("computeLongRunTargets — 5k, null peakWeeklyKm (mid-range fallback)", () => {
    const result = computeLongRunTargets("5k", null, "1-3")
    it("peakLongRunKm: 13", () => { expect(result.peakLongRunKm).toBe(13) })
    it("recoveryRunMaxKm: 8", () => { expect(result.recoveryRunMaxKm).toBe(8) })
  })

  describe("computeLongRunTargets — 5k, high=40 (< 45 bucket)", () => {
    const result = computeLongRunTargets("5k", { low: 30, high: 40 }, "1-3")
    it("peakLongRunKm: 11", () => { expect(result.peakLongRunKm).toBe(11) })
    it("recoveryRunMaxKm: 7", () => { expect(result.recoveryRunMaxKm).toBe(7) })
  })

  describe("computeLongRunTargets — 5k, high=55 (< 65 bucket)", () => {
    const result = computeLongRunTargets("5k", { low: 45, high: 55 }, "1-3")
    it("peakLongRunKm: 13", () => { expect(result.peakLongRunKm).toBe(13) })
    it("recoveryRunMaxKm: 8", () => { expect(result.recoveryRunMaxKm).toBe(8) })
  })

  describe("computeLongRunTargets — 10k, high=70 (>= 65 bucket)", () => {
    const result = computeLongRunTargets("10k", { low: 60, high: 70 }, "1-3")
    it("peakLongRunKm: 16", () => { expect(result.peakLongRunKm).toBe(16) })
    it("recoveryRunMaxKm: 10", () => { expect(result.recoveryRunMaxKm).toBe(10) })
  })

  describe("computeLongRunTargets — ultra (fixed values, peakWeeklyKm ignored)", () => {
    const result = computeLongRunTargets("ultra", { low: 50, high: 100 }, "1-3")
    it("peakLongRunKm: 32", () => { expect(result.peakLongRunKm).toBe(32) })
    it("recoveryRunMaxKm: 14", () => { expect(result.recoveryRunMaxKm).toBe(14) })
  })

  describe("computeLongRunTargets — ultra, null peakWeeklyKm", () => {
    const result = computeLongRunTargets("ultra", null, "1-3")
    it("peakLongRunKm: 32", () => { expect(result.peakLongRunKm).toBe(32) })
    it("recoveryRunMaxKm: 14", () => { expect(result.recoveryRunMaxKm).toBe(14) })
  })

  describe("computeLongRunTargets — unknown distance, null peakWeeklyKm (unknown fallback)", () => {
    const result = computeLongRunTargets("obstacle-course", null, undefined)
    it("peakLongRunKm: 29", () => { expect(result.peakLongRunKm).toBe(29) })
    it("recoveryRunMaxKm: 11", () => { expect(result.recoveryRunMaxKm).toBe(11) })
  })

  describe("computeLongRunTargets — under-1 training age reduces peakLongRunKm by 3", () => {
    it("full, high=80: 35 - 3 = 32", () => {
      const result = computeLongRunTargets("full", { low: 65, high: 80 }, "under-1")
      expect(result.peakLongRunKm).toBe(32)
      expect(result.recoveryRunMaxKm).toBe(13)  // recoveryRunMaxKm unchanged
    })

    it("full, high=60: 29 - 3 = 26", () => {
      const result = computeLongRunTargets("full", { low: 45, high: 60 }, "under-1")
      expect(result.peakLongRunKm).toBe(26)
    })

    it("5k, high=40: 11 - 3 = 8, but Math.max(13, 8) = 13", () => {
      const result = computeLongRunTargets("5k", { low: 30, high: 40 }, "under-1")
      expect(result.peakLongRunKm).toBe(13)
      expect(result.recoveryRunMaxKm).toBe(7)  // recoveryRunMaxKm unchanged
    })
  })

  describe("computeLongRunTargets — 3-or-more and undefined training age: no modifier", () => {
    const base = computeLongRunTargets("full", { low: 65, high: 80 }, "1-3")

    it("3-or-more matches 1-3", () => {
      const result = computeLongRunTargets("full", { low: 65, high: 80 }, "3-or-more")
      expect(result.peakLongRunKm).toBe(base.peakLongRunKm)
      expect(result.recoveryRunMaxKm).toBe(base.recoveryRunMaxKm)
    })

    it("undefined matches 1-3", () => {
      const result = computeLongRunTargets("full", { low: 65, high: 80 }, undefined)
      expect(result.peakLongRunKm).toBe(base.peakLongRunKm)
      expect(result.recoveryRunMaxKm).toBe(base.recoveryRunMaxKm)
    })
  })
  ```

- [ ] **Step 3: Run tests to verify they fail**

  ```bash
  pnpm --filter @workspace/ai test -- --reporter=verbose 2>&1 | grep -E "computeLongRunTargets|FAIL|Error" | head -20
  ```

  Expected: `computeLongRunTargets is not a function` (or similar import error). If you see passing tests instead of failures, stop — the function already exists somewhere.

- [ ] **Step 4: Implement `computeLongRunTargets` in `pace-calculator.ts`**

  Append to the end of `packages/ai/src/pace-calculator.ts` (after the closing brace of `computeTrainingStructure`):

  ```ts
  // ─── Long run targets ────────────────────────────────────────────────────────

  /**
   * Derive Pfitzinger-based long run targets from race distance and peak weekly
   * volume. Used to inject hard constraints into the LLM prompt.
   *
   * peakWeeklyKm is the output of computeGoalPeakMileage (already called in
   * buildPrompt). When null (no goal time), falls back to the mid-range row for
   * each distance. recoveryRunMaxKm is NOT modified by training age.
   */
  export function computeLongRunTargets(
    distance: string,
    peakWeeklyKm: { low: number; high: number } | null,
    trainingAge: string | undefined,
  ): { peakLongRunKm: number; recoveryRunMaxKm: number } {
    let peakLongRunKm: number
    let recoveryRunMaxKm: number

    const high = peakWeeklyKm?.high ?? null

    if (distance === "full") {
      if (high === null)    { peakLongRunKm = 35; recoveryRunMaxKm = 13 }
      else if (high < 65)  { peakLongRunKm = 29; recoveryRunMaxKm = 11 }
      else if (high < 90)  { peakLongRunKm = 35; recoveryRunMaxKm = 13 }
      else if (high < 116) { peakLongRunKm = 38; recoveryRunMaxKm = 16 }
      else                 { peakLongRunKm = 38; recoveryRunMaxKm = 16 }
    } else if (distance === "half") {
      if (high === null)    { peakLongRunKm = 22; recoveryRunMaxKm = 11 }
      else if (high < 50)  { peakLongRunKm = 19; recoveryRunMaxKm = 9  }
      else if (high < 75)  { peakLongRunKm = 22; recoveryRunMaxKm = 11 }
      else                 { peakLongRunKm = 26; recoveryRunMaxKm = 13 }
    } else if (distance === "5k" || distance === "10k") {
      if (high === null)    { peakLongRunKm = 13; recoveryRunMaxKm = 8  }
      else if (high < 45)  { peakLongRunKm = 11; recoveryRunMaxKm = 7  }
      else if (high < 65)  { peakLongRunKm = 13; recoveryRunMaxKm = 8  }
      else                 { peakLongRunKm = 16; recoveryRunMaxKm = 10 }
    } else if (distance === "ultra") {
      peakLongRunKm = 32; recoveryRunMaxKm = 14
    } else {
      // Unknown distance: mid-range full marathon defaults
      peakLongRunKm = 29; recoveryRunMaxKm = 11
    }

    // Training age modifier — applied after distance lookup, before returning.
    // Only "under-1" gets a modifier; recoveryRunMaxKm is intentionally unchanged.
    if (trainingAge === "under-1") {
      peakLongRunKm = Math.max(13, peakLongRunKm - 3)
    }

    return { peakLongRunKm, recoveryRunMaxKm }
  }
  ```

- [ ] **Step 5: Run tests to verify they pass**

  ```bash
  pnpm --filter @workspace/ai test -- --reporter=verbose 2>&1 | tail -20
  ```

  Expected: all `computeLongRunTargets` describe blocks pass. Overall test count increases by 37 (18 describe blocks, most with 2 `it()` calls each plus the `under-1` block's 3). No previously-passing tests should regress.

- [ ] **Step 6: Typecheck**

  ```bash
  pnpm typecheck
  ```

  Expected: no errors.

- [ ] **Step 7: Commit**

  ```bash
  git add packages/ai/src/pace-calculator.ts packages/ai/src/pace-calculator.test.ts
  git commit -m "feat: add computeLongRunTargets with Pfitzinger-based long run targets"
  ```

---

## Chunk 2: `buildPrompt()` changes — system prompt + user message injection

### Task 2: System prompt text edits (gaps 1 and 4)

**Files:**
- Modify: `packages/ai/src/race-prompt.ts` (two one-line text changes inside `buildSystemPrompt()`)

- [ ] **Step 1: Fix recovery week frequency (gap 1)**

  In `packages/ai/src/race-prompt.ts`, find this line (currently line 103):
  ```
  - Follow the 10% weekly mileage increase rule; include a recovery week (30% mileage reduction) every 4th week
  ```
  Change `every 4th week` to `every 3rd week`:
  ```
  - Follow the 10% weekly mileage increase rule; include a recovery week (30% mileage reduction) every 3rd week
  ```

- [ ] **Step 2: Fix day-after-long-run rule (gap 4)**

  In `packages/ai/src/race-prompt.ts`, find this line (currently line 62):
  ```
  - The day after the long run must be rest or easy only
  ```
  Replace with:
  ```
  - The day after the long run must be rest, an easy recovery run (≤ the day-after-long-run max from the user message), or a medium-long run for athletes with 1–3 or 3-or-more years of running — never a quality session
  ```

- [ ] **Step 3: Typecheck**

  ```bash
  pnpm typecheck
  ```

  Expected: no errors (these are string-only changes inside a template literal).

- [ ] **Step 4: Commit**

  ```bash
  git add packages/ai/src/race-prompt.ts
  git commit -m "fix: update Pfitzinger system prompt — recovery week every 3rd, day-after-long-run rule"
  ```

---

### Task 3: Wire `computeLongRunTargets` into `buildPrompt()`

**Files:**
- Modify: `packages/ai/src/race-prompt.ts` (import, call site after `computeTrainingStructure`, user message injection after section 5b)

- [ ] **Step 1: Add `computeLongRunTargets` to the import**

  In `packages/ai/src/race-prompt.ts`, line 2, change:
  ```ts
  import { calculatePaceZones, computePhases, computeGoalPeakMileage, calculateRawGoalPace, computeTrainingStructure } from "./pace-calculator"
  ```
  To:
  ```ts
  import { calculatePaceZones, computePhases, computeGoalPeakMileage, calculateRawGoalPace, computeTrainingStructure, computeLongRunTargets } from "./pace-calculator"
  ```

- [ ] **Step 2: Add the `computeLongRunTargets` call site**

  After the `computeTrainingStructure` block (currently ending around line 234), find this exact text:
  ```ts
    const trainingStructure = computeTrainingStructure(
      goalMinutes,
      distance,
      input.trainingAge,
      input.selectedDays.length,
      input.weeklyMileageRange,
    )

    // ── User message ─────────────────────────────────────────────────────────
  ```
  Replace with:
  ```ts
    const trainingStructure = computeTrainingStructure(
      goalMinutes,
      distance,
      input.trainingAge,
      input.selectedDays.length,
      input.weeklyMileageRange,
    )

    // ── Long run targets ─────────────────────────────────────────────────────
    const longRunTargets = computeLongRunTargets(
      distance,
      peakMileage,
      input.trainingAge,
    )

    // ── User message ─────────────────────────────────────────────────────────
  ```

- [ ] **Step 3: Inject the long run targets block into the user message**

  After section 5b (the last `lines.push` of the "Prescribed training structure" block), find this exact text:
  ```ts
    lines.push(`  Max quality sessions per week: ${trainingStructure.maxQualityPerWeek}`)

    // 6. Schedule
  ```
  Replace with:
  ```ts
    lines.push(`  Max quality sessions per week: ${trainingStructure.maxQualityPerWeek}`)

    // 5c. Long run targets
    lines.push("")
    lines.push("Long run targets (Pfitzinger-based — treat as hard constraints):")
    lines.push(`  Peak long run: ~${longRunTargets.peakLongRunKm} km (build toward this in Peak phase — do not exceed)`)
    lines.push(`  Day-after-long-run max: ${longRunTargets.recoveryRunMaxKm} km (easy recovery or medium-long — never quality)`)

    // 6. Schedule
  ```

- [ ] **Step 4: Typecheck**

  ```bash
  pnpm typecheck
  ```

  Expected: no errors. If you see `Property 'peakLongRunKm' does not exist`, the import in Step 1 was not applied correctly.

- [ ] **Step 5: Commit**

  ```bash
  git add packages/ai/src/race-prompt.ts
  git commit -m "feat: inject computeLongRunTargets into buildPrompt — long run ceiling and day-after max"
  ```
