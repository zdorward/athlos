# Plan Generation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stream a personalized daily training plan from Claude, display it in a responsive calendar (desktop) / feed (mobile) view, with no auth or database required.

**Architecture:** A new `packages/ai` workspace package holds the provider interface, Claude implementation, and prompt builder. A Next.js API route (`/api/generate-plan`) streams NDJSON back to the client. The `/plan` page accumulates days into state as they arrive and renders them responsively.

**Tech Stack:** Anthropic SDK (`@anthropic-ai/sdk`), Next.js 16 Route Handlers, React `useRef`/`useState`, Tailwind CSS v4, pnpm workspaces

---

## Chunk 1: AI package + API route

### Task 1: Scaffold `packages/ai/`

**Files:**
- Create: `packages/ai/package.json`
- Create: `packages/ai/tsconfig.json`

- [ ] **Step 1: Create `packages/ai/package.json`**

```json
{
  "name": "@workspace/ai",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.39.0"
  },
  "devDependencies": {
    "@workspace/typescript-config": "workspace:*",
    "typescript": "^5.9.3"
  }
}
```

- [ ] **Step 2: Create `packages/ai/tsconfig.json`**

```json
{
  "extends": "@workspace/typescript-config/base.json",
  "compilerOptions": {
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Install the Anthropic SDK**

```bash
pnpm install
```

Expected: `@anthropic-ai/sdk` appears in `node_modules`. No errors.

- [ ] **Step 4: Add `@workspace/ai` to `apps/web/package.json` dependencies**

Open `apps/web/package.json`. In the `"dependencies"` object, add:

```json
"@workspace/ai": "workspace:*"
```

- [ ] **Step 5: Create `.env.local` at the repo root**

```
ANTHROPIC_API_KEY=your_key_here
```

This file is already gitignored by default in Next.js projects. Verify it is listed in `.gitignore` (add `*.local` if not present).

- [ ] **Step 6: Run install to link the new package**

```bash
pnpm install
```

Expected: `@workspace/ai` symlinked in `apps/web/node_modules/@workspace/ai`.

- [ ] **Step 7: Commit**

```bash
git add packages/ai/package.json packages/ai/tsconfig.json apps/web/package.json
git commit -m "feat: scaffold @workspace/ai package"
```

---

### Task 2: Types and provider interface

**Files:**
- Create: `packages/ai/src/types.ts`
- Create: `packages/ai/src/provider.ts`

- [ ] **Step 1: Create `packages/ai/src/types.ts`**

```typescript
export type WorkoutType =
  | "easy"
  | "long"
  | "tempo"
  | "intervals"
  | "rest"
  | "race"
  | "strength"

export interface WorkoutDay {
  date: string         // ISO "2026-06-16"
  type: WorkoutType
  distanceKm?: number  // always km; omitted for rest days only
  description: string
}

export interface TrainingPlanMeta {
  _meta: true
  totalWeeks: number
  totalKm: number     // always km
  peakWeekKm: number  // always km
}

export interface TrainingPlan {
  totalWeeks: number
  totalKm: number
  peakWeekKm: number
  days: WorkoutDay[]
}

export interface PlanGenerationInput {
  goal: "race" | "aerobic_base"
  race?: {
    name: string
    date: string  // ISO string (Date objects serialized via JSON.stringify)
    distance: "5k" | "10k" | "half" | "full" | "ultra"
    city: string
  }
  goalTime?: { hours: number; minutes: number }
  selectedDays: string[]   // ["mon", "wed", "fri", "sun"]
  longRunDay: string       // "sun"
  units: "km" | "miles"
  strengthTraining: boolean
  strengthDays?: string[]
}
```

- [ ] **Step 2: Create `packages/ai/src/provider.ts`**

```typescript
import type { PlanGenerationInput } from "./types.js"

export interface AIProvider {
  streamPlan(input: PlanGenerationInput): AsyncIterable<string>
  // yields complete, trimmed, non-empty NDJSON lines one at a time
}
```

- [ ] **Step 3: Verify typecheck passes**

```bash
pnpm typecheck
```

Expected: `Tasks: 2 successful, 2 total` (or more if other packages are checked). No errors.

- [ ] **Step 4: Commit**

```bash
git add packages/ai/src/types.ts packages/ai/src/provider.ts
git commit -m "feat: add AI package types and provider interface"
```

---

### Task 3: Prompt builder

**Files:**
- Create: `packages/ai/src/prompt.ts`

- [ ] **Step 1: Create `packages/ai/src/prompt.ts`**

```typescript
import type { PlanGenerationInput } from "./types.js"

