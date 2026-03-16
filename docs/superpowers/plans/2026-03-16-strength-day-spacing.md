# Strength Day Spacing Fix Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix `recommendStrengthDays()` to never recommend back-to-back strength days by replacing `sorted.slice(0, count)` with a greedy adjacency-aware picker.

**Architecture:** Single function change in `packages/ai/src/strength-recommendation.ts`. The existing sort (circular distance from long run day, ascending index tiebreak) is unchanged — only the selection step changes. An `areAdjacent()` helper is added that reuses the existing `circularDist` function. Three existing tests assert the old (wrong) behavior and must be updated; new tests cover the adjacency constraint explicitly.

**Tech Stack:** TypeScript, Vitest

---

## Chunk 1: Fix the implementation with TDD

### Task 1: Update existing tests and add new adjacency tests

**Files:**
- Modify: `packages/ai/src/strength-recommendation.test.ts`

The existing test file at `packages/ai/src/strength-recommendation.test.ts` has three tests that assert the old back-to-back behavior. These must be updated to the correct expected values before touching the implementation, so they fail and confirm the fix is needed.

**New expected values (derived from the greedy picker algorithm):**

| Long run | count | Old (wrong) | New (correct) |
|----------|-------|-------------|---------------|
| Sunday   | 2     | wed, thu    | wed, fri      |
| Saturday | 2     | tue, wed    | tue, thu      |
| Wednesday| 2     | sun, sat    | sun, fri      |

Why:
- **Sunday + 2**: sorted=[wed(3),thu(3),tue(2),fri(2),...]. Pick wed. Thu adjacent to wed (|3-4|=1) → skip. Tue adjacent to wed (|2-3|=1) → skip. Fri not adjacent (|3-5|=2) → pick. Result: wed, fri.
- **Saturday + 2**: sorted=[tue(3),wed(3),mon(2),thu(2),...]. Pick tue. Wed adjacent to tue (|2-3|=1) → skip. Mon adjacent to tue (|1-2|=1) → skip. Thu not adjacent (|2-4|=2) → pick. Result: tue, thu.
- **Wednesday + 2**: sorted=[sun(3),sat(3),mon(2),fri(2),...]. Pick sun. Sat adjacent to sun circularly (min(|6-0|,7-6)=min(6,1)=1) → skip. Mon adjacent to sun (|1-0|=1) → skip. Fri not adjacent (min(|5-0|,7-5)=min(5,2)=2) → pick. Result: sun, fri.

- [ ] **Step 1: Update the three stale tests**

In `packages/ai/src/strength-recommendation.test.ts`, find the `describe("recommendStrengthDays")` block and update these three tests:

```ts
it("Sunday long run, count 2 → wed, fri (non-consecutive; thu skipped as adjacent to wed)", () => {
  expect(recommendStrengthDays("sun", 2)).toEqual(["wed", "fri"])
})
it("Saturday long run, count 2 → tue, thu (non-consecutive; wed skipped as adjacent to tue)", () => {
  expect(recommendStrengthDays("sat", 2)).toEqual(["tue", "thu"])
})
it("Wednesday long run, count 2 → sun, fri (non-consecutive; sat skipped as adjacent to sun)", () => {
  // Wed idx=3. Sorted: sun(3), sat(3), mon(2), fri(2),...
  // Sun and Sat are circularly adjacent (min(6,1)=1), so Sat is skipped.
  expect(recommendStrengthDays("wed", 2)).toEqual(["sun", "fri"])
})
```

- [ ] **Step 2: Add new tests that explicitly cover the adjacency constraint**

Add a new `describe` block inside `describe("recommendStrengthDays")`:

