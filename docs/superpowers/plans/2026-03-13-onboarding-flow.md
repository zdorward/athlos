# Onboarding Flow Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing landing page with a Runna-style multi-step onboarding flow that collects a user's training preferences to generate a personalized plan.

**Architecture:** Single-page React state machine in `OnboardingFlow` that owns `currentStep`, `direction`, and `formData`. Step components are stateless and communicate only via `onNext(Partial<OnboardingData>)` and `onBack()`. Framer Motion handles slide transitions.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Framer Motion (already installed), lucide-react (already installed), date-fns (transitive dep via shadcn Calendar)

---

## Chunk 1: Setup

### Task 1: Install prerequisite shadcn components

**Files:**
- Modifies: `packages/ui/src/components/` (adds calendar, popover, select, input, label)

The spec lists calendar, popover, and select as prerequisites. This task also adds input and label, which are required by StepFindRace (Task 8). None of these five files exist yet in `packages/ui/src/components/`.

- [ ] **Step 1: Install the five shadcn components**

Run each from the repo root:

```bash
pnpm dlx shadcn@latest add calendar -c apps/web
pnpm dlx shadcn@latest add popover -c apps/web
pnpm dlx shadcn@latest add select -c apps/web
pnpm dlx shadcn@latest add input -c apps/web
pnpm dlx shadcn@latest add label -c apps/web
```

- [ ] **Step 2: Verify files exist**

```bash
ls packages/ui/src/components/
```

Expected output includes: `calendar.tsx`, `popover.tsx`, `select.tsx`, `input.tsx`, `label.tsx`

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/components/
git commit -m "feat: add calendar, popover, select, input, label shadcn components"
```

---

### Task 2: Create shared types and constants

**Files:**
- Create: `apps/web/components/onboarding/types.ts`

- [ ] **Step 1: Create the types file**

```ts
// apps/web/components/onboarding/types.ts

export type Goal = "race" | "aerobic_base"
export type Day = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"
export type Distance = "5k" | "10k" | "half" | "full" | "ultra"
export type Units = "km" | "miles"

export const DISTANCE_LABELS: Record<Distance, string> = {
  "5k":    "5K",
  "10k":   "10K",
  "half":  "Half Marathon",
  "full":  "Full Marathon",
  "ultra": "Ultra",
}

export const DAY_LABELS: Record<Day, { short: string; full: string }> = {
  mon: { short: "Mon", full: "Monday" },
  tue: { short: "Tue", full: "Tuesday" },
  wed: { short: "Wed", full: "Wednesday" },
  thu: { short: "Thu", full: "Thursday" },
  fri: { short: "Fri", full: "Friday" },
  sat: { short: "Sat", full: "Saturday" },
  sun: { short: "Sun", full: "Sunday" },
}

