# Build Phase Interval Distribution

**Date:** 2026-03-17
**Status:** Approved

## Overview

Fix the early/late Build phase split so VO2max interval sessions are distributed as a meaningful sharpening stimulus across all plan lengths. Currently, certain plan lengths (16, 18, 21 weeks) produce only 1 interval session because the 50/50 early/late split places a recovery week at the boundary of early Build, consuming the only non-recovery early-Build week.

The fix: change the early/late boundary from 50% to 60% of Build weeks.

---

## Problem

In `getQualityConfig` (`packages/plan-engine/src/workout-scheduler.ts`), the early/late Build boundary is:

```ts
const slot = localIndex < Math.floor(buildLength / 2)
```

Early Build weeks receive `["tempo", "intervals"]`; late Build weeks receive `["tempo", "mp"]`. Recovery weeks (any week where `week % 4 === 0`) drop to 1 quality session (tempo only).

For a 21-week plan, Build = W11–15. `Math.floor(5 / 2) = 2`, so early Build = W11–12. W12 is a recovery week, leaving W11 as the **only non-recovery early Build week** — 1 intervals session total. Exercise physiology research on VO2max adaptation requires 3–5 weeks of consistent interval stimulus; 1 session provides no meaningful adaptation.

The same structural problem affects 16-week and 18-week plans.

---

## Fix

**File:** `packages/plan-engine/src/workout-scheduler.ts`

Replace:
```ts
const slot = localIndex < Math.floor(buildLength / 2)
```

With:
```ts
const slot = localIndex < Math.ceil(buildLength * 0.6)
```

### Effect by plan length

| Plan | Build | Early (before) | Early (after) | Intervals (before → after) |
|------|-------|----------------|---------------|---------------------------|
| 16-week | 4 wks | 2 wks (W7–8, W8=recovery) | 3 wks (W7–9) | 1 → 2 |
| 18-week | 5 wks | 2 wks (W8–9, W8=recovery) | 3 wks (W8–10) | 1 → 2 |
| 20-week | 6 wks | 3 wks (W9–11) | 4 wks (W9–12, W12=recovery) | 3 → 3 |
| 21-week | 5 wks | 2 wks (W11–12, W12=recovery) | 3 wks (W11–13) | 1 → 2 |
| 24-week | 6 wks | 3 wks (W13–15) | 4 wks (W13–16, W16=recovery) | 3 → 3 |

20-week and 24-week plans are unaffected — their recovery weeks already fell outside the old 50% boundary. The fix only changes behavior for plans where a recovery week was the last early-Build week.

### MP volume tradeoff

For affected plan lengths, late Build shrinks by 1 week. For a 21-week plan, late Build goes from W13–15 (3 MP sessions) to W14–15 (2 MP sessions in Build). Peak (W16–18) is unchanged — 2 MP sessions. Total MP sessions: 5 → 4. The science doc's requirement that MP dominate the final 6–8 weeks is still satisfied.

---

## Science Rationale

From `docs/training-science/modern-marathon-science.md`:

> VO2max intervals are most effective as a **sharpening stimulus** in mid-Build after threshold capacity is established.

A single interval session cannot constitute a sharpening stimulus. The 60% split ensures early Build spans the majority of the Build phase, giving at least 2 non-recovery early-Build weeks for meaningful interval exposure before the plan transitions to MP work.

---

## Out of Scope

- No changes to recovery week policy (still 1 tempo on recovery weeks in Build)
- No changes to late Build session types (still `["tempo", "mp"]`)
- No changes to `computePhases` or phase durations
- No UI changes

---

## Files Changed

| File | Change |
|------|--------|
| `packages/plan-engine/src/workout-scheduler.ts` | Change `Math.floor(buildLength / 2)` to `Math.ceil(buildLength * 0.6)` in `getQualityConfig` |
| `packages/plan-engine/src/workout-scheduler.test.ts` | Update/add tests verifying interval session counts for 16, 18, and 21-week plans |
