# Adaptive Training Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add post-workout feedback collection (effort + soreness) with rules-based load detection and athlete-approved plan swaps.

**Architecture:** Two new DB tables (`workout_logs`, `adaptation_suggestions`) store feedback and generated suggestions. Pure adaptation logic lives in `packages/ai/src/adaptation.ts` (no DB calls, easily testable). Three new API routes handle log submission (which runs the adaptation check) and suggestion accept/dismiss. The dashboard gains a feedback bottom sheet and a suggestion card.

**Tech Stack:** Drizzle ORM + Neon Postgres, Vitest, Next.js App Router, React, shadcn/ui (Sheet, Button)

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `packages/db/src/schema.ts` | Modify | Add `workoutLogs` and `adaptationSuggestions` tables |
| `packages/db/drizzle/` | Generate | New migration via `drizzle-kit generate` |
| `packages/ai/src/adaptation.ts` | Create | Pure functions: `deriveExpectedEffort`, `buildReplacementWorkout`, `checkAdaptationTrigger` |
| `packages/ai/src/adaptation.test.ts` | Create | Vitest unit tests for all adaptation logic |
| `packages/ai/src/index.ts` | Modify | Export adaptation types and functions |
| `apps/web/app/api/plans/[id]/workouts/[date]/log/route.ts` | Create | POST log endpoint |
| `apps/web/app/api/plans/[id]/suggestions/[suggestionId]/accept/route.ts` | Create | PATCH accept endpoint |
| `apps/web/app/api/plans/[id]/suggestions/[suggestionId]/dismiss/route.ts` | Create | PATCH dismiss endpoint |
| `apps/web/app/(app)/dashboard/workout-feedback-sheet.tsx` | Create | Bottom sheet: effort + soreness questions |
| `apps/web/app/(app)/dashboard/adaptation-suggestion-card.tsx` | Create | Non-blocking card showing pending suggestion |
| `apps/web/app/(app)/dashboard/today-workout-card.tsx` | Modify | Remove inline effort picker and `onLogEffort` prop |
| `apps/web/app/(app)/dashboard/page.tsx` | Modify | Wire feedback sheet, suggestion card, updated handlers |

---

## Chunk 1: DB Schema + Adaptation Logic

### Task 1: Add tables to DB schema

**Files:**
- Modify: `packages/db/src/schema.ts`

- [ ] **Step 1: Add imports and tables to schema**

Open `packages/db/src/schema.ts` and add `uniqueIndex` to the existing imports, then append the two new tables after the `plans` table:

```typescript
// Add uniqueIndex to the existing import at the top:
import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  integer,
  numeric,
  jsonb,
  uniqueIndex,   // ← add this
} from "drizzle-orm/pg-core"
```

Append to the bottom of the file:

```typescript
export const workoutLogs = pgTable(
  "workout_logs",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "cascade" }),
    workoutDate: text("workout_date").notNull(),
    workoutType: text("workout_type").notNull(),
    expectedEffort: text("expected_effort").notNull(),
    actualEffort: text("actual_effort").notNull(),
    completed: boolean("completed").notNull(),
    soreness: text("soreness").notNull(),
    loggedAt: timestamp("logged_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("workout_logs_plan_date_type_idx").on(
      table.planId,
      table.workoutDate,
      table.workoutType,
    ),
  ],
)

export const adaptationSuggestions = pgTable("adaptation_suggestions", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  planId: uuid("plan_id")
    .notNull()
    .references(() => plans.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  reason: text("reason").notNull(),
  targetDate: text("target_date").notNull(),
  originalWorkout: jsonb("original_workout").notNull(),
  proposedWorkout: jsonb("proposed_workout").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
})
```

- [ ] **Step 2: Generate migration**

```bash
cd packages/db && pnpm drizzle-kit generate
```

Expected: a new `.sql` file appears in `packages/db/drizzle/` containing `CREATE TABLE workout_logs` and `CREATE TABLE adaptation_suggestions`.

- [ ] **Step 3: Run migration against the database**

```bash
cd packages/db && pnpm drizzle-kit migrate
```

Expected: output confirms both tables created. If you see "No pending migrations", double-check that the generated file is present in the `drizzle/` folder.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /path/to/repo && pnpm typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema.ts packages/db/drizzle/
git commit -m "feat(db): add workout_logs and adaptation_suggestions tables"
```

---

### Task 2: Write adaptation logic (TDD)

**Files:**
- Create: `packages/ai/src/adaptation.ts`
- Create: `packages/ai/src/adaptation.test.ts`
- Modify: `packages/ai/src/index.ts`

- [ ] **Step 1: Write the failing tests first**

Create `packages/ai/src/adaptation.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import {
  deriveExpectedEffort,
  buildReplacementWorkout,
  checkAdaptationTrigger,
  type WorkoutLogInput,
} from "./adaptation"

// ─── deriveExpectedEffort ─────────────────────────────────────────────────────

describe("deriveExpectedEffort", () => {
  it("returns hard for tempo", () => {
    expect(deriveExpectedEffort("tempo")).toBe("hard")
  })
  it("returns hard for intervals", () => {
    expect(deriveExpectedEffort("intervals")).toBe("hard")
  })
  it("returns hard for mp", () => {
    expect(deriveExpectedEffort("mp")).toBe("hard")
  })
  it("returns hard for race", () => {
    expect(deriveExpectedEffort("race")).toBe("hard")
  })
  it("returns moderate for long", () => {
    expect(deriveExpectedEffort("long")).toBe("moderate")
  })
  it("returns moderate for medium-long", () => {
    expect(deriveExpectedEffort("medium-long")).toBe("moderate")
  })
  it("returns easy for easy", () => {
    expect(deriveExpectedEffort("easy")).toBe("easy")
  })
  it("returns easy for strength", () => {
    expect(deriveExpectedEffort("strength")).toBe("easy")
  })
  it("returns easy for rest", () => {
    expect(deriveExpectedEffort("rest")).toBe("easy")
  })
})