const SYSTEM_PROMPT = `You are an expert running coach who creates personalized training plans. You generate plans for athletes ranging from complete beginners to competitive runners targeting specific time goals.

Output format: NDJSON — one JSON object per line, no markdown, no explanation, no code fences.

First line must be plan metadata:
{"_meta":true,"totalWeeks":<n>,"totalKm":<total>,"peakWeekKm":<peak>}

Then one line per calendar day from the first Monday on or after today through race day (or 16 weeks for aerobic base plans):
{"date":"YYYY-MM-DD","type":"<type>","distanceKm":<n>,"description":"<one sentence>"}

For rest days, omit distanceKm:
{"date":"YYYY-MM-DD","type":"rest","description":"Full rest day."}

For race day, emit distanceKm equal to the actual race distance:
{"date":"YYYY-MM-DD","type":"race","distanceKm":<race_distance_km>,"description":"Race day — <race name>. Trust your training."}

Valid types: easy, long, tempo, intervals, rest, race, strength

Rules:
- Only schedule runs on the athlete's available running days. All other days must be type "rest".
- The long run must always fall on the athlete's specified long run day.
- If strength training is requested, schedule it on the specified strength days using type "strength" (no distanceKm).
- If a strength day overlaps with a running day, prioritize the run and move strength to the nearest available non-running day.
- Follow the 10% weekly mileage increase rule. Include a recovery week (30% mileage reduction) every 4th week.
- For race plans: include a 2-week taper for 5K/10K, 3-week taper for half/full/ultra. The final day of the plan is race day.
- For aerobic base plans: 16 weeks total, no taper.
- Always output distances in kilometres regardless of the athlete's display preference.
- Descriptions must be specific (e.g. "2km warm-up, 6×1km at 5K pace with 90sec jog recovery, 2km cool-down") not vague (e.g. "do intervals").
- Output valid JSON only. No trailing commas, no comments, no extra whitespace.
- Do not emit any line that is not valid JSON.`

const DAY_NAMES: Record<string, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday",
  fri: "Friday", sat: "Saturday", sun: "Sunday",
}

const DISTANCE_KM_MAP: Record<string, number> = {
  "5k": 5, "10k": 10, half: 21.1, full: 42.2, ultra: 80,
}

export function buildPrompt(input: PlanGenerationInput): { system: string; user: string } {
  const lines: string[] = []

  if (input.goal === "race" && input.race) {
    const { name, date, distance, city } = input.race
    const raceKm = DISTANCE_KM_MAP[distance] ?? 42.2
    lines.push(`Goal: Race — ${name} in ${city} on ${date} (${raceKm}km / ${distance})`)
    if (input.goalTime) {
      const { hours, minutes } = input.goalTime
      lines.push(`Time goal: ${hours}h${minutes.toString().padStart(2, "0")}m (finish in under this time)`)
    } else {
      lines.push("Time goal: finish (no specific time target)")
    }
  } else {
    lines.push("Goal: Build aerobic base (no race — 16-week plan)")
  }

  const runDayNames = input.selectedDays.map(d => DAY_NAMES[d] ?? d).join(", ")
  lines.push(`Available running days: ${runDayNames}`)
  lines.push(`Long run day: ${DAY_NAMES[input.longRunDay] ?? input.longRunDay}`)

  if (input.strengthTraining && input.strengthDays?.length) {
    const strengthDayNames = input.strengthDays.map(d => DAY_NAMES[d] ?? d).join(", ")
    lines.push(`Strength training days: ${strengthDayNames}`)
  } else {
    lines.push("Strength training: none")
  }

  lines.push(`Today's date: ${new Date().toISOString().split("T")[0]}`)
  lines.push("Output distances in kilometres.")

  return { system: SYSTEM_PROMPT, user: lines.join("\n") }
}
```

- [ ] **Step 2: Verify typecheck passes**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/ai/src/prompt.ts
git commit -m "feat: add prompt builder for plan generation"
```

---

### Task 4: Claude provider + package index

**Files:**
- Create: `packages/ai/src/providers/claude.ts`
- Create: `packages/ai/src/index.ts`

- [ ] **Step 1: Create `packages/ai/src/providers/claude.ts`**

```typescript
import Anthropic from "@anthropic-ai/sdk"
import type { AIProvider } from "../provider.js"
import type { PlanGenerationInput } from "../types.js"
import { buildPrompt } from "../prompt.js"

export class ClaudeProvider implements AIProvider {
  private client = new Anthropic() // reads ANTHROPIC_API_KEY from process.env automatically

  async *streamPlan(input: PlanGenerationInput): AsyncIterable<string> {
    const { system, user } = buildPrompt(input)

    const stream = await this.client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      system,
      messages: [{ role: "user", content: user }],
    })

    let buffer = ""
    for await (const chunk of stream) {
      if (
        chunk.type === "content_block_delta" &&
        chunk.delta.type === "text_delta"
      ) {
        buffer += chunk.delta.text
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          if (line.trim()) yield line.trim()
        }
      }
    }
    if (buffer.trim()) yield buffer.trim()
  }
}
```

- [ ] **Step 2: Create `packages/ai/src/index.ts`**

