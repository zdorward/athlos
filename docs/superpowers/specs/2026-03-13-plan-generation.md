# Athloryx Plan Generation

## Overview

Generate a personalized daily training plan via a streaming LLM call. The plan is displayed immediately in a responsive calendar (desktop) / feed (mobile) view. No auth, no database — value delivered before any login wall.

**Philosophy:** Match TikTok's activation energy model. The app generates and displays a complete training plan before asking for anything from the user.

---

## Data Model

### `WorkoutDay`

The atomic unit of a training plan. The LLM emits one per NDJSON line.

```typescript
type WorkoutType = "easy" | "long" | "tempo" | "intervals" | "rest" | "race" | "strength"

interface WorkoutDay {
  date: string         // ISO "2026-06-16"
  type: WorkoutType
  distanceKm?: number  // always in km regardless of user's units preference; omitted for rest days only
  description: string  // one sentence, coaching voice
}
```

**Units:** The LLM always outputs `distanceKm` in kilometres. The display layer (`plan-calendar.tsx`, `plan-feed.tsx`, `plan-day-detail.tsx`) converts to miles when `units === "miles"` using `km * 0.621371`, rounded to one decimal place. `totalKm` and `peakWeekKm` in `TrainingPlan` are also always in km and converted at display time.

**Race day:** For `type: "race"`, the LLM emits `distanceKm` equal to the actual race distance (42.2 for full marathon, 21.1 for half, 10 for 10K, 5 for 5K). This is passed in the user prompt.

### `TrainingPlanMeta`

Sent as the first NDJSON line, before any workout days.

```typescript
interface TrainingPlanMeta {
  _meta: true
  totalWeeks: number
  totalKm: number      // always km
  peakWeekKm: number   // always km
}
```

### `TrainingPlan`

Accumulated on the client as the stream arrives.

```typescript
interface TrainingPlan {
  totalWeeks: number
  totalKm: number
  peakWeekKm: number
  days: WorkoutDay[]
}
```

### Stream format

```
{"_meta":true,"totalWeeks":18,"totalKm":890,"peakWeekKm":54}
{"date":"2026-06-16","type":"easy","distanceKm":8,"description":"Conversational pace — keep it truly easy."}
{"date":"2026-06-17","type":"rest","description":"Full rest day."}
{"date":"2026-10-19","type":"race","distanceKm":42.2,"description":"Race day — Toronto Waterfront Marathon. Trust your training."}
```

### `PlanGenerationInput`

Derived from `OnboardingData`. Because `OnboardingData` fields are all optional (the type allows partial saves), the `/plan` page **must validate** that all required fields are present before building `PlanGenerationInput`. If any required field is missing, redirect to `/` immediately.

```typescript
interface PlanGenerationInput {
  goal: "race" | "aerobic_base"            // required — redirect if missing
  race?: {
    name: string
    date: string   // ISO string — see serialization note below
    distance: "5k" | "10k" | "half" | "full" | "ultra"
    city: string
  }
  goalTime?: { hours: number; minutes: number }
  selectedDays: string[]   // ["mon", "wed", "fri", "sun"] — required, redirect if empty
  longRunDay: string       // "sun" — required, redirect if missing
  units: "km" | "miles"   // required, redirect if missing
  strengthTraining: boolean
  strengthDays?: string[]
}
```

**Serialization note:** `OnboardingData.race.date` is a `Date` object. When writing to `sessionStorage`, call `JSON.stringify()` — this converts `Date` to an ISO string automatically. When reading back with `JSON.parse()`, `race.date` will already be a `string`. Use it directly as `PlanGenerationInput.race.date`. Do not attempt to reconstruct a `Date` object.

---

## AI Layer (`packages/ai/`)

Lives in `packages/ai/` following the existing monorepo workspace convention (`packages/*` is declared in `pnpm-workspace.yaml`). This makes it available to any future app.

### Package setup

**`packages/ai/package.json`:**
```json
{
  "name": "@workspace/ai",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "@anthropic-ai/sdk": "^0.39.0"
  }
}
```

**`apps/web/package.json`** — add to `dependencies`:
```json
"@workspace/ai": "workspace:*"
```

**`packages/ai/tsconfig.json`** — extend from `@workspace/typescript-config/base.json` following the pattern in other packages.

### Provider interface

```typescript
// packages/ai/src/provider.ts
export interface AIProvider {
  streamPlan(input: PlanGenerationInput): AsyncIterable<string>
  // yields complete NDJSON lines (trimmed, non-empty)
}
```

