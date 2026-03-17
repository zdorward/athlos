# Design: Fix Week-Boundary Adjacency Bug in Scheduler

**Date:** 2026-03-17
**Status:** Approved

---

## Problem

The scheduler places quality sessions (tempo, intervals, MP) on the day immediately after the long run when the long run falls on Sunday. This violates the core scheduling constraint that quality sessions must not be adjacent to the long run.

**Root cause:** `isAdjacentTo` computes `Math.abs(a - b) === 1` using raw day indices (mon=0 … sun=6). For Sunday (6) and Monday (0): `Math.abs(6 - 0) = 6 ≠ 1`, so the function incorrectly returns `false` — it does not recognize Sun and Mon as adjacent. The week is circular; the function is not.

**Affected configurations:**
- Long run on Sunday → Monday quality session incorrectly allowed
- Long run on Monday → Sunday quality session incorrectly allowed (less common but same bug)

**All other long run days** (Tue–Sat) have no wrap-around issue.

**Science basis:** The training science doc states quality sessions must not be placed adjacent to the long run. A tempo run the day after a 30 km long run compromises recovery and degrades workout quality — the athlete cannot run at threshold effort with glycogen-depleted, fatigued legs.

---

## Fix

**File:** `packages/plan-engine/src/workout-scheduler.ts`

`isAdjacentTo` must use circular week distance. The file already contains `circularDist`, which computes `Math.min(Math.abs(a - b), 7 - Math.abs(a - b))` — exactly the right model for a 7-day circular week.

**Change:**

```typescript
// Before:
function isAdjacentTo(day: string, targetDay: string): boolean {
  const a = DAY_INDEX[day] ?? -1
  const b = DAY_INDEX[targetDay] ?? -1
  return Math.abs(a - b) === 1
}

// After:
function isAdjacentTo(day: string, targetDay: string): boolean {
  const a = DAY_INDEX[day] ?? -1
  const b = DAY_INDEX[targetDay] ?? -1
  if (a === -1 || b === -1) return false
  return circularDist(a, b) === 1
}
```

The guard `if (a === -1 || b === -1) return false` is added because the original code used `-1` as a sentinel for unknown keys. With the old formula, `Math.abs(-1 - 0) = 1` would incorrectly return `true` for an unknown day adjacent to Monday. The guard makes the unknown-key behavior explicit and correct.

**Verification:** `circularDist(6, 0) = Math.min(6, 1) = 1` → Sun/Mon correctly adjacent. `circularDist(0, 6) = 1` → Mon/Sun correctly adjacent. All other pairs unchanged.

---

## Scope

`isAdjacentTo` is called in three places in `scheduleWorkouts`:

1. **Quality-to-long-run adjacency** (line 252): `!isAdjacentTo(dayKey, longRunDay)` — prevents quality sessions adjacent to the long run. **This is the visible bug.**
2. **Quality-to-quality adjacency** (line 255): `!isAdjacentTo(dayKey, pDayKey)` — prevents two quality sessions on adjacent days. Also fixed by this change (two quality sessions could previously land on Sun/Mon).
3. **Strength-to-long-run adjacency** (line ~317): `!isAdjacentTo(dayKey, longRunDay)` — prevents strength sessions adjacent to the long run. Also fixed.

No interface changes. No new types. One file, one function.

---

## Files Changed

| File | Change |
|------|--------|
| `packages/plan-engine/src/workout-scheduler.ts` | Fix `isAdjacentTo` to use `circularDist` |
| `packages/plan-engine/src/workout-scheduler.test.ts` | Add adjacency wrap-around tests |

---

## Testing

- Unit test: `longRunDay = "sun"`, selected days include `"mon"` — quality session must NOT land on Monday
- Unit test: `longRunDay = "mon"`, selected days include `"sun"` — quality session must NOT land on Sunday
- Unit test: `longRunDay = "wed"`, selected days include `"mon"` — Monday IS a valid quality day (not adjacent to Wednesday)
- Unit test: `longRunDay = "sun"`, `"sat"` selected — Saturday must not get a quality session (adjacent to Sunday — already worked, regression guard)
- Regression: all existing scheduler tests pass unchanged