```typescript
import { ClaudeProvider } from "./providers/claude.js"
import type { AIProvider } from "./provider.js"

export { type AIProvider } from "./provider.js"
export { type WorkoutDay, type WorkoutType, type TrainingPlan, type TrainingPlanMeta, type PlanGenerationInput } from "./types.js"

export function getProvider(): AIProvider {
  return new ClaudeProvider()
  // To swap providers: return new OpenAIProvider() — nothing else in the codebase changes
}
```

- [ ] **Step 3: Verify typecheck passes**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/ai/src/providers/claude.ts packages/ai/src/index.ts
git commit -m "feat: add ClaudeProvider and package entry point"
```

---

### Task 5: Streaming API route

**Files:**
- Create: `apps/web/app/api/generate-plan/route.ts`

- [ ] **Step 1: Create `apps/web/app/api/generate-plan/route.ts`**

```typescript
import { type NextRequest } from "next/server"
import { getProvider, type PlanGenerationInput } from "@workspace/ai"

export async function POST(req: NextRequest) {
  let input: PlanGenerationInput
  try {
    input = (await req.json()) as PlanGenerationInput
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  if (!input.goal || !input.selectedDays?.length || !input.longRunDay || !input.units) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const provider = getProvider()
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const line of provider.streamPlan(input)) {
          controller.enqueue(encoder.encode(line + "\n"))
        }
        controller.close()
      } catch (err) {
        controller.error(err)
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  })
}
```

- [ ] **Step 2: Verify typecheck passes**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Manual smoke test (requires valid ANTHROPIC_API_KEY in `.env.local`)**

Start the dev server:

```bash
pnpm dev
```

In a second terminal, send a test request:

```bash
curl -X POST http://localhost:3000/api/generate-plan \
  -H "Content-Type: application/json" \
  -d '{"goal":"aerobic_base","selectedDays":["mon","wed","fri","sun"],"longRunDay":"sun","units":"km","strengthTraining":false}' \
  --no-buffer
```

Expected: a stream of NDJSON lines beginning with `{"_meta":true,...}` followed by one `WorkoutDay` per line.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/generate-plan/route.ts
git commit -m "feat: add streaming plan generation API route"
```

---

## Chunk 2: Plan page UI

### Task 6: Workout helpers (shared across all plan views)

**Files:**
- Create: `apps/web/app/plan/workout-utils.ts`

This file centralizes color coding, display names, and distance conversion so all three view components stay DRY.

- [ ] **Step 1: Create `apps/web/app/plan/workout-utils.ts`**

```typescript
import type { WorkoutType, WorkoutDay } from "@workspace/ai"

export const WORKOUT_NAMES: Record<WorkoutType, string> = {
  easy: "Easy Run",
  long: "Long Run",
  tempo: "Tempo Run",
  intervals: "Intervals",
  strength: "Strength",
  rest: "Rest Day",
  race: "Race Day",
}

// Tailwind class for text color. For types that need oklch values not in the
// design system, use getWorkoutStyle() below for the inline style instead.
export const WORKOUT_TEXT_CLASS: Record<WorkoutType, string> = {
  easy: "text-muted-foreground",
  long: "text-primary",
  tempo: "",
  intervals: "",
  strength: "",
  rest: "text-subtle-foreground",
  race: "text-primary",
}

// Inline color style for types that can't be expressed as Tailwind classes.
export function getWorkoutColor(type: WorkoutType): string {
  const map: Partial<Record<WorkoutType, string>> = {
    tempo: "oklch(0.78 0.15 80)",
    intervals: "oklch(0.75 0.18 30)",
    strength: "oklch(0.65 0.15 300)",
  }
  return map[type] ?? ""
}

export function formatDistance(km: number, units: "km" | "miles"): string {
  if (units === "miles") {
    return (km * 0.621371).toFixed(1)
  }
  return km % 1 === 0 ? km.toString() : km.toFixed(1)
}

export function distanceUnit(units: "km" | "miles"): string {
  return units === "miles" ? "mi" : "km"
}

export function groupDaysByWeek(days: WorkoutDay[]): WorkoutDay[][] {
  if (days.length === 0) return []
  const startMs = new Date(days[0]!.date).getTime()
  const weeks: import("@workspace/ai").WorkoutDay[][] = []
  for (const day of days) {
    const weekIdx = Math.floor(
      (new Date(day.date).getTime() - startMs) / (7 * 24 * 60 * 60 * 1000)
    )
    if (!weeks[weekIdx]) weeks[weekIdx] = []
    weeks[weekIdx]!.push(day)
  }
  return weeks
}

export function getPhaseLabel(
  weekNum: number,
  totalWeeks: number,
  taperWeeks: number
): string {
  if (weekNum <= Math.floor(totalWeeks * 0.4)) return "Base"
  if (weekNum <= Math.floor(totalWeeks * 0.7)) return "Build"
  if (weekNum <= totalWeeks - taperWeeks) return "Peak"
  return "Taper"
}

export function getTaperWeeks(distance?: "5k" | "10k" | "half" | "full" | "ultra"): number {
  if (!distance) return 0
  if (distance === "5k" || distance === "10k") return 2
  return 3
}
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/plan/workout-utils.ts
git commit -m "feat: add workout display helpers for plan views"
```