### Active provider

```typescript
// packages/ai/src/index.ts
export function getProvider(): AIProvider {
  return new ClaudeProvider()
  // swap to new OpenAIProvider() / new GeminiProvider() here — nothing else changes
}
```

### `ClaudeProvider`

```typescript
// packages/ai/src/providers/claude.ts
import Anthropic from "@anthropic-ai/sdk"
import type { AIProvider } from "../provider"
import type { PlanGenerationInput } from "../types"
import { buildPrompt } from "../prompt"

export class ClaudeProvider implements AIProvider {
  private client = new Anthropic() // reads ANTHROPIC_API_KEY from process.env

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
      if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
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

### Prompt (`packages/ai/src/prompt.ts`)

Returns `{ system: string, user: string }`.

**System prompt:**
```
You are an expert running coach who creates personalized training plans. You generate plans for athletes ranging from complete beginners to competitive runners targeting specific time goals.

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
- Do not emit any line that is not valid JSON.
```

**User prompt** — built by `buildPrompt()`:

```typescript
export function buildPrompt(input: PlanGenerationInput): { system: string; user: string } {
  const dayNames: Record<string, string> = {
    mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday",
    fri: "Friday", sat: "Saturday", sun: "Sunday",
  }
  const distanceKmMap: Record<string, number> = {
    "5k": 5, "10k": 10, "half": 21.1, "full": 42.2, "ultra": 80,
  }

  const lines: string[] = []

  if (input.goal === "race" && input.race) {
    const { name, date, distance, city } = input.race
    const raceKm = distanceKmMap[distance] ?? 42.2
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

  const runDayNames = input.selectedDays.map(d => dayNames[d]).join(", ")
  lines.push(`Available running days: ${runDayNames}`)
  lines.push(`Long run day: ${dayNames[input.longRunDay]}`)

  if (input.strengthTraining && input.strengthDays?.length) {
    const strengthDayNames = input.strengthDays.map(d => dayNames[d]).join(", ")
    lines.push(`Strength training days: ${strengthDayNames}`)
  } else {
    lines.push("Strength training: none")
  }

  lines.push(`Today's date: ${new Date().toISOString().split("T")[0]}`)
  lines.push("Output distances in kilometres.")

  return { system: SYSTEM_PROMPT, user: lines.join("\n") }
}
```

---

## API Route

**File:** `apps/web/app/api/generate-plan/route.ts`
**Method:** POST
**Body:** `PlanGenerationInput` as JSON
**Response:** `text/plain; charset=utf-8` stream of NDJSON lines, one per chunk

```typescript
import { type NextRequest } from "next/server"
import { getProvider } from "@workspace/ai"

export async function POST(req: NextRequest) {
  let input: PlanGenerationInput
  try {
    input = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 })
  }

  // Validate required fields
  if (!input.goal || !input.selectedDays?.length || !input.longRunDay || !input.units) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 })
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
      "Transfer-Encoding": "chunked",
      "X-Accel-Buffering": "no", // prevent Nginx from buffering the stream
    },
  })
}
```

**Error handling:**
- Missing/invalid body → 400
- Missing required fields → 400
- Provider throws before stream starts → 500 JSON error
- Provider throws mid-stream → `controller.error()`, client detects closed stream

**Environment variable:** `ANTHROPIC_API_KEY` in `.env.local` (gitignored). The Anthropic SDK reads it automatically from `process.env`.

---

## User Flow

1. User completes onboarding → reaches `final-screen.tsx`
2. Clicks "Generate Plan" (the button with empty `onClick` already exists in `final-screen.tsx`):
   - Serialize `OnboardingData` via `JSON.stringify()` and write to `sessionStorage` under key `"athloryx_onboarding"`
   - Navigate to `/plan` using `router.push("/plan")`
3. `/plan` page mounts:
   - Read `sessionStorage.getItem("athloryx_onboarding")` and `JSON.parse()`
   - Validate required fields — if any missing, `router.replace("/")` immediately
   - Map to `PlanGenerationInput`
   - Set `status = "generating"`, fire `fetch('/api/generate-plan', { method: 'POST', body: JSON.stringify(input) })`
4. Client reads stream:
   - First complete line → parse `TrainingPlanMeta`, set `plan.totalWeeks`, `plan.totalKm`, `plan.peakWeekKm`
   - Each subsequent line → parse `WorkoutDay`, append to `plan.days`
   - React re-renders incrementally as days arrive
5. Stream ends → set `status = "complete"`, remove generating indicator

If the user navigates away and back within the same session, `sessionStorage` still holds onboarding data. Plan must be regenerated — acceptable, no persistence yet.

---

## Plan Page (`apps/web/app/plan/`)

### State (`page.tsx`)

```typescript
const [plan, setPlan] = useState<Partial<TrainingPlan>>({ days: [] })
const [status, setStatus] = useState<"generating" | "complete" | "error">("generating")
const [generatingWeek, setGeneratingWeek] = useState(1)