```ts
describe("adjacency constraint — no back-to-back days", () => {
  it("result never contains two consecutive days (sun long run, count 2)", () => {
    const result = recommendStrengthDays("sun", 2)
    expect(result).toHaveLength(2)
    const [a, b] = result as [string, string]
    const DAY_INDEX: Record<string, number> = { sun:0, mon:1, tue:2, wed:3, thu:4, fri:5, sat:6 }
    const diff = Math.abs(DAY_INDEX[a]! - DAY_INDEX[b]!)
    const circDist = Math.min(diff, 7 - diff)
    expect(circDist).toBeGreaterThan(1)
  })
  it("result never contains two consecutive days (sat long run, count 2)", () => {
    const result = recommendStrengthDays("sat", 2)
    expect(result).toHaveLength(2)
    const [a, b] = result as [string, string]
    const DAY_INDEX: Record<string, number> = { sun:0, mon:1, tue:2, wed:3, thu:4, fri:5, sat:6 }
    const diff = Math.abs(DAY_INDEX[a]! - DAY_INDEX[b]!)
    const circDist = Math.min(diff, 7 - diff)
    expect(circDist).toBeGreaterThan(1)
  })
  it("result never contains two consecutive days (wed long run, count 2)", () => {
    const result = recommendStrengthDays("wed", 2)
    expect(result).toHaveLength(2)
    const [a, b] = result as [string, string]
    const DAY_INDEX: Record<string, number> = { sun:0, mon:1, tue:2, wed:3, thu:4, fri:5, sat:6 }
    const diff = Math.abs(DAY_INDEX[a]! - DAY_INDEX[b]!)
    const circDist = Math.min(diff, 7 - diff)
    expect(circDist).toBeGreaterThan(1)
  })
})
```

- [ ] **Step 3: Run tests to confirm the 3 updated tests and 3 new tests fail**

Run from the repo root:

```bash
pnpm --filter @workspace/ai test
```

Expected: 6 failures. The 3 updated tests should fail because the implementation still returns the old values. The 3 new adjacency tests should also fail for the same reason. All other tests should still pass.

If fewer than 6 tests fail, re-check the test edits.

---

### Task 2: Implement the fix

**Files:**
- Modify: `packages/ai/src/strength-recommendation.ts`

- [ ] **Step 1: Add the `areAdjacent` helper**

In `packages/ai/src/strength-recommendation.ts`, add this function after the existing `circularDist` function (currently the last function in the file, line 54):

```ts
function areAdjacent(a: Day, b: Day): boolean {
  return circularDist(DAY_INDEX[a], DAY_INDEX[b]) === 1
}
```

- [ ] **Step 2: Replace `sorted.slice(0, count)` with the greedy picker**

In `recommendStrengthDays()`, replace:

```ts
return sorted.slice(0, count)
```

With:

```ts
const selected: Day[] = []
for (const candidate of sorted) {
  if (selected.every(s => !areAdjacent(s, candidate))) {
    selected.push(candidate)
    if (selected.length === count) break
  }
}
return selected
```

- [ ] **Step 3: Update the JSDoc on `recommendStrengthDays`**

The current JSDoc step 3 says "Return the first `count` days." Update it to:

```ts
/**
 * Recommend which days to lift, ranked by circular distance from the long run day,
 * with no two recommended days on consecutive days of the week.
 *
 * Algorithm:
 * 1. Compute circular distance for each day: min(|idx - longIdx|, 7 - |idx - longIdx|)
 * 2. Sort descending by distance; break ties by ascending DAY_INDEX (Sun=0 wins over Mon=1, etc.)
 * 3. Walk the sorted list greedily; skip any candidate circularly adjacent (distance = 1)
 *    to an already-selected day. Return up to `count` days.
 */
```

- [ ] **Step 4: Run tests — expect all to pass**

```bash
pnpm --filter @workspace/ai test
```

Expected: all tests pass including the 6 previously failing tests. If any test still fails, read the failure message and fix the implementation before continuing.

- [ ] **Step 5: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/ai/src/strength-recommendation.ts packages/ai/src/strength-recommendation.test.ts
git commit -m "fix: space out strength day recommendations — no consecutive days"
```