export const ORDERED_DAYS: Day[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

export interface RaceData {
  name: string
  city: string
  date: Date
  distance: Distance
}

export interface OnboardingData {
  goal?: Goal
  race?: RaceData
  daysPerWeek?: 1 | 2 | 3 | 4 | 5 | 6 | 7
  selectedDays?: Day[]
  longRunDay?: Day
  units?: Units
  strengthTraining?: boolean
}

export const STEPS_RACE = [
  "goal", "findRace", "daysPerWeek", "whichDays", "longRunDay", "units", "strength",
] as const

export const STEPS_AEROBIC = [
  "goal", "daysPerWeek", "whichDays", "longRunDay", "units", "strength",
] as const

export function getSteps(goal?: Goal): readonly string[] {
  return goal === "race" ? STEPS_RACE : STEPS_AEROBIC
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/onboarding/types.ts
git commit -m "feat: add onboarding types and constants"
```

---

### Task 3: Delete old landing components and rewrite page.tsx

**Files:**
- Delete: `apps/web/components/landing/` (entire directory)
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Delete the landing directory**

```bash
rm -rf apps/web/components/landing
```

- [ ] **Step 2: Replace page.tsx**

```tsx
// apps/web/app/page.tsx
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow"

export default function Page() {
  return (
    <main className="min-h-svh">
      <OnboardingFlow />
    </main>
  )
}
```

Note: `OnboardingFlow` does not exist yet — the build will fail until Task 15 is complete. That is expected.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/page.tsx
git add -u apps/web/components/landing/
git commit -m "chore: delete landing components, stub new page"
```

---

## Chunk 2: Primitive Components

### Task 4: OnboardingCard component

**Files:**
- Create: `apps/web/components/onboarding/onboarding-card.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/components/onboarding/onboarding-card.tsx
import { cn } from "@workspace/ui/lib/utils"

interface OnboardingCardProps {
  label: string
  description?: string
  selected: boolean
  onClick: () => void
}

export function OnboardingCard({ label, description, selected, onClick }: OnboardingCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-xl border p-4 text-left transition-all",
        selected
          ? "ring-2 ring-primary bg-primary/5 border-primary/20"
          : "border-border bg-card hover:bg-muted/50"
      )}
    >
      <div className="font-medium">{label}</div>
      {description && (
        <div className="mt-1 text-sm text-muted-foreground">{description}</div>
      )}
    </button>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/onboarding/onboarding-card.tsx
git commit -m "feat: add OnboardingCard component"
```

---

### Task 5: DayToggle component

**Files:**
- Create: `apps/web/components/onboarding/day-toggle.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/components/onboarding/day-toggle.tsx
import { cn } from "@workspace/ui/lib/utils"
import type { Day } from "./types"

interface DayToggleProps {
  day: Day
  label: string
  selected: boolean
  onClick: () => void
  disabled: boolean
}

export function DayToggle({ label, selected, onClick, disabled }: DayToggleProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium border transition-all",
        selected
          ? "bg-primary text-primary-foreground border-primary"
          : disabled
          ? "opacity-40 cursor-not-allowed border-border"
          : "border-border hover:bg-muted"
      )}
    >
      {label}
    </button>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/onboarding/day-toggle.tsx
git commit -m "feat: add DayToggle component"
```

---

### Task 6: OnboardingProgress component

**Files:**
- Create: `apps/web/components/onboarding/onboarding-progress.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/components/onboarding/onboarding-progress.tsx

interface OnboardingProgressProps {
  currentStep: number
  totalSteps: number
}

export function OnboardingProgress({ currentStep, totalSteps }: OnboardingProgressProps) {
  const fill = ((currentStep + 1) / totalSteps) * 100

  return (
    <div className="w-full space-y-2">
      <p className="text-sm text-muted-foreground">
        Step {currentStep + 1} of {totalSteps}
      </p>
      <div className="h-1.5 w-full rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${fill}%` }}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/onboarding/onboarding-progress.tsx
git commit -m "feat: add OnboardingProgress component"
```

---

## Chunk 3: Step Components

### Task 7: StepGoal

**Files:**
- Create: `apps/web/components/onboarding/steps/step-goal.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/components/onboarding/steps/step-goal.tsx
import { OnboardingCard } from "../onboarding-card"
import type { Goal, OnboardingData } from "../types"

interface StepGoalProps {
  formData: OnboardingData
  onNext: (data: Partial<OnboardingData>) => void
  onBack: () => void
}