---

### Task 7: `plan-day-detail.tsx`

**Files:**
- Create: `apps/web/app/plan/plan-day-detail.tsx`

Shared detail panel. Desktop: renders in a side panel slot. Mobile: rendered inside a fixed overlay.

- [ ] **Step 1: Create `apps/web/app/plan/plan-day-detail.tsx`**

```tsx
"use client"

import { format } from "date-fns"
import { Star } from "lucide-react"
import type { WorkoutDay } from "@workspace/ai"
import {
  WORKOUT_NAMES,
  WORKOUT_TEXT_CLASS,
  getWorkoutColor,
  formatDistance,
  distanceUnit,
} from "./workout-utils"

interface PlanDayDetailProps {
  day: WorkoutDay | null
  units: "km" | "miles"
  onClose?: () => void
}

export function PlanDayDetail({ day, units, onClose }: PlanDayDetailProps) {
  if (!day) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-subtle-foreground">Select a workout to see details</p>
      </div>
    )
  }

  const color = getWorkoutColor(day.type)
  const textClass = WORKOUT_TEXT_CLASS[day.type]
  const colorStyle = color ? { color } : undefined

  return (
    <div className="space-y-6 p-6">
      {onClose && (
        <button
          onClick={onClose}
          className="mb-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          ✕ Close
        </button>
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle-foreground mb-1">
          {format(new Date(day.date), "EEEE, MMM d, yyyy")}
        </p>
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          {day.type === "race" && <Star className="h-5 w-5 fill-primary text-primary" />}
          <span className={textClass} style={colorStyle}>
            {WORKOUT_NAMES[day.type]}
          </span>
        </h2>
      </div>

      {day.distanceKm != null && (
        <div>
          <span
            className={`text-5xl font-bold tracking-tight font-mono ${textClass}`}
            style={colorStyle}
          >
            {formatDistance(day.distanceKm, units)}
          </span>
          <span className="ml-2 text-lg text-muted-foreground">{distanceUnit(units)}</span>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle-foreground mb-2">
          Workout
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">{day.description}</p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle-foreground mb-2">
          Target HR Zone
        </p>
        <p className="text-sm text-subtle-foreground">—</p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle-foreground mb-2">
          Target Pace
        </p>
        <p className="text-sm text-subtle-foreground">—</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/plan/plan-day-detail.tsx
git commit -m "feat: add workout day detail panel"
```

---

### Task 8: `plan-header.tsx`

**Files:**
- Create: `apps/web/app/plan/plan-header.tsx`

- [ ] **Step 1: Create `apps/web/app/plan/plan-header.tsx`**

```tsx
"use client"

import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { formatDistance, distanceUnit } from "./workout-utils"

interface PlanHeaderProps {
  planName: string
  totalWeeks: number
  totalKm: number
  units: "km" | "miles"
  status: "generating" | "complete" | "error"
  generatingWeek: number
  goalTimeLabel?: string  // e.g. "3:30" — optional, only for race+timeGoal
}

export function PlanHeader({
  planName,
  totalWeeks,
  totalKm,
  units,
  status,
  generatingWeek,
  goalTimeLabel,
}: PlanHeaderProps) {
  const totalDisplay = formatDistance(totalKm, units)
  const unit = distanceUnit(units)

  return (
    <div className="border-b border-border">
      {/* Nav row */}
      <div className="flex items-center justify-between px-4 py-3">
        <Link
          href="/"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Link>

        {goalTimeLabel && (
          <span className="rounded-sm border border-primary/20 bg-primary/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-primary">
            Goal {goalTimeLabel}
          </span>
        )}
      </div>

      {/* Plan info row */}
      <div className="px-4 pb-4 space-y-3">
        <h1 className="text-xl font-semibold tracking-tight truncate">{planName}</h1>

        <div className="flex items-center gap-6">
          <div>
            <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--foreground)" }}>
              {totalWeeks > 0 ? totalWeeks : "—"}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle-foreground">
              Weeks
            </p>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums text-primary">
              {totalKm > 0 ? totalDisplay : "—"}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle-foreground">
              Total {unit}
            </p>
          </div>
        </div>

        {status === "generating" && (
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            <p className="text-xs text-muted-foreground">
              Generating week {generatingWeek}
              {totalWeeks > 0 ? ` of ${totalWeeks}` : ""}…
            </p>
          </div>
        )}

        {status === "error" && (
          <p className="text-xs text-destructive">
            Generation failed — please go back and try again.
          </p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/plan/plan-header.tsx
git commit -m "feat: add plan header with generating indicator"
```

---

### Task 9: `plan-calendar.tsx` (desktop view)

**Files:**
- Create: `apps/web/app/plan/plan-calendar.tsx`

Week-per-row grid. Visible on `md+` screens only (controlled by parent with `hidden md:block`).