// Refs for values needed inside the async stream loop — avoids stale closure bugs
const totalWeeksRef = useRef<number>(0)
const dayCountRef = useRef<number>(0)
const startDateRef = useRef<string | null>(null)
```

**`generatingWeek` derivation:** Inside the stream loop, after each `WorkoutDay` is received:
```typescript
if (!startDateRef.current) startDateRef.current = day.date
const startMs = new Date(startDateRef.current).getTime()
const currentMs = new Date(day.date).getTime()
const weekNum = Math.floor((currentMs - startMs) / (7 * 24 * 60 * 60 * 1000)) + 1
setGeneratingWeek(weekNum)
```

**Incomplete stream detection:** Uses `dayCountRef` (a ref, not state) to avoid stale closures. When `done === true`:
```typescript
const expectedDays = totalWeeksRef.current * 7
if (dayCountRef.current < expectedDays) setStatus("error")
else setStatus("complete")
```
This check applies to both race plans and aerobic base plans (aerobic base always has `totalWeeks = 16`, so `expectedDays = 112`).

**Client-side NDJSON read loop:**
```typescript
const response = await fetch("/api/generate-plan", { method: "POST", body: JSON.stringify(input) })
if (!response.ok) { setStatus("error"); return }

const reader = response.body!.getReader()
const decoder = new TextDecoder()
let buffer = ""

while (true) {
  const { done, value } = await reader.read()
  if (done) {
    // Use refs (not stale state) for the completion check
    const expectedDays = totalWeeksRef.current * 7
    if (dayCountRef.current < expectedDays) setStatus("error")
    else setStatus("complete")
    break
  }
  buffer += decoder.decode(value, { stream: true })
  const lines = buffer.split("\n")
  buffer = lines.pop() ?? ""
  for (const line of lines) {
    if (!line.trim()) continue
    try {
      const parsed = JSON.parse(line)
      if (parsed._meta) {
        totalWeeksRef.current = parsed.totalWeeks
        setPlan(p => ({ ...p, totalWeeks: parsed.totalWeeks, totalKm: parsed.totalKm, peakWeekKm: parsed.peakWeekKm }))
      } else {
        dayCountRef.current += 1
        if (!startDateRef.current) startDateRef.current = parsed.date
        const weekNum = Math.floor(
          (new Date(parsed.date).getTime() - new Date(startDateRef.current).getTime()) / (7 * 24 * 60 * 60 * 1000)
        ) + 1
        setGeneratingWeek(weekNum)
        setPlan(p => ({ ...p, days: [...(p.days ?? []), parsed as WorkoutDay] }))
      }
    } catch {
      // skip malformed lines silently
    }
  }
}
```

**Note on `units`:** The `units` field from `PlanGenerationInput` is intentionally not sent to the LLM — the system prompt instructs the model to always output km. The `units` value is passed as a prop from `page.tsx` to all display components for client-side conversion only.
```

### Layout

```tsx
// plan/page.tsx (simplified)
return (
  <>
    <PlanHeader plan={plan} status={status} generatingWeek={generatingWeek} units={input.units} />
    <div className="hidden md:block">
      <PlanCalendar days={plan.days ?? []} units={input.units} />
    </div>
    <div className="md:hidden">
      <PlanFeed days={plan.days ?? []} units={input.units} />
    </div>
  </>
)
```

### `plan-header.tsx`

Displays: race name (or "Aerobic Base Plan"), race date (if applicable), goal time badge, total km/miles (converted), total weeks. While `status === "generating"`, shows "Generating week N of M…" with a small animated dot. Disappears when `status === "complete"`.

### `plan-calendar.tsx`

Desktop (`md+`). Week-per-row grid, Mon–Sun columns. Each cell shows workout type dot, distance (converted), and a one-line truncated description on hover/click.

**Week grouping:** Group `days` by ISO week using the plan's own start date (not calendar ISO week numbers, to avoid year-boundary edge cases). Week N = days where `Math.floor((day.date - startDate) / 7days) === N - 1`.