export function StepGoal({ formData, onNext }: StepGoalProps) {
  function handleSelect(goal: Goal) {
    onNext({ goal })
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">What is your goal?</h2>
      <div className="space-y-3">
        <OnboardingCard
          label="Race"
          description="Train for a specific race event"
          selected={formData.goal === "race"}
          onClick={() => handleSelect("race")}
        />
        <OnboardingCard
          label="Build Aerobic Base"
          description="Improve your general fitness and endurance"
          selected={formData.goal === "aerobic_base"}
          onClick={() => handleSelect("aerobic_base")}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/onboarding/steps/step-goal.tsx
git commit -m "feat: add StepGoal"
```

---

### Task 8: StepFindRace

**Files:**
- Create: `apps/web/components/onboarding/steps/step-find-race.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/components/onboarding/steps/step-find-race.tsx
"use client"

import { useState } from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Calendar } from "@workspace/ui/components/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { cn } from "@workspace/ui/lib/utils"
import { DISTANCE_LABELS, type Distance, type OnboardingData } from "../types"

interface StepFindRaceProps {
  formData: OnboardingData
  onNext: (data: Partial<OnboardingData>) => void
  onBack: () => void
}

export function StepFindRace({ formData, onNext }: StepFindRaceProps) {
  const existing = formData.race
  const [name, setName] = useState(existing?.name ?? "")
  const [city, setCity] = useState(existing?.city ?? "")
  const [date, setDate] = useState<Date | undefined>(existing?.date)
  const [distance, setDistance] = useState<Distance | undefined>(existing?.distance)

  const isValid =
    name.trim() !== "" && city.trim() !== "" && date !== undefined && distance !== undefined

  function handleNext() {
    if (!isValid || !date || !distance) return
    onNext({ race: { name: name.trim(), city: city.trim(), date, distance } })
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">Tell us about your race</h2>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="race-name">Race Name</Label>
          <Input
            id="race-name"
            placeholder="e.g. Boston Marathon"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="race-city">City</Label>
          <Input
            id="race-city"
            placeholder="e.g. Boston, MA"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "MMMM d, yyyy") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                disabled={(d) => d <= new Date()}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1.5">
          <Label>Distance</Label>
          <Select value={distance} onValueChange={(v) => setDistance(v as Distance)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a distance" />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(DISTANCE_LABELS) as [Distance, string][]).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button onClick={handleNext} disabled={!isValid} className="w-full">
        Next
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/onboarding/steps/step-find-race.tsx
git commit -m "feat: add StepFindRace"
```

---

### Task 9: StepDaysPerWeek

**Files:**
- Create: `apps/web/components/onboarding/steps/step-days-per-week.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/components/onboarding/steps/step-days-per-week.tsx
import { cn } from "@workspace/ui/lib/utils"
import type { OnboardingData } from "../types"

const OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const

interface StepDaysPerWeekProps {
  formData: OnboardingData
  onNext: (data: Partial<OnboardingData>) => void
  onBack: () => void
}

export function StepDaysPerWeek({ formData, onNext }: StepDaysPerWeekProps) {
  function handleSelect(n: 1 | 2 | 3 | 4 | 5 | 6 | 7) {
    onNext({ daysPerWeek: n })
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">
        How many days per week would you like to run?
      </h2>
      <div className="flex gap-2">
        {OPTIONS.map((n) => (
          <button
            key={n}
            onClick={() => handleSelect(n)}
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-full text-sm font-medium border transition-all",
              formData.daysPerWeek === n
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:bg-muted"
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/onboarding/steps/step-days-per-week.tsx
git commit -m "feat: add StepDaysPerWeek"
```

---

### Task 10: StepWhichDays

**Files:**
- Create: `apps/web/components/onboarding/steps/step-which-days.tsx`

Note: this step uses **local state** for toggling, and only calls `onNext` (advancing) when the user clicks Next.

- [ ] **Step 1: Create the component**

```tsx
// apps/web/components/onboarding/steps/step-which-days.tsx
"use client"

import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { DayToggle } from "../day-toggle"
import { ORDERED_DAYS, DAY_LABELS, type Day, type OnboardingData } from "../types"

interface StepWhichDaysProps {
  formData: OnboardingData
  onNext: (data: Partial<OnboardingData>) => void
  onBack: () => void
}

export function StepWhichDays({ formData, onNext }: StepWhichDaysProps) {
  const daysPerWeek = formData.daysPerWeek ?? 3
  const [selected, setSelected] = useState<Day[]>(formData.selectedDays ?? [])

  function toggle(day: Day) {
    if (selected.includes(day)) {
      setSelected(selected.filter((d) => d !== day))
    } else {
      if (selected.length < daysPerWeek) {
        setSelected([...selected, day])
      }
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">
        Which days are you free to run?
      </h2>

      <div className="flex gap-2">
        {ORDERED_DAYS.map((day) => (
          <DayToggle
            key={day}
            day={day}
            label={DAY_LABELS[day].short}
            selected={selected.includes(day)}
            onClick={() => toggle(day)}
            disabled={selected.length >= daysPerWeek && !selected.includes(day)}
          />
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        Select {daysPerWeek} days ({selected.length} selected)
      </p>

      <Button
        onClick={() => onNext({ selectedDays: selected })}
        disabled={selected.length !== daysPerWeek}
        className="w-full"
      >
        Next
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/onboarding/steps/step-which-days.tsx
git commit -m "feat: add StepWhichDays"
```

---

### Task 11: StepLongRunDay

**Files:**
- Create: `apps/web/components/onboarding/steps/step-long-run-day.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/components/onboarding/steps/step-long-run-day.tsx
import { ChevronLeft } from "lucide-react"
import { OnboardingCard } from "../onboarding-card"
import { DAY_LABELS, type Day, type OnboardingData } from "../types"

interface StepLongRunDayProps {
  formData: OnboardingData
  onNext: (data: Partial<OnboardingData>) => void
  onBack: () => void
}

export function StepLongRunDay({ formData, onNext, onBack }: StepLongRunDayProps) {
  const days = formData.selectedDays ?? []

  if (days.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Something went wrong — please go back</p>
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">
        Which day would you like your long run?
      </h2>
      <div className="space-y-3">
        {days.map((day: Day) => (
          <OnboardingCard
            key={day}
            label={DAY_LABELS[day].full}
            selected={formData.longRunDay === day}
            onClick={() => onNext({ longRunDay: day })}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/onboarding/steps/step-long-run-day.tsx
git commit -m "feat: add StepLongRunDay"
```

---

### Task 12: StepUnits

**Files:**
- Create: `apps/web/components/onboarding/steps/step-units.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/components/onboarding/steps/step-units.tsx
import { OnboardingCard } from "../onboarding-card"
import type { OnboardingData } from "../types"

interface StepUnitsProps {
  formData: OnboardingData
  onNext: (data: Partial<OnboardingData>) => void
  onBack: () => void
}

export function StepUnits({ formData, onNext }: StepUnitsProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">Do you prefer km or miles?</h2>
      <div className="space-y-3">
        <OnboardingCard
          label="km"
          selected={formData.units === "km"}
          onClick={() => onNext({ units: "km" })}
        />
        <OnboardingCard
          label="miles"
          selected={formData.units === "miles"}
          onClick={() => onNext({ units: "miles" })}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/onboarding/steps/step-units.tsx
git commit -m "feat: add StepUnits"
```

---

### Task 13: StepStrengthTraining

**Files:**
- Create: `apps/web/components/onboarding/steps/step-strength-training.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/components/onboarding/steps/step-strength-training.tsx
import { OnboardingCard } from "../onboarding-card"
import type { OnboardingData } from "../types"

interface StepStrengthTrainingProps {
  formData: OnboardingData
  onNext: (data: Partial<OnboardingData>) => void
  onBack: () => void
}

export function StepStrengthTraining({ formData, onNext }: StepStrengthTrainingProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">
        Would you like to include strength training?
      </h2>
      <div className="space-y-3">
        <OnboardingCard
          label="Yes"
          selected={formData.strengthTraining === true}
          onClick={() => onNext({ strengthTraining: true })}
        />
        <OnboardingCard
          label="No"
          selected={formData.strengthTraining === false}
          onClick={() => onNext({ strengthTraining: false })}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/onboarding/steps/step-strength-training.tsx
git commit -m "feat: add StepStrengthTraining"
```

---

## Chunk 4: Orchestration

### Task 14: FinalScreen

**Files:**
- Create: `apps/web/components/onboarding/final-screen.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/components/onboarding/final-screen.tsx
import { format } from "date-fns"
import { Button } from "@workspace/ui/components/button"
import { DISTANCE_LABELS, DAY_LABELS, type OnboardingData } from "./types"

interface FinalScreenProps {
  formData: OnboardingData
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  )
}

export function FinalScreen({ formData }: FinalScreenProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">Here's your plan summary</h2>

      <div className="rounded-xl border p-6 space-y-4">
        <Row
          label="Goal"
          value={formData.goal === "race" ? "Race" : "Build Aerobic Base"}
        />

        {formData.goal === "race" && formData.race && (
          <Row
            label="Race"
            value={`${formData.race.name} · ${formData.race.city} · ${format(formData.race.date, "MMM d, yyyy")} · ${DISTANCE_LABELS[formData.race.distance]}`}
          />
        )}

        <Row
          label="Training days"
          value={`${formData.daysPerWeek} days/week — ${formData.selectedDays?.map((d) => DAY_LABELS[d].short).join(", ")}`}
        />

        <Row
          label="Long run"
          value={formData.longRunDay ? DAY_LABELS[formData.longRunDay].full : "—"}
        />

        <Row label="Units" value={formData.units ?? "—"} />

        <Row
          label="Strength training"
          value={formData.strengthTraining === true ? "Yes" : "No"}
        />
      </div>

      <Button className="w-full" size="lg" onClick={() => {}}>
        Generate Plan
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/onboarding/final-screen.tsx
git commit -m "feat: add FinalScreen"
```

---

### Task 15: OnboardingFlow (state machine)

**Files:**
- Create: `apps/web/components/onboarding/onboarding-flow.tsx`

This is the heart of the feature. It owns all state and applies the side-effect rules from the spec:
- Goal change → clear `race`
- `daysPerWeek` change → clear `selectedDays` and `longRunDay`
- `selectedDays` change → clear `longRunDay` if it's no longer in the new selection

- [ ] **Step 1: Create the component**

```tsx
// apps/web/components/onboarding/onboarding-flow.tsx
"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronLeft } from "lucide-react"
import { OnboardingProgress } from "./onboarding-progress"
import { FinalScreen } from "./final-screen"
import { StepGoal } from "./steps/step-goal"
import { StepFindRace } from "./steps/step-find-race"
import { StepDaysPerWeek } from "./steps/step-days-per-week"
import { StepWhichDays } from "./steps/step-which-days"
import { StepLongRunDay } from "./steps/step-long-run-day"
import { StepUnits } from "./steps/step-units"
import { StepStrengthTraining } from "./steps/step-strength-training"
import { getSteps, type OnboardingData } from "./types"

const slideVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction > 0 ? -60 : 60, opacity: 0 }),
}

export function OnboardingFlow() {
  const [currentStep, setCurrentStep] = useState(0)
  const [direction, setDirection] = useState<1 | -1>(1)
  const [formData, setFormData] = useState<OnboardingData>({})

  const steps = getSteps(formData.goal)
  const isComplete = currentStep >= steps.length

  function advance() {
    setDirection(1)
    setCurrentStep((s) => s + 1)
  }

  function goBack() {
    setDirection(-1)
    setCurrentStep((s) => s - 1)
  }

  function handleNext(data: Partial<OnboardingData>) {
    let merged: OnboardingData = { ...formData, ...data }

    // Goal change: clear race data
    if ("goal" in data && data.goal !== formData.goal) {
      merged = { ...merged, race: undefined }
    }

    // daysPerWeek change: clear downstream day selections
    if ("daysPerWeek" in data && data.daysPerWeek !== formData.daysPerWeek) {
      merged = { ...merged, selectedDays: [], longRunDay: undefined }
    }

    // selectedDays change: clear longRunDay if it's no longer in the new selection
    if ("selectedDays" in data) {
      const newDays = data.selectedDays ?? []
      if (merged.longRunDay && !newDays.includes(merged.longRunDay)) {
        merged = { ...merged, longRunDay: undefined }
      }
    }

    setFormData(merged)
    advance()
  }

  const stepKey = isComplete ? "final" : steps[currentStep]
  const stepProps = { formData, onNext: handleNext, onBack: goBack }

  function renderStep() {
    if (isComplete) return <FinalScreen formData={formData} />
    const stepName = steps[currentStep]
    switch (stepName) {
      case "goal":        return <StepGoal {...stepProps} />
      case "findRace":    return <StepFindRace {...stepProps} />
      case "daysPerWeek": return <StepDaysPerWeek {...stepProps} />
      case "whichDays":   return <StepWhichDays {...stepProps} />
      case "longRunDay":  return <StepLongRunDay {...stepProps} />
      case "units":       return <StepUnits {...stepProps} />
      case "strength":    return <StepStrengthTraining {...stepProps} />
      default:            return null
    }
  }

  return (
    <div className="relative mx-auto max-w-md px-4 py-12">
      {currentStep > 0 && !isComplete && (
        <button
          onClick={goBack}
          className="mb-6 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
      )}

      {!isComplete && (
        <div className="mb-8">
          <OnboardingProgress currentStep={currentStep} totalSteps={steps.length} />
        </div>
      )}

      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={stepKey}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          {renderStep()}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors (page.tsx now resolves too)

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/onboarding/onboarding-flow.tsx
git commit -m "feat: add OnboardingFlow state machine"
```

---

### Task 16: Verify end-to-end in browser

- [ ] **Step 1: Start dev server**

```bash
pnpm dev
```

Open `http://localhost:3000` in a browser.

- [ ] **Step 2: Verify the Race path**

Walk through every step in order:
1. Step 1 of 6 — tap **Race** → advances to step 2
2. Step 2 of 7 — fill in Race Name, City, Date (future date), Distance → tap Next
3. Step 3 of 7 — tap a number (e.g. 3) → advances
4. Step 4 of 7 — tap exactly 3 days → tap Next
5. Step 5 of 7 — tap a long run day → advances
6. Step 6 of 7 — tap **miles** → advances
7. Step 7 of 7 — tap **Yes** → advances to Final Screen
8. Final screen shows correct summary; "Generate Plan" button is visible

- [ ] **Step 3: Verify the Aerobic Base path**

Tap Back until you reach Step 1. Tap **Build Aerobic Base**. Confirm step count is now "of 6" and there is no race step. Complete the flow.

- [ ] **Step 4: Verify back-navigation side effects**

1. Complete a Race flow with 4 days/week
2. Tap Back to reach Days Per Week
3. Change to 3 days — confirm Which Days is blank (no pre-selection)
4. Select 3 new days — confirm Long Run Day shows only those 3 days

- [ ] **Step 5: Run typecheck and lint**

```bash
pnpm typecheck && pnpm lint
```

Expected: no errors

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete onboarding flow"
```