- [ ] **Step 1: Create `apps/web/app/plan/plan-calendar.tsx`**

```tsx
"use client"

import { useState } from "react"
import { format } from "date-fns"
import { Star } from "lucide-react"
import type { WorkoutDay } from "@workspace/ai"
import { PlanDayDetail } from "./plan-day-detail"
import {
  groupDaysByWeek,
  getPhaseLabel,
  getTaperWeeks,
  WORKOUT_NAMES,
  WORKOUT_TEXT_CLASS,
  getWorkoutColor,
  formatDistance,
  distanceUnit,
} from "./workout-utils"

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

interface PlanCalendarProps {
  days: WorkoutDay[]
  units: "km" | "miles"
  totalWeeks: number
  raceDistance?: "5k" | "10k" | "half" | "full" | "ultra"
}

export function PlanCalendar({ days, units, totalWeeks, raceDistance }: PlanCalendarProps) {
  const [selectedDay, setSelectedDay] = useState<WorkoutDay | null>(null)
  const weeks = groupDaysByWeek(days)
  const taperWeeks = getTaperWeeks(raceDistance)
  const unit = distanceUnit(units)

  if (weeks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-subtle-foreground">
        Generating your plan…
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-200px)]">
      {/* Calendar scroll area */}
      <div className="flex-1 overflow-auto p-4">
        {/* Day of week header */}
        <div className="grid grid-cols-[64px_repeat(7,1fr)] gap-1 mb-1 sticky top-0 bg-background z-10 pb-2">
          <div />
          {DAY_ORDER.map((d) => (
            <div
              key={d}
              className="text-center text-[10px] font-semibold uppercase tracking-[0.1em] text-subtle-foreground"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Weeks */}
        {weeks.map((weekDays, weekIdx) => {
          if (!weekDays) return null
          const weekNum = weekIdx + 1
          const phase = totalWeeks > 0 ? getPhaseLabel(weekNum, totalWeeks, taperWeeks) : ""

          // Build a map of day-of-week → WorkoutDay for this week
          const dayMap: Record<string, WorkoutDay> = {}
          for (const day of weekDays) {
            const dow = format(new Date(day.date), "EEE") // "Mon", "Tue", etc.
            dayMap[dow] = day
          }

          const weeklyKm = weekDays.reduce((sum, d) => sum + (d.distanceKm ?? 0), 0)

          return (
            <div key={weekIdx} className="grid grid-cols-[64px_repeat(7,1fr)] gap-1 mb-1">
              {/* Week label column */}
              <div className="flex flex-col justify-center pr-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-subtle-foreground">
                  W{weekNum}
                </p>
                {phase && (
                  <p className="text-[9px] text-muted-foreground">{phase}</p>
                )}
                {weeklyKm > 0 && (
                  <p className="text-[10px] font-semibold tabular-nums text-muted-foreground">
                    {formatDistance(weeklyKm, units)}{unit}
                  </p>
                )}
              </div>

              {/* 7 day cells */}
              {DAY_ORDER.map((dow) => {
                const day = dayMap[dow]
                if (!day) {
                  // Day not in plan yet (still streaming) — empty placeholder
                  return (
                    <div
                      key={dow}
                      className="min-h-[72px] rounded-md border border-border bg-card opacity-20"
                    />
                  )
                }

                const isRest = day.type === "rest"
                const isRace = day.type === "race"
                const isSelected = selectedDay?.date === day.date
                const color = getWorkoutColor(day.type)
                const textClass = WORKOUT_TEXT_CLASS[day.type]

                return (
                  <button
                    key={dow}
                    onClick={() => setSelectedDay(isSelected ? null : day)}
                    className={[
                      "min-h-[72px] rounded-md border p-2 text-left transition-colors cursor-pointer",
                      isRace
                        ? "bg-primary/12 border-primary"
                        : isSelected
                        ? "bg-muted border-primary/40"
                        : "bg-card border-border hover:border-primary/25",
                      isRest ? "opacity-40" : "",
                    ].join(" ")}
                  >
                    <p className="text-[10px] text-subtle-foreground mb-1">
                      {format(new Date(day.date), "d")}
                    </p>

                    {isRace && (
                      <Star className="h-3 w-3 fill-primary text-primary mb-1" />
                    )}

                    {day.distanceKm != null && (
                      <p
                        className={`text-sm font-bold tabular-nums ${textClass}`}
                        style={color ? { color } : undefined}
                      >
                        {formatDistance(day.distanceKm, units)}
                        <span className="text-[9px] font-normal ml-0.5 text-muted-foreground">
                          {unit}
                        </span>
                      </p>
                    )}

                    <p
                      className={`text-[10px] mt-0.5 ${textClass}`}
                      style={color ? { color } : undefined}
                    >
                      {WORKOUT_NAMES[day.type]}
                    </p>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Detail side panel */}
      <div className="w-72 border-l border-border bg-card overflow-y-auto flex-shrink-0">
        <PlanDayDetail day={selectedDay} units={units} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/plan/plan-calendar.tsx
git commit -m "feat: add desktop calendar view for training plan"
```