// ─── checkAdaptationTrigger ───────────────────────────────────────────────────

function makeLog(
  overrides: Partial<WorkoutLogInput> & Pick<WorkoutLogInput, "workoutDate">
): WorkoutLogInput {
  return {
    workoutType: "easy",
    expectedEffort: "easy",
    actualEffort: "good",
    completed: true,
    soreness: "none",
    ...overrides,
  }
}

describe("checkAdaptationTrigger", () => {
  it("does not trigger with 0 logs", () => {
    expect(checkAdaptationTrigger([]).triggered).toBe(false)
  })

  // Use a fixed referenceDate in all time-sensitive tests so they don't
  // break as real time passes. "2026-03-16" is the canonical reference date.
  const REF = "2026-03-16"

  it("does not trigger with 1 unexpectedly hard log", () => {
    const logs = [
      makeLog({ workoutDate: "2026-03-10", workoutType: "easy", expectedEffort: "easy", actualEffort: "hard" }),
    ]
    expect(checkAdaptationTrigger(logs, REF).triggered).toBe(false)
  })

  it("triggers with 2 unexpectedly hard logs within 7 days", () => {
    const logs = [
      makeLog({ workoutDate: "2026-03-10", workoutType: "easy", expectedEffort: "easy", actualEffort: "hard" }),
      makeLog({ workoutDate: "2026-03-13", workoutType: "easy", expectedEffort: "easy", actualEffort: "hard" }),
    ]
    const result = checkAdaptationTrigger(logs, REF)
    expect(result.triggered).toBe(true)
    expect(result.reason).toMatch(/2 unexpectedly hard/)
  })

  it("includes reason count in trigger message", () => {
    const logs = [
      makeLog({ workoutDate: "2026-03-10", workoutType: "easy", expectedEffort: "easy", actualEffort: "hard" }),
      makeLog({ workoutDate: "2026-03-11", workoutType: "easy", expectedEffort: "easy", actualEffort: "hard" }),
      makeLog({ workoutDate: "2026-03-12", workoutType: "easy", expectedEffort: "easy", actualEffort: "hard" }),
    ]
    const result = checkAdaptationTrigger(logs, REF)
    expect(result.triggered).toBe(true)
    expect(result.reason).toMatch(/3 unexpectedly hard/)
  })

  it("does not count expectedEffort=hard workouts toward unexpectedly-hard tally", () => {
    const logs = [
      makeLog({ workoutDate: "2026-03-10", workoutType: "tempo", expectedEffort: "hard", actualEffort: "hard" }),
      makeLog({ workoutDate: "2026-03-12", workoutType: "tempo", expectedEffort: "hard", actualEffort: "hard" }),
      makeLog({ workoutDate: "2026-03-14", workoutType: "tempo", expectedEffort: "hard", actualEffort: "hard" }),
    ]
    expect(checkAdaptationTrigger(logs, REF).triggered).toBe(false)
  })

  it("does not trigger when unexpectedly hard logs are older than 7 days", () => {
    // reference date in trigger is computed from today; these are >7 days old
    const logs = [
      makeLog({ workoutDate: "2026-01-01", workoutType: "easy", expectedEffort: "easy", actualEffort: "hard" }),
      makeLog({ workoutDate: "2026-01-02", workoutType: "easy", expectedEffort: "easy", actualEffort: "hard" }),
    ]
    // This test passes dates far in the past — trigger looks at calendar days from today
    // The function accepts an optional `referenceDate` for testability
    const referenceDate = "2026-03-16"
    expect(checkAdaptationTrigger(logs, referenceDate).triggered).toBe(false)
  })

  it("triggers on 2 significant soreness logs within 3 calendar days", () => {
    const logs = [
      makeLog({ workoutDate: "2026-03-10", soreness: "significant" }),
      makeLog({ workoutDate: "2026-03-12", soreness: "significant" }),
    ]
    const result = checkAdaptationTrigger(logs, REF)
    expect(result.triggered).toBe(true)
    expect(result.reason).toMatch(/significant soreness/)
  })

  it("does not trigger when significant soreness logs are more than 3 days apart", () => {
    const logs = [
      makeLog({ workoutDate: "2026-03-10", soreness: "significant" }),
      makeLog({ workoutDate: "2026-03-14", soreness: "significant" }),
    ]
    expect(checkAdaptationTrigger(logs, REF).triggered).toBe(false)
  })

  it("counts incomplete workouts (completed=false) toward unexpectedly-hard tally", () => {
    const logs = [
      makeLog({ workoutDate: "2026-03-10", expectedEffort: "easy", actualEffort: "hard", completed: false }),
      makeLog({ workoutDate: "2026-03-12", expectedEffort: "easy", actualEffort: "hard", completed: false }),
    ]
    expect(checkAdaptationTrigger(logs, REF).triggered).toBe(true)
  })

  it("prefers unexpectedly-hard trigger over soreness trigger when both present", () => {
    const logs = [
      makeLog({ workoutDate: "2026-03-10", expectedEffort: "easy", actualEffort: "hard", soreness: "significant" }),
      makeLog({ workoutDate: "2026-03-12", expectedEffort: "easy", actualEffort: "hard", soreness: "significant" }),
    ]
    const result = checkAdaptationTrigger(logs, REF)
    expect(result.reason).toMatch(/unexpectedly hard/)
  })
})

// ─── buildReplacementWorkout ──────────────────────────────────────────────────

