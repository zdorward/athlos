---
title: Strength Day Spacing Fix
date: 2026-03-16
status: approved
---

## Problem

`recommendStrengthDays()` in `packages/ai/src/strength-recommendation.ts` sorts candidates by circular distance from the long run day and returns the top `count` days using `sorted.slice(0, count)`. This does not account for adjacency between selected days.

For a Sunday long run with `count=2`, both Wednesday (distance 3) and Thursday (distance 3) rank equally and both appear in the top 2 due to the ascending-index tiebreak. The result is back-to-back strength days, which violates the 48-hour recovery principle central to the Pfitzinger methodology the app uses.

## Decision

Replace `sorted.slice(0, count)` with a greedy picker that skips any candidate adjacent to an already-selected day. The existing sort logic (circular distance descending, ascending index tiebreak) is unchanged.

This affects only the **recommendation** shown during onboarding. Users can still override to any days they choose.

## Design

### What changes

**File:** `packages/ai/src/strength-recommendation.ts`

Replace:
```ts
return sorted.slice(0, count)
```

With a greedy loop:
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

Add a helper (reusing the existing `circularDist` function for consistency):
```ts
function areAdjacent(a: Day, b: Day): boolean {
  return circularDist(DAY_INDEX[a], DAY_INDEX[b]) === 1
}
```

Also update the JSDoc on `recommendStrengthDays` to describe the greedy picker — step 3 currently says "Return the first `count` days" which will be stale after this change.

### Behaviour

- The sort order is preserved — the algorithm still prefers days furthest from the long run day.
- A candidate is skipped only if it is circularly adjacent (distance = 1) to any already-selected day.
- If the picker exhausts all candidates before reaching `count`, it returns however many non-adjacent days it found. It does not fall back to consecutive days.

### Example

Sunday long run, `count=2`. Sorted order: Wed(3), Thu(3), Tue(2), Fri(2), Mon(1), Sat(1), Sun(0).

| Candidate | Adjacent to selected? | Action |
|-----------|----------------------|--------|
| Wed | — (none selected) | ✅ pick |
| Thu | Wed (|3−4|=1) | ❌ skip |
| Tue | Wed (|2−3|=1) | ❌ skip |
| Fri | Wed (|3−5|=2) | ✅ pick |

Result: **Wed + Fri** (was Wed + Thu).

### What does not change

- `peakStrengthDay()` — picks the single best day for Peak phase, already returns one day so adjacency is irrelevant
- `mergeStrengthDays()` in `apps/web/app/plan/page.tsx` — consumes the recommendation as-is
- Onboarding UI — still shows the recommendation but allows override
- The `count` function (`recommendStrengthCount`) — unchanged

## What is not in scope

- Enforcing spacing on user-overridden selections (user intent takes precedence)
- Avoiding strength on the day before/after quality running sessions (separate concern, handled by LLM prompt)