---

### Task 10: `plan-feed.tsx` (mobile view)

**Files:**
- Create: `apps/web/app/plan/plan-feed.tsx`

Vertical day card list. Visible on `< md` screens only (controlled by parent with `md:hidden`).

- [ ] **Step 1: Create `apps/web/app/plan/plan-feed.tsx`**

```tsx
"use client"

import { useState } from "react"
import { format } from "date-fns"
import { Star } from "lucide-react"
import type { WorkoutDay } from "@workspace/ai"
import { PlanDayDetail } from "./plan-day-detail"
import {
  groupDaysByWeek,
  getPhaseLabel,
  getTaperWeeks,
  WORKOUT_NAMES,
  WORKOUT_TEXT_CLASS,
  getWorkoutColor,
  formatDistance,
  distanceUnit,
} from "./workout-utils"

interface PlanFeedProps {
  days: WorkoutDay[]
  units: "km" | "miles"
  totalWeeks: number
  raceDistance?: "5k" | "10k" | "half" | "full" | "ultra"
}

export function PlanFeed({ days, units, totalWeeks, raceDistance }: PlanFeedProps) {
  const [selectedDay, setSelectedDay] = useState<WorkoutDay | null>(null)
  const weeks = groupDaysByWeek(days)
  const taperWeeks = getTaperWeeks(raceDistance)
  const unit = distanceUnit(units)

  if (weeks.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-subtle-foreground">
        Generating your plan…
      </div>
    )
  }

  return (
    <>
      <div className="px-4 pb-24 space-y-2">
        {weeks.map((weekDays, weekIdx) => {
          if (!weekDays) return null
          const weekNum = weekIdx + 1
          const phase = totalWeeks > 0 ? getPhaseLabel(weekNum, totalWeeks, taperWeeks) : ""
          const weeklyKm = weekDays.reduce((sum, d) => sum + (d.distanceKm ?? 0), 0)
          const firstDate = weekDays[0] ? format(new Date(weekDays[0].date), "MMM d") : ""
          const lastDate = weekDays[weekDays.length - 1]
            ? format(new Date(weekDays[weekDays.length - 1]!.date), "MMM d")
            : ""

          return (
            <div key={weekIdx}>
              {/* Week divider */}
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-xs font-semibold">
                    Week {weekNum}{phase ? ` — ${phase}` : ""}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {firstDate}–{lastDate}
                  </p>
                </div>
                {weeklyKm > 0 && (
                  <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold tabular-nums">
                    {formatDistance(weeklyKm, units)} {unit}
                  </span>
                )}
              </div>

              {/* Day cards */}
              <div className="space-y-1.5">
                {weekDays.map((day) => {
                  const isRest = day.type === "rest"
                  const isRace = day.type === "race"
                  const isSelected = selectedDay?.date === day.date
                  const color = getWorkoutColor(day.type)
                  const textClass = WORKOUT_TEXT_CLASS[day.type]

                  const borderStyle = color
                    ? { borderLeftColor: color }
                    : day.type === "long" || day.type === "race"
                    ? { borderLeftColor: "var(--primary)" }
                    : day.type === "rest"
                    ? { borderLeftColor: "var(--subtle-foreground)" }
                    : { borderLeftColor: "var(--muted-foreground)" }

                  return (
                    <button
                      key={day.date}
                      onClick={() => setSelectedDay(isSelected ? null : day)}
                      className={[
                        "w-full rounded-lg border border-l-4 p-3 text-left transition-colors cursor-pointer",
                        isRace
                          ? "bg-primary/12 border-border"
                          : isSelected
                          ? "bg-muted border-border"
                          : "bg-card border-border hover:bg-muted",
                        isRest ? "opacity-40" : "",
                      ].join(" ")}
                      style={borderStyle}
                    >
                      <div className="flex items-center justify-between gap-3">
                        {/* Date */}
                        <div className="flex flex-col items-center w-10 flex-shrink-0">
                          <p className="text-lg font-bold tabular-nums leading-none">
                            {format(new Date(day.date), "d")}
                          </p>
                          <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-subtle-foreground">
                            {format(new Date(day.date), "EEE")}
                          </p>
                        </div>

                        {/* Workout info */}
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm font-semibold flex items-center gap-1.5 ${textClass}`}
                            style={color ? { color } : undefined}
                          >
                            {isRace && <Star className="h-3.5 w-3.5 fill-primary text-primary" />}
                            {WORKOUT_NAMES[day.type]}
                          </p>
                          {!isRest && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {day.description}
                            </p>
                          )}
                        </div>

                        {/* Distance */}
                        {day.distanceKm != null && (
                          <div className="text-right flex-shrink-0">
                            <p
                              className={`text-lg font-bold tabular-nums ${textClass}`}
                              style={color ? { color } : undefined}
                            >
                              {formatDistance(day.distanceKm, units)}
                            </p>
                            <p className="text-[10px] text-muted-foreground">{unit}</p>
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom sheet overlay for detail */}
      {selectedDay && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setSelectedDay(null)}>
          <div
            className="w-full max-h-[70vh] overflow-y-auto rounded-t-xl bg-card border-t border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-border mb-2" />
            <PlanDayDetail day={selectedDay} units={units} onClose={() => setSelectedDay(null)} />
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/plan/plan-feed.tsx
git commit -m "feat: add mobile feed view for training plan"
```

---

### Task 11: `plan/page.tsx` — streaming + layout

**Files:**
- Create: `apps/web/app/plan/page.tsx`

This is the main plan page. It reads onboarding data from `sessionStorage`, fires the streaming fetch, accumulates `WorkoutDay` objects into state via refs to avoid stale closures, and renders the correct view.

- [ ] **Step 1: Create `apps/web/app/plan/page.tsx`**

```tsx
"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import type { PlanGenerationInput, TrainingPlan, WorkoutDay } from "@workspace/ai"
import { PlanHeader } from "./plan-header"
import { PlanCalendar } from "./plan-calendar"
import { PlanFeed } from "./plan-feed"

const SESSION_KEY = "athloryx_onboarding"

function mapToInput(raw: Record<string, unknown>): PlanGenerationInput | null {
  const goal = raw["goal"] as string | undefined
  const selectedDays = raw["selectedDays"] as string[] | undefined
  const longRunDay = raw["longRunDay"] as string | undefined
  const units = raw["units"] as "km" | "miles" | undefined

  if (!goal || !selectedDays?.length || !longRunDay || !units) return null
  if (goal !== "race" && goal !== "aerobic_base") return null

  const input: PlanGenerationInput = {
    goal,
    selectedDays,
    longRunDay,
    units,
    strengthTraining: Boolean(raw["strengthTraining"]),
    strengthDays: raw["strengthDays"] as string[] | undefined,
  }

  if (goal === "race" && raw["race"]) {
    const race = raw["race"] as Record<string, unknown>
    input.race = {
      name: String(race["name"] ?? ""),
      date: String(race["date"] ?? ""),
      distance: (race["distance"] as PlanGenerationInput["race"]["distance"]),
      city: String(race["city"] ?? ""),
    }
  }

  if (raw["timeGoal"] === true && raw["goalTime"]) {
    const gt = raw["goalTime"] as Record<string, unknown>
    input.goalTime = {
      hours: Number(gt["hours"] ?? 0),
      minutes: Number(gt["minutes"] ?? 0),
    }
  }

  return input
}

function goalTimeLabel(input: PlanGenerationInput): string | undefined {
  if (!input.goalTime) return undefined
  const { hours, minutes } = input.goalTime
  return `${hours}:${minutes.toString().padStart(2, "0")}`
}

function planName(input: PlanGenerationInput): string {
  if (input.goal === "race" && input.race) return input.race.name
  return "Aerobic Base Plan"
}

export default function PlanPage() {
  const router = useRouter()
  const [plan, setPlan] = useState<Partial<TrainingPlan>>({ days: [] })
  const [status, setStatus] = useState<"generating" | "complete" | "error">("generating")
  const [generatingWeek, setGeneratingWeek] = useState(1)
  const [input, setInput] = useState<PlanGenerationInput | null>(null)

  // Refs to avoid stale closures inside the async stream loop
  const totalWeeksRef = useRef(0)
  const dayCountRef = useRef(0)
  const startDateRef = useRef<string | null>(null)

  useEffect(() => {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) { router.replace("/"); return }

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>
    } catch {
      router.replace("/")
      return
    }

    const mapped = mapToInput(parsed)
    if (!mapped) { router.replace("/"); return }
    setInput(mapped)

    async function stream() {
      let response: Response
      try {
        response = await fetch("/api/generate-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mapped),
        })
      } catch {
        setStatus("error")
        return
      }

      if (!response.ok || !response.body) {
        setStatus("error")
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        let done: boolean
        let value: Uint8Array | undefined
        try {
          ;({ done, value } = await reader.read())
        } catch {
          setStatus("error")
          return
        }

        if (done) {
          const expected = totalWeeksRef.current * 7
          if (expected > 0 && dayCountRef.current < expected) {
            setStatus("error")
          } else {
            setStatus("complete")
          }
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const parsed = JSON.parse(line) as Record<string, unknown>

            if (parsed["_meta"] === true) {
              const tw = Number(parsed["totalWeeks"] ?? 0)
              totalWeeksRef.current = tw
              setPlan((p) => ({
                ...p,
                totalWeeks: tw,
                totalKm: Number(parsed["totalKm"] ?? 0),
                peakWeekKm: Number(parsed["peakWeekKm"] ?? 0),
              }))
            } else {
              const day = parsed as WorkoutDay
              dayCountRef.current += 1
              if (!startDateRef.current) startDateRef.current = day.date
              const weekNum =
                Math.floor(
                  (new Date(day.date).getTime() - new Date(startDateRef.current).getTime()) /
                    (7 * 24 * 60 * 60 * 1000)
                ) + 1
              setGeneratingWeek(weekNum)
              setPlan((p) => ({ ...p, days: [...(p.days ?? []), day] }))
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    }

    void stream()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!input) return null  // redirecting

  return (
    <main className="min-h-svh flex flex-col">
      <PlanHeader
        planName={planName(input)}
        totalWeeks={plan.totalWeeks ?? 0}
        totalKm={plan.totalKm ?? 0}
        units={input.units}
        status={status}
        generatingWeek={generatingWeek}
        goalTimeLabel={goalTimeLabel(input)}
      />

      {/* Desktop: calendar */}
      <div className="hidden md:block flex-1">
        <PlanCalendar
          days={plan.days ?? []}
          units={input.units}
          totalWeeks={plan.totalWeeks ?? 0}
          raceDistance={input.race?.distance}
        />
      </div>

      {/* Mobile: feed */}
      <div className="md:hidden flex-1 overflow-y-auto pt-2">
        <PlanFeed
          days={plan.days ?? []}
          units={input.units}
          totalWeeks={plan.totalWeeks ?? 0}
          raceDistance={input.race?.distance}
        />
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/plan/page.tsx
git commit -m "feat: add plan page with streaming NDJSON consumer"
```

---

## Chunk 3: Wire onboarding

### Task 12: Wire `final-screen.tsx` to navigate to `/plan`

**Files:**
- Modify: `apps/web/components/onboarding/final-screen.tsx`

The "Generate Plan" button currently has an empty `onClick`. Wire it to write `OnboardingData` to `sessionStorage` and navigate to `/plan`.

- [ ] **Step 1: Update `apps/web/components/onboarding/final-screen.tsx`**

Add `useRouter` from `next/navigation` and wire the button. The full updated file:

```tsx
"use client"

import { differenceInWeeks, format } from "date-fns"
import type { ReactNode } from "react"
import { Calendar, MapPin, Timer } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@workspace/ui/components/button"
import { type Distance, type OnboardingData } from "./types"

const DISTANCE_KM: Record<Distance, string> = {
  "5k": "5 km",
  "10k": "10 km",
  half: "21.1 km",
  full: "42.2 km",
  ultra: "Ultra",
}

const DISTANCE_MI: Record<Distance, string> = {
  "5k": "3.1 mi",
  "10k": "6.2 mi",
  half: "13.1 mi",
  full: "26.2 mi",
  ultra: "Ultra",
}

const SESSION_KEY = "athloryx_onboarding"

interface FinalScreenProps {
  formData: OnboardingData
}

function DetailRow({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <span className="shrink-0">{icon}</span>
      <span>{text}</span>
    </div>
  )
}

export function FinalScreen({ formData }: FinalScreenProps) {
  const router = useRouter()
  const { race, goal, units } = formData
  const isRace = goal === "race" && race

  const distanceLabel = isRace
    ? units === "miles"
      ? DISTANCE_MI[race.distance]
      : DISTANCE_KM[race.distance]
    : null

  const weeks = isRace ? Math.max(0, differenceInWeeks(race.date, new Date())) : null

  const cityDisplay = isRace ? race.city : null

  const title = isRace
    ? `Your ${race.name} plan is nearly ready`
    : "Your aerobic base plan is nearly ready"

  function handleGenerate() {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(formData))
    router.push("/plan")
  }

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>

      {isRace && (
        <div className="space-y-4">
          <DetailRow
            icon={<Timer className="h-4 w-4" />}
            text={`${weeks} weeks · ${distanceLabel}`}
          />
          <DetailRow
            icon={<Calendar className="h-4 w-4" />}
            text={format(race.date, "EEE, MMM d, yyyy")}
          />
          <DetailRow
            icon={<MapPin className="h-4 w-4" />}
            text={cityDisplay!}
          />
        </div>
      )}

      <Button className="w-full" size="lg" onClick={handleGenerate}>
        Generate Plan
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm typecheck
```

Expected: `Tasks: 2 successful, 2 total`. No errors.

- [ ] **Step 3: End-to-end manual test**

```bash
pnpm dev
```

1. Open http://localhost:3000
2. Click "Create a Plan"
3. Complete the onboarding (select race or aerobic base, fill all steps)
4. On the final screen, click "Generate Plan"
5. Verify: navigates to `/plan`
6. Verify: plan header shows "Generating week 1…" indicator with pulsing dot
7. Verify: on desktop (`md+`), calendar grid populates week by week as stream arrives
8. Verify: on mobile (resize window to < 768px), feed cards appear as days stream in
9. Verify: clicking a workout cell / card shows workout detail
10. Verify: when stream completes, "Generating…" indicator disappears

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/onboarding/final-screen.tsx
git commit -m "feat: wire Generate Plan button to stream plan and navigate to /plan"
```

- [ ] **Step 5: Push**

```bash
git push
```