describe("buildReplacementWorkout", () => {
  it("returns null for easy", () => {
    expect(buildReplacementWorkout({ date: "2026-03-20", type: "easy", description: "Easy run." })).toBeNull()
  })

  it("returns null for race", () => {
    expect(buildReplacementWorkout({ date: "2026-03-20", type: "race", description: "Race day." })).toBeNull()
  })

  it("returns null for rest", () => {
    expect(buildReplacementWorkout({ date: "2026-03-20", type: "rest", description: "Rest." })).toBeNull()
  })

  it("replaces tempo with easy run, preserves distance", () => {
    const result = buildReplacementWorkout({ date: "2026-03-20", type: "tempo", distanceKm: 10, description: "Tempo." })
    expect(result).not.toBeNull()
    expect(result!.type).toBe("easy")
    expect(result!.distanceKm).toBe(10)
    expect(result!.targetPace).toBeUndefined()
    expect(result!.targetHR).toBe("Zone 2 (130–145 bpm)")
    expect(result!.date).toBe("2026-03-20")
  })

  it("replaces intervals with easy run, preserves distance", () => {
    const result = buildReplacementWorkout({ date: "2026-03-20", type: "intervals", distanceKm: 8, description: "Intervals." })
    expect(result!.type).toBe("easy")
    expect(result!.distanceKm).toBe(8)
  })

  it("replaces mp with easy run, preserves distance", () => {
    const result = buildReplacementWorkout({ date: "2026-03-20", type: "mp", distanceKm: 16, description: "MP run." })
    expect(result!.type).toBe("easy")
    expect(result!.distanceKm).toBe(16)
  })

  it("replaces long with medium-long at ~70% distance", () => {
    const result = buildReplacementWorkout({ date: "2026-03-20", type: "long", distanceKm: 30, description: "Long run." })
    expect(result!.type).toBe("medium-long")
    expect(result!.distanceKm).toBe(21)  // 30 * 0.7 = 21.0
  })

  it("rounds long replacement distance to 1 decimal", () => {
    const result = buildReplacementWorkout({ date: "2026-03-20", type: "long", distanceKm: 25, description: "Long run." })
    expect(result!.distanceKm).toBe(17.5)
  })

  it("replaces medium-long with easy run, preserves distance", () => {
    const result = buildReplacementWorkout({ date: "2026-03-20", type: "medium-long", distanceKm: 18, description: "ML." })
    expect(result!.type).toBe("easy")
    expect(result!.distanceKm).toBe(18)
  })

  it("replaces strength with rest day", () => {
    const result = buildReplacementWorkout({ date: "2026-03-20", type: "strength", description: "Lift." })
    expect(result!.type).toBe("rest")
    expect(result!.distanceKm).toBeUndefined()
  })

  it("clears targetPace on replacement", () => {
    const result = buildReplacementWorkout({ date: "2026-03-20", type: "tempo", distanceKm: 10, description: "Tempo.", targetPace: "4:30/km" })
    expect(result!.targetPace).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to confirm they all fail**

```bash
cd packages/ai && pnpm vitest run src/adaptation.test.ts
```

Expected: all tests fail with "Cannot find module './adaptation'".

- [ ] **Step 3: Implement adaptation.ts**

Create `packages/ai/src/adaptation.ts`:

```typescript
import type { WorkoutDay, WorkoutType } from "./types"

export type ExpectedEffort = "hard" | "moderate" | "easy"
export type ActualEffort = "hard" | "good" | "easy"
export type Soreness = "none" | "mild" | "significant"

export interface WorkoutLogInput {
  workoutDate: string        // ISO "YYYY-MM-DD"
  workoutType: WorkoutType
  expectedEffort: ExpectedEffort
  actualEffort: ActualEffort
  completed: boolean
  soreness: Soreness
}

export interface AdaptationTriggerResult {
  triggered: boolean
  reason: string | null
}

/** Derives the expected difficulty of a workout from its type. */
export function deriveExpectedEffort(type: WorkoutType): ExpectedEffort {
  if (["tempo", "intervals", "mp", "race"].includes(type)) return "hard"
  if (["long", "medium-long"].includes(type)) return "moderate"
  return "easy"
}

/**
 * Checks whether recent workout logs indicate the athlete is overreaching.
 *
 * @param logs - All logs to consider (caller is responsible for pre-filtering to a
 *               reasonable window; this function re-filters to 7 calendar days
 *               from `referenceDate`).
 * @param referenceDate - ISO date to use as "today" (defaults to actual today).
 *                        Pass this in tests for deterministic results.
 */
export function checkAdaptationTrigger(
  logs: WorkoutLogInput[],
  referenceDate?: string,
): AdaptationTriggerResult {
  const today = referenceDate ?? new Date().toLocaleDateString("en-CA")
  const sevenDaysAgo = subtractDays(today, 7)

  const recentLogs = logs.filter((l) => l.workoutDate >= sevenDaysAgo)

  // Trigger 1: 2+ unexpectedly hard sessions in 7 days
  const unexpectedlyHard = recentLogs.filter(
    (l) =>
      l.actualEffort === "hard" &&
      l.expectedEffort !== "hard" &&
      l.workoutType !== "rest" &&
      l.workoutType !== "race",
  )
  if (unexpectedlyHard.length >= 2) {
    return {
      triggered: true,
      reason: `You've had ${unexpectedlyHard.length} unexpectedly hard sessions in the last 7 days.`,
    }
  }

  // Trigger 2: significant soreness on two logs within 3 calendar days
  const sorenessDates = recentLogs
    .filter((l) => l.soreness === "significant")
    .map((l) => l.workoutDate)
    .sort()

  for (let i = 0; i < sorenessDates.length - 1; i++) {
    const diff = dateDiffDays(sorenessDates[i]!, sorenessDates[i + 1]!)
    if (diff <= 3) {
      return {
        triggered: true,
        reason: "You've reported significant soreness before multiple sessions this week.",
      }
    }
  }

  return { triggered: false, reason: null }
}

/**
 * Builds a replacement WorkoutDay for the given original.
 * Returns null for types that should never be replaced (easy, race, rest).
 */
export function buildReplacementWorkout(original: WorkoutDay): WorkoutDay | null {
  const { date, type, distanceKm } = original

  if (type === "easy" || type === "race" || type === "rest") return null

  if (type === "tempo" || type === "intervals" || type === "mp") {
    return {
      date,
      type: "easy",
      distanceKm,
      description:
        "Easy recovery run. Keep effort very low — conversational pace throughout.",
      targetHR: "Zone 2 (130–145 bpm)",
    }
  }

  if (type === "long") {
    return {
      date,
      type: "medium-long",
      distanceKm: distanceKm != null
        ? Math.round(distanceKm * 0.7 * 10) / 10
        : undefined,
      description:
        "Medium-long easy run. Reduced from your scheduled long run to aid recovery.",
      targetHR: "Zone 2 (130–145 bpm)",
    }
  }

  if (type === "medium-long") {
    return {
      date,
      type: "easy",
      distanceKm,
      description:
        "Easy recovery run. Keep effort very low — conversational pace throughout.",
      targetHR: "Zone 2 (130–145 bpm)",
    }
  }

  if (type === "strength") {
    return {
      date,
      type: "rest",
      description: "Rest day. Optional: 10–15 minutes of light mobility or stretching.",
    }
  }

  return null
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function subtractDays(isoDate: string, n: number): string {
  const d = new Date(isoDate + "T00:00:00")
  d.setDate(d.getDate() - n)
  return d.toLocaleDateString("en-CA")
}

function dateDiffDays(earlier: string, later: string): number {
  const a = new Date(earlier + "T00:00:00")
  const b = new Date(later + "T00:00:00")
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}
```

- [ ] **Step 4: Run tests — confirm all pass**

```bash
cd packages/ai && pnpm vitest run src/adaptation.test.ts
```

Expected: all tests pass. If any fail, fix the implementation (not the tests).

- [ ] **Step 5: Export from packages/ai**

Add to `packages/ai/src/index.ts`:

```typescript
export * from "./adaptation"
```

- [ ] **Step 6: Typecheck**

```bash
cd /path/to/repo && pnpm typecheck
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/ai/src/adaptation.ts packages/ai/src/adaptation.test.ts packages/ai/src/index.ts
git commit -m "feat(ai): add adaptation logic with deriveExpectedEffort, checkAdaptationTrigger, buildReplacementWorkout"
```

---

## Chunk 2: API Endpoints

### Task 3: POST log endpoint

**Files:**
- Create: `apps/web/app/api/plans/[id]/workouts/[date]/log/route.ts`

This endpoint:
1. Authenticates the request
2. Validates the plan belongs to the user
3. Finds the matching `WorkoutDay` in `plans.days`
4. Derives `expectedEffort` from `workoutType`
5. Upserts a `workout_logs` row
6. Checks for an existing pending suggestion — if none, runs the adaptation check
7. Returns `{ log, suggestion }`

- [ ] **Step 1: Create the route file**

Create `apps/web/app/api/plans/[id]/workouts/[date]/log/route.ts`:

```typescript
import { type NextRequest } from "next/server"
import { eq, and, gte } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db, plans, workoutLogs, adaptationSuggestions } from "@workspace/db"
import {
  deriveExpectedEffort,
  checkAdaptationTrigger,
  buildReplacementWorkout,
  type ActualEffort,
  type Soreness,
  type WorkoutLogInput,
} from "@workspace/ai"
import type { WorkoutDay, WorkoutType } from "@workspace/ai"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const VALID_ACTUAL_EFFORTS: ActualEffort[] = ["hard", "good", "easy"]
const VALID_SORENESS: Soreness[] = ["none", "mild", "significant"]

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; date: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id, date } = await params

  if (!UUID_RE.test(id) || !ISO_DATE_RE.test(date)) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  let body: {
    workoutType?: WorkoutType
    actualEffort?: ActualEffort
    completed?: boolean
    soreness?: Soreness
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { workoutType, actualEffort, completed, soreness } = body

  if (
    !workoutType ||
    !actualEffort || !VALID_ACTUAL_EFFORTS.includes(actualEffort) ||
    completed === undefined ||
    !soreness || !VALID_SORENESS.includes(soreness)
  ) {
    return Response.json({ error: "Bad request" }, { status: 400 })
  }

  try {
    // Verify plan belongs to this user
    const [plan] = await db
      .select()
      .from(plans)
      .where(and(eq(plans.id, id), eq(plans.userId, session.user.id)))
      .limit(1)

    if (!plan) {
      return Response.json({ error: "Not found" }, { status: 404 })
    }

    // Verify the workout exists in the plan
    const planDays = plan.days as WorkoutDay[]
    const workout = planDays.find((d) => d.date === date && d.type === workoutType)
    if (!workout) {
      return Response.json({ error: "Not found" }, { status: 404 })
    }

    const expectedEffort = deriveExpectedEffort(workoutType)

    // Upsert log — most recent submission wins
    const [log] = await db
      .insert(workoutLogs)
      .values({
        userId: session.user.id,
        planId: id,
        workoutDate: date,
        workoutType,
        expectedEffort,
        actualEffort,
        completed,
        soreness,
      })
      .onConflictDoUpdate({
        target: [workoutLogs.planId, workoutLogs.workoutDate, workoutLogs.workoutType],
        set: { actualEffort, completed, soreness, expectedEffort, loggedAt: new Date() },
      })
      .returning()

    // Also update completed + effort on the plan's WorkoutDay so the dashboard
    // can display the logged effort on the completed card immediately.
    const updatedDays = planDays.map((d) =>
      d.date === date && d.type === workoutType ? { ...d, completed, effort: actualEffort } : d,
    )
    await db
      .update(plans)
      .set({ days: updatedDays })
      .where(eq(plans.id, id))

    // Run adaptation check if no pending suggestion exists
    const suggestion = await runAdaptationCheck(id, session.user.id, updatedDays)

    return Response.json({ log, suggestion })
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}

async function runAdaptationCheck(
  planId: string,
  userId: string,
  planDays: WorkoutDay[],
) {
  // Skip if a pending suggestion already exists
  const [existing] = await db
    .select({ id: adaptationSuggestions.id })
    .from(adaptationSuggestions)
    .where(
      and(
        eq(adaptationSuggestions.planId, planId),
        eq(adaptationSuggestions.status, "pending"),
      ),
    )
    .limit(1)

  if (existing) return null

  // Fetch logs from the last 8 days (one extra for timezone buffer)
  const eightDaysAgo = subtractDays(new Date().toLocaleDateString("en-CA"), 8)
  const recentLogs = await db
    .select()
    .from(workoutLogs)
    .where(
      and(
        eq(workoutLogs.planId, planId),
        gte(workoutLogs.workoutDate, eightDaysAgo),
      ),
    )

  const logInputs: WorkoutLogInput[] = recentLogs.map((l) => ({
    workoutDate: l.workoutDate,
    workoutType: l.workoutType as WorkoutDay["type"],
    expectedEffort: l.expectedEffort as "hard" | "moderate" | "easy",
    actualEffort: l.actualEffort as "hard" | "good" | "easy",
    completed: l.completed,
    soreness: l.soreness as "none" | "mild" | "significant",
  }))

  const { triggered, reason } = checkAdaptationTrigger(logInputs)
  if (!triggered || !reason) return null

  // Find next upcoming replaceable workout
  const today = new Date().toLocaleDateString("en-CA")
  const unreplaceableTypes = new Set(["easy", "race", "rest"])
  const nextTarget = planDays
    .filter(
      (d) =>
        d.date >= today &&
        !d.completed &&
        !unreplaceableTypes.has(d.type),
    )
    .sort((a, b) => a.date.localeCompare(b.date))[0]

  if (!nextTarget) return null

  const proposed = buildReplacementWorkout(nextTarget)
  if (!proposed) return null

  const [suggestion] = await db
    .insert(adaptationSuggestions)
    .values({
      userId,
      planId,
      reason,
      targetDate: nextTarget.date,
      originalWorkout: nextTarget,
      proposedWorkout: proposed,
    })
    .returning()

  return suggestion ?? null
}

function subtractDays(isoDate: string, n: number): string {
  const d = new Date(isoDate + "T00:00:00")
  d.setDate(d.getDate() - n)
  return d.toLocaleDateString("en-CA")
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors. Common issue: `onConflictDoUpdate` syntax — Drizzle uses `target` as an array of column references (not strings).

- [ ] **Step 3: Manual smoke test**

Start the dev server (`pnpm dev`), sign in, and run in the browser console or with curl:

```bash
curl -X POST http://localhost:3000/api/plans/<your-plan-id>/workouts/2026-03-16/log \
  -H "Content-Type: application/json" \
  -H "Cookie: <your session cookie>" \
  -d '{"workoutType":"easy","actualEffort":"hard","completed":true,"soreness":"none"}'
```

Expected: `200 { log: {...}, suggestion: null }`. Confirm a row appears in the `workout_logs` table in Neon.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/plans/
git commit -m "feat(api): add POST workout log endpoint with adaptation check"
```

---

### Task 4: PATCH accept and dismiss endpoints

**Files:**
- Create: `apps/web/app/api/plans/[id]/suggestions/[suggestionId]/accept/route.ts`
- Create: `apps/web/app/api/plans/[id]/suggestions/[suggestionId]/dismiss/route.ts`

- [ ] **Step 1: Create accept route**

Create `apps/web/app/api/plans/[id]/suggestions/[suggestionId]/accept/route.ts`:

```typescript
import { type NextRequest } from "next/server"
import { eq, and } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db, plans, adaptationSuggestions } from "@workspace/db"
import type { WorkoutDay } from "@workspace/ai"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; suggestionId: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id, suggestionId } = await params

  if (!UUID_RE.test(id) || !UUID_RE.test(suggestionId)) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  try {
    const [suggestion] = await db
      .select()
      .from(adaptationSuggestions)
      .where(eq(adaptationSuggestions.id, suggestionId))
      .limit(1)

    if (!suggestion) {
      return Response.json({ error: "Not found" }, { status: 404 })
    }

    if (suggestion.userId !== session.user.id || suggestion.planId !== id) {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }

    // Idempotent — already resolved
    if (suggestion.status !== "pending") {
      const [plan] = await db.select().from(plans).where(eq(plans.id, id)).limit(1)
      return Response.json({ plan })
    }

    // Mutate the plan's days: replace targetDate+originalType with proposedWorkout
    const [plan] = await db
      .select()
      .from(plans)
      .where(and(eq(plans.id, id), eq(plans.userId, session.user.id)))
      .limit(1)

    if (!plan) {
      return Response.json({ error: "Not found" }, { status: 404 })
    }

    const original = suggestion.originalWorkout as WorkoutDay
    const proposed = suggestion.proposedWorkout as WorkoutDay
    const updatedDays = (plan.days as WorkoutDay[]).map((d) =>
      d.date === suggestion.targetDate && d.type === original.type ? proposed : d,
    )

    await Promise.all([
      db.update(plans).set({ days: updatedDays }).where(eq(plans.id, id)),
      db
        .update(adaptationSuggestions)
        .set({ status: "accepted", resolvedAt: new Date() })
        .where(eq(adaptationSuggestions.id, suggestionId)),
    ])

    const [updated] = await db.select().from(plans).where(eq(plans.id, id)).limit(1)
    return Response.json({ plan: updated })
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create dismiss route**

Create `apps/web/app/api/plans/[id]/suggestions/[suggestionId]/dismiss/route.ts`:

```typescript
import { type NextRequest } from "next/server"
import { eq } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db, adaptationSuggestions } from "@workspace/db"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; suggestionId: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id, suggestionId } = await params

  if (!UUID_RE.test(id) || !UUID_RE.test(suggestionId)) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  try {
    const [suggestion] = await db
      .select()
      .from(adaptationSuggestions)
      .where(eq(adaptationSuggestions.id, suggestionId))
      .limit(1)

    if (!suggestion) {
      return Response.json({ error: "Not found" }, { status: 404 })
    }

    // Verify suggestion belongs to this user AND this plan
    if (suggestion.userId !== session.user.id || suggestion.planId !== id) {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }

    // Idempotent
    if (suggestion.status !== "pending") {
      return Response.json({ ok: true })
    }

    await db
      .update(adaptationSuggestions)
      .set({ status: "dismissed", resolvedAt: new Date() })
      .where(eq(adaptationSuggestions.id, suggestionId))

    return Response.json({ ok: true })
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/plans/
git commit -m "feat(api): add suggestion accept and dismiss endpoints"
```

---

## Chunk 3: UI

### Task 5: WorkoutFeedbackSheet component

**Files:**
- Create: `apps/web/app/(app)/dashboard/workout-feedback-sheet.tsx`

This is a bottom sheet (shadcn `Sheet` component) with two questions. It is triggered from the dashboard when the user taps "Mark Complete". It calls the log endpoint on submit, or calls `onDismiss` (which marks the workout complete without logging).

- [ ] **Step 1: Create the component**

Create `apps/web/app/(app)/dashboard/workout-feedback-sheet.tsx`:

```tsx
"use client"

import { useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Button } from "@workspace/ui/components/button"
import type { WorkoutDay } from "@workspace/ai"

type ActualEffort = "hard" | "good" | "easy"
type Soreness = "none" | "mild" | "significant"

interface WorkoutFeedbackSheetProps {
  open: boolean
  entry: WorkoutDay | null
  planId: string
  onLogged: (suggestion: AdaptationSuggestion | null) => void
  onDismiss: () => void
}

export interface AdaptationSuggestion {
  id: string
  planId: string
  status: "pending" | "accepted" | "dismissed"
  reason: string
  targetDate: string
  originalWorkout: WorkoutDay
  proposedWorkout: WorkoutDay
  createdAt: string
  resolvedAt: string | null
}

const EFFORT_OPTIONS: { value: ActualEffort; emoji: string; label: string }[] = [
  { value: "hard", emoji: "😓", label: "Hard" },
  { value: "good", emoji: "😊", label: "Good" },
  { value: "easy", emoji: "⚡", label: "Easy" },
]

const SORENESS_OPTIONS: { value: Soreness; emoji: string; label: string }[] = [
  { value: "none", emoji: "🟢", label: "Fresh" },
  { value: "mild", emoji: "🟡", label: "Mild soreness" },
  { value: "significant", emoji: "🔴", label: "Pretty beat up" },
]

export function WorkoutFeedbackSheet({
  open,
  entry,
  planId,
  onLogged,
  onDismiss,
}: WorkoutFeedbackSheetProps) {
  const [effort, setEffort] = useState<ActualEffort | null>(null)
  const [soreness, setSoreness] = useState<Soreness | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(false)

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      setEffort(null)
      setSoreness(null)
      setSubmitError(false)
      onDismiss()
    }
  }

  async function handleSubmit() {
    if (!entry || !effort || !soreness) return
    setSubmitting(true)
    setSubmitError(false)
    try {
      const res = await fetch(
        `/api/plans/${planId}/workouts/${entry.date}/log`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workoutType: entry.type,
            actualEffort: effort,
            completed: true,
            soreness,
          }),
        },
      )
      if (res.ok) {
        const data = (await res.json()) as { suggestion: AdaptationSuggestion | null }
        setEffort(null)
        setSoreness(null)
        onLogged(data.suggestion)
      } else {
        setSubmitError(true)
      }
    } catch {
      setSubmitError(true)
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = effort !== null && soreness !== null && !submitting

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-left">How did it go?</SheetTitle>
        </SheetHeader>

        <div className="space-y-6">
          {/* Effort */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">How did it feel?</p>
            <div className="grid grid-cols-3 gap-2">
              {EFFORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setEffort(opt.value)}
                  className={[
                    "flex flex-col items-center gap-1 rounded-xl border px-2 py-3 transition-colors cursor-pointer",
                    effort === opt.value
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:bg-muted/50",
                  ].join(" ")}
                >
                  <span className="text-2xl leading-none" aria-hidden="true">{opt.emoji}</span>
                  <span className="text-xs font-semibold">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Soreness */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">How are your legs going into today?</p>
            <div className="grid grid-cols-3 gap-2">
              {SORENESS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSoreness(opt.value)}
                  className={[
                    "flex flex-col items-center gap-1 rounded-xl border px-2 py-3 transition-colors cursor-pointer",
                    soreness === opt.value
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:bg-muted/50",
                  ].join(" ")}
                >
                  <span className="text-2xl leading-none" aria-hidden="true">{opt.emoji}</span>
                  <span className="text-[11px] font-semibold text-center leading-tight">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {submitError && (
            <p className="text-xs text-destructive text-center">
              Something went wrong. Please try again.
            </p>
          )}

          <Button
            className="w-full"
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
          >
            {submitting ? "Saving…" : "Save"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 2: Check that `Sheet` is available in packages/ui**

```bash
ls packages/ui/src/components/sheet.tsx
```

If it doesn't exist, add it with shadcn:

```bash
cd packages/ui && pnpm dlx shadcn@latest add sheet
```

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(app\)/dashboard/workout-feedback-sheet.tsx
git commit -m "feat(ui): add WorkoutFeedbackSheet component"
```

---

### Task 6: AdaptationSuggestionCard component

**Files:**
- Create: `apps/web/app/(app)/dashboard/adaptation-suggestion-card.tsx`

- [ ] **Step 1: Create the component**

Create `apps/web/app/(app)/dashboard/adaptation-suggestion-card.tsx`:

```tsx
"use client"

import { useState } from "react"
import { Zap } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import type { WorkoutDay } from "@workspace/ai"
import { WORKOUT_NAMES } from "@/app/plan/workout-utils"
import type { AdaptationSuggestion } from "./workout-feedback-sheet"

interface AdaptationSuggestionCardProps {
  suggestion: AdaptationSuggestion
  planId: string
  onAccepted: (updatedDays: WorkoutDay[]) => void
  onDismissed: () => void
}

export function AdaptationSuggestionCard({
  suggestion,
  planId,
  onAccepted,
  onDismissed,
}: AdaptationSuggestionCardProps) {
  const [loading, setLoading] = useState<"accept" | "dismiss" | null>(null)

  const original = suggestion.originalWorkout
  const proposed = suggestion.proposedWorkout

  async function handleAccept() {
    setLoading("accept")
    try {
      const res = await fetch(
        `/api/plans/${planId}/suggestions/${suggestion.id}/accept`,
        { method: "PATCH" },
      )
      if (res.ok) {
        const data = (await res.json()) as { plan: { days: WorkoutDay[] } }
        onAccepted(data.plan.days)
      }
    } finally {
      setLoading(null)
    }
  }

  async function handleDismiss() {
    setLoading("dismiss")
    try {
      const res = await fetch(
        `/api/plans/${planId}/suggestions/${suggestion.id}/dismiss`,
        { method: "PATCH" },
      )
      if (res.ok) onDismissed()
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 border-l-[3px] border-l-amber-500 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <Zap className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
            Training adjustment suggested
          </p>
          <p className="text-xs text-amber-600/80 dark:text-amber-500/80">{suggestion.reason}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{WORKOUT_NAMES[original.type]}</span>
        <span aria-hidden="true">→</span>
        <span className="font-medium text-foreground">{WORKOUT_NAMES[proposed.type]}</span>
        {proposed.distanceKm != null && (
          <span className="text-xs text-muted-foreground">({proposed.distanceKm} km)</span>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1"
          disabled={loading !== null}
          onClick={() => void handleAccept()}
        >
          {loading === "accept" ? "Updating…" : "Accept"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          disabled={loading !== null}
          onClick={() => void handleDismiss()}
        >
          Keep original
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(app\)/dashboard/adaptation-suggestion-card.tsx
git commit -m "feat(ui): add AdaptationSuggestionCard component"
```

---

### Task 7: Update TodayWorkoutCard — remove inline effort picker

The inline effort picker in `TodayWorkoutCard` is replaced by the feedback sheet. Remove it and the `onLogEffort` prop.

**Files:**
- Modify: `apps/web/app/(app)/dashboard/today-workout-card.tsx`

- [ ] **Step 1: Remove the effort picker UI and prop**

In `today-workout-card.tsx`, make these changes:

1. Remove the `onLogEffort` field from `TodayWorkoutCardProps`
2. Remove the `hasEffort`, `showEffortPicker`, and `EFFORT_OPTIONS` const (the effort label display can stay if you want, but the picker buttons must go)
3. Remove the `showEffortPicker` JSX block entirely

The completed state can still show `entry.effort` as a label (so previously logged effort is visible), but the picker buttons are gone.

After edits, the `TodayWorkoutCardProps` interface should look like:

```typescript
interface TodayWorkoutCardProps {
  entry: WorkoutDay
  units: "km" | "miles"
  onComplete: () => void
  variant?: "today" | "preview"
}
```

And the `isComplete` branch should look like this (effort display preserved, picker removed):

```tsx
if (isComplete) {
  return (
    <div className="rounded-xl border border-green-500/30 bg-green-500/5 border-l-[3px] border-l-green-500 p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 shrink-0">
          <Check className="h-3 w-3 text-white" />
        </span>
        <div>
          <p className="text-sm font-semibold text-green-700 dark:text-green-400">
            {WORKOUT_NAMES[entry.type]}
            {entry.distanceKm != null && (
              <span className="font-normal text-green-600/70 dark:text-green-500/70 ml-1.5">
                · {formatDistance(entry.distanceKm, units)} {unit}
              </span>
            )}
          </p>
          {entry.effort && (
            <p className="text-xs text-green-600/60 dark:text-green-500/60 mt-0.5">
              {entry.effort === "hard" ? "😓 Hard" : entry.effort === "good" ? "😊 Good" : "⚡ Easy"}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: errors about `onLogEffort` being passed from the dashboard page — these will be fixed in the next task.

- [ ] **Step 3: Commit will happen after dashboard wiring (Task 8)**

---

### Task 8: Wire feedback sheet and suggestion card into dashboard

**Files:**
- Modify: `apps/web/app/(app)/dashboard/page.tsx`

This is the final wiring step. The dashboard needs to:
1. Track which workout the feedback sheet is open for
2. Track the current pending suggestion (if any)
3. Open the feedback sheet when "Mark Complete" is tapped (instead of immediately PATCHing)
4. On sheet dismiss: call the existing PATCH endpoint to mark complete (no log)
5. On sheet submit: update plan days + store suggestion if one was generated
6. Render `AdaptationSuggestionCard` above today's workouts when a pending suggestion exists

- [ ] **Step 1: Update dashboard page**

In `apps/web/app/(app)/dashboard/page.tsx`, make the following changes:

**Add imports:**

```typescript
import { WorkoutFeedbackSheet, type AdaptationSuggestion } from "./workout-feedback-sheet"
import { AdaptationSuggestionCard } from "./adaptation-suggestion-card"
```

**Add state inside `DashboardPage`** — place these with the other `useState` calls at the top of the component, **before** the early-return guards (`if (plan === null)`, etc.):

```typescript
const [feedbackEntry, setFeedbackEntry] = useState<WorkoutDay | null>(null)
const [suggestion, setSuggestion] = useState<AdaptationSuggestion | null>(null)
```

**Important placement note:** `handleFeedbackDismiss`, `handleFeedbackLogged`, `handleSuggestionAccepted`, and `handleSuggestionDismissed` all reference `resolvedPlan`, which is defined on the line `const resolvedPlan = plan as Plan` (currently line 123). Place all new handlers **after** that line — consistent with where `handleComplete` and `handleLogEffort` already live.

**Replace `handleComplete`** (currently PATCHes immediately) with one that opens the feedback sheet:

```typescript
function handleComplete(entry: WorkoutDay) {
  setFeedbackEntry(entry)
}
```

**Add `handleFeedbackDismiss`** — user dismisses the sheet; mark complete without logging:

```typescript
function handleFeedbackDismiss() {
  if (!feedbackEntry) return
  const entry = feedbackEntry
  setFeedbackEntry(null)
  // Optimistic update
  const prevDays = resolvedPlan.days
  const updated = resolvedPlan.days.map((d: WorkoutDay) =>
    d.date === entry.date && d.type === entry.type ? { ...d, completed: true } : d
  )
  setPlan((p) => (p === null || typeof p === "string" ? p : { ...p, days: updated } as Plan))
  fetch(`/api/plans/${resolvedPlan.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date: entry.date, type: entry.type, completed: true }),
  }).catch(() => {
    setPlan((p) => (p === null || typeof p === "string" ? p : { ...p, days: prevDays } as Plan))
  })
}
```

**Add `handleFeedbackLogged`** — user submits the feedback sheet:

```typescript
function handleFeedbackLogged(newSuggestion: AdaptationSuggestion | null) {
  if (!feedbackEntry) return
  const entry = feedbackEntry
  setFeedbackEntry(null)
  // Update completed in local plan state
  const updated = resolvedPlan.days.map((d: WorkoutDay) =>
    d.date === entry.date && d.type === entry.type ? { ...d, completed: true } : d
  )
  setPlan((p) => (p === null || typeof p === "string" ? p : { ...p, days: updated } as Plan))
  if (newSuggestion) setSuggestion(newSuggestion)
}
```

**Remove `handleLogEffort`** entirely (no longer needed — effort is captured in the feedback sheet).

**Add suggestion handlers:**

```typescript
function handleSuggestionAccepted(updatedDays: WorkoutDay[]) {
  setPlan((p) => (p === null || typeof p === "string" ? p : { ...p, days: updatedDays } as Plan))
  setSuggestion(null)
}

function handleSuggestionDismissed() {
  setSuggestion(null)
}
```

**In the JSX**, remove `onLogEffort` from all `TodayWorkoutCard` usages, and add the suggestion card + feedback sheet:

Inside the `<>` fragment (today's + tomorrow's workouts), add the suggestion card before today's section:

```tsx
{/* Adaptation suggestion */}
{suggestion && (
  <AdaptationSuggestionCard
    suggestion={suggestion}
    planId={resolvedPlan.id}
    onAccepted={handleSuggestionAccepted}
    onDismissed={handleSuggestionDismissed}
  />
)}
```

At the bottom of the returned JSX (outside `<main>`'s inner div, inside `<main>`), add the sheet:

```tsx
<WorkoutFeedbackSheet
  open={feedbackEntry !== null}
  entry={feedbackEntry}
  planId={resolvedPlan.id}
  onLogged={handleFeedbackLogged}
  onDismiss={handleFeedbackDismiss}
/>
```

Remove all `onLogEffort` props from `TodayWorkoutCard` usages.

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Manual end-to-end test**

1. Open the dashboard with an active plan that has today's workout
2. Tap "Mark Complete" — the feedback sheet should slide up
3. Select an effort and soreness level, tap Save — sheet closes, card shows a green checkmark
4. Log 2 more workouts as unexpectedly hard (effort: hard, workoutType: easy or similar) within the last 7 days — this requires either test data or actually logging over a couple of days
5. After the second qualifying log, the suggestion card should appear above today's workout
6. Tap Accept — plan updates, card disappears
7. Repeat but tap "Keep original" — card disappears, plan unchanged

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(app\)/dashboard/
git commit -m "feat(dashboard): wire feedback sheet and adaptation suggestion card"
```

---

## Final Verification

- [ ] **Run full lint + typecheck**

```bash
pnpm lint && pnpm typecheck
```

Expected: no errors or warnings.

- [ ] **Run all tests**

```bash
pnpm test
```

Expected: all existing tests pass, plus the new adaptation tests.