**Phase labels:** For a plan of `totalWeeks` weeks:
```
Base:   weeks 1 to Math.floor(totalWeeks * 0.4)
Build:  weeks Math.floor(totalWeeks * 0.4) + 1 to Math.floor(totalWeeks * 0.7)
Peak:   weeks Math.floor(totalWeeks * 0.7) + 1 to totalWeeks - taperWeeks
Taper:  final taperWeeks weeks (2 for 5K/10K, 3 for half/full/ultra — passed as prop from page.tsx)
```

Clicking a cell opens `<PlanDayDetail />` in a side panel.

### `plan-feed.tsx`

Mobile (`< md`). Vertical list of day cards, grouped by week with week header dividers. Each card: date number, day-of-week label, colored left border by workout type, workout name, distance (converted), one-line description. Tapping opens `<PlanDayDetail />` in a bottom sheet (use a simple fixed-position overlay).

### `plan-day-detail.tsx`

Shared. Props: `day: WorkoutDay | null`, `units: "km" | "miles"`. Displays: workout type, full date, distance (converted with unit label), full description. Includes placeholder rows for "Target HR Zone" and "Target Pace" with `—` values (ready for wearable data integration — do not hide these rows).

---

## Workout Type Color Coding

Consistent across calendar, feed, and detail panel. Use CSS custom properties from the design system.

| Type | Color token | Display name |
|---|---|---|
| `easy` | `--muted-foreground` | Easy Run |
| `long` | `--primary` | Long Run |
| `tempo` | `oklch(0.78 0.15 80)` (amber) | Tempo Run |
| `intervals` | `oklch(0.75 0.18 30)` (orange-red) | Intervals |
| `strength` | `oklch(0.65 0.15 300)` (purple) | Strength |
| `rest` | `--subtle-foreground` | Rest Day |
| `race` | `--primary` + gold star icon (`⭐` or Lucide `Star`) before the name, full cell highlight with `bg-primary/12 border-primary` | Race Day |

---

## Future-Proofing

This design is deliberately minimal but leaves clear hooks for future features:

- **Wearable data / HR zones:** `plan-day-detail.tsx` already renders placeholder rows for `targetHRZone` and `targetPace`. When the LLM emits these fields, they populate automatically.
- **Plan adaptation:** The API route can accept an optional `adjustments` field (injury, goal change, missed week). The prompt builder appends it to the user prompt. No interface changes.
- **Auth + persistence:** When Supabase is added, `page.tsx` saves the completed plan to DB after stream completes. Streaming and display logic unchanged.
- **Provider swap:** Add one file in `packages/ai/src/providers/`, update `getProvider()`.

---

## Files to Create or Modify

**New files:**

| File | Purpose |
|---|---|
| `packages/ai/package.json` | Workspace package config, declares `@workspace/ai` |
| `packages/ai/tsconfig.json` | Extends `@workspace/typescript-config/base.json` |
| `packages/ai/src/types.ts` | `PlanGenerationInput`, `WorkoutDay`, `TrainingPlan`, `TrainingPlanMeta` |
| `packages/ai/src/provider.ts` | `AIProvider` interface |
| `packages/ai/src/index.ts` | `getProvider()` |
| `packages/ai/src/prompt.ts` | `buildPrompt()` — system + user prompt builder |
| `packages/ai/src/providers/claude.ts` | `ClaudeProvider` |
| `apps/web/app/api/generate-plan/route.ts` | Streaming POST handler |
| `apps/web/app/plan/page.tsx` | Plan page — state, streaming, layout switch |
| `apps/web/app/plan/plan-header.tsx` | Summary + generating indicator |
| `apps/web/app/plan/plan-calendar.tsx` | Desktop calendar view |
| `apps/web/app/plan/plan-feed.tsx` | Mobile feed view |
| `apps/web/app/plan/plan-day-detail.tsx` | Workout detail panel |
| `.env.local` | `ANTHROPIC_API_KEY=...` (gitignored, create manually) |

**Modified files:**

| File | Change |
|---|---|
| `apps/web/components/onboarding/final-screen.tsx` | Wire "Generate Plan" button: write to sessionStorage, navigate to `/plan` |
| `apps/web/package.json` | Add `"@workspace/ai": "workspace:*"` to dependencies |
| `packages/ai/` | Note: `lib/intelligence/calculate_adaption.ts` already exists at root `lib/` — leave it untouched, `packages/ai/` is a separate workspace package |
