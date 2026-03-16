# Landing Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic landing page with an aurora-background hero that embeds a live race search, letting users enter the onboarding flow directly from the landing page, while removing the aerobic base goal from the product entirely.

**Architecture:** Four self-contained changes applied in dependency order: (1) update the onboarding types so `getSteps()` is race-only and `OnboardingData` gains `manualRaceEntry`; (2) add an `initialMode` prop to `StepFindRace`; (3) update `OnboardingFlow` to accept `initialData` and wire it through; (4) delete `StepGoal`; (5) rewrite `apps/web/app/page.tsx` with the aurora background, race search widget, and both onboarding entry paths.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, `date-fns` (`parseISO`, `format`), inline `<style>` tag for CSS `@keyframes` bloom animations

---

## Chunk 1: Onboarding changes

### Task 1: Update `types.ts` — race-only types and `getSteps()` signature

**Files:**
- Modify: `apps/web/components/onboarding/types.ts`

Only call site of `getSteps()` is `onboarding-flow.tsx:30` — confirmed by grep. No other files need updating for the signature change.

- [ ] **Step 1: Open `apps/web/components/onboarding/types.ts` and replace it entirely**

```typescript
export type Goal = "race"
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
  timeGoal?: boolean
  goalTime?: { hours: number; minutes: number }
  selectedDays?: Day[]
  longRunDay?: Day
  units?: Units
  strengthTraining?: boolean
  strengthDays?: Day[]
  manualRaceEntry?: boolean
}

export interface StepProps {
  formData: OnboardingData
  onNext: (data: Partial<OnboardingData>) => void
  onBack: () => void
}

export function getSteps(timeGoal?: boolean, strengthTraining?: boolean, hasRace?: boolean): readonly string[] {
  const base = [
    ...(hasRace ? [] : ["findRace"]),
    "timeGoal",
    ...(timeGoal === true ? ["goalTime"] : []),
    "whichDays",
    "longRunDay",
    "units",
    "strength",
  ]
  if (strengthTraining === true) return [...base, "strengthDays"]
  return base
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: errors only in `onboarding-flow.tsx` (still passes old args to `getSteps`) and possibly `step-goal.tsx`. That is fine — they will be fixed in the next tasks.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/onboarding/types.ts
git commit -m "refactor: simplify onboarding types to race-only, update getSteps signature"
```

---

### Task 2: Add `initialMode` prop to `StepFindRace`

**Files:**
- Modify: `apps/web/components/onboarding/steps/step-find-race.tsx:42-43`

The only change is the component signature — add `initialMode?: "search" | "manual"` and use it as the initial value for the `mode` state.

- [ ] **Step 1: Update the component signature and `mode` state initialiser**

Find this in `step-find-race.tsx`:

```typescript
export function StepFindRace({ formData, onNext }: Pick<StepProps, "formData" | "onNext">) {
  const [mode, setMode] = useState<Mode>("search")
```

Replace with:

```typescript
export function StepFindRace({ formData, onNext, initialMode }: Pick<StepProps, "formData" | "onNext"> & { initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode ?? "search")
```

No other changes to this file.

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: same errors as before (onboarding-flow.tsx still broken) — no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/onboarding/steps/step-find-race.tsx
git commit -m "feat: add initialMode prop to StepFindRace"
```

---

### Task 3: Update `OnboardingFlow` — accept `initialData`, fix `getSteps()` call, remove `StepGoal`

**Files:**
- Modify: `apps/web/components/onboarding/onboarding-flow.tsx`
- Delete: `apps/web/components/onboarding/steps/step-goal.tsx`

- [ ] **Step 1: Replace `onboarding-flow.tsx` entirely**

```typescript
"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronLeft, X } from "lucide-react"
import { OnboardingProgress } from "./onboarding-progress"
import { FinalScreen } from "./final-screen"
import { StepFindRace } from "./steps/step-find-race"
import { StepWhichDays } from "./steps/step-which-days"
import { StepLongRunDay } from "./steps/step-long-run-day"
import { StepUnits } from "./steps/step-units"
import { StepStrengthTraining } from "./steps/step-strength-training"
import { StepStrengthDays } from "./steps/step-strength-days"
import { StepTimeGoal } from "./steps/step-time-goal"
import { StepGoalTime } from "./steps/step-goal-time"
import { getSteps, type OnboardingData } from "./types"

const slideVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction > 0 ? -60 : 60, opacity: 0 }),
}

interface OnboardingFlowProps {
  onExit: () => void
  initialData?: Partial<OnboardingData>
}

export function OnboardingFlow({ onExit, initialData }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [direction, setDirection] = useState<1 | -1>(1)
  const [formData, setFormData] = useState<OnboardingData>(initialData ?? {})

  const steps = getSteps(formData.timeGoal, formData.strengthTraining, !!formData.race)
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

    // timeGoal change to false: clear goal time
    if ("timeGoal" in data && data.timeGoal === false) {
      merged = { ...merged, goalTime: undefined }
    }

    // strengthTraining change to false: clear strength days
    if ("strengthTraining" in data && data.strengthTraining === false) {
      merged = { ...merged, strengthDays: undefined }
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
      case "findRace":  return <StepFindRace {...stepProps} initialMode={formData.manualRaceEntry ? "manual" : "search"} />
      case "timeGoal":  return <StepTimeGoal {...stepProps} />
      case "goalTime":  return <StepGoalTime {...stepProps} />
      case "whichDays": return <StepWhichDays {...stepProps} />
      case "longRunDay":    return <StepLongRunDay {...stepProps} />
      case "units":         return <StepUnits {...stepProps} />
      case "strength":      return <StepStrengthTraining {...stepProps} />
      case "strengthDays":  return <StepStrengthDays {...stepProps} />
      default:              return null
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-10 sm:px-6 sm:py-14">
      <div className="mb-8 flex items-center gap-4">
        {currentStep > 0 ? (
          <button
            onClick={goBack}
            aria-label="Go back"
            className="flex shrink-0 cursor-pointer items-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : (
          <div className="shrink-0 w-5" />
        )}

        <div className="flex-1 px-4">
          <OnboardingProgress currentStep={currentStep} totalSteps={steps.length} />
        </div>

        <button
          onClick={onExit}
          className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Exit"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

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

- [ ] **Step 2: Delete `step-goal.tsx`**

```bash
rm apps/web/components/onboarding/steps/step-goal.tsx
```

- [ ] **Step 3: Run typecheck — expect clean**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/onboarding/onboarding-flow.tsx
git rm apps/web/components/onboarding/steps/step-goal.tsx
git commit -m "feat: add initialData to OnboardingFlow, remove StepGoal, fix getSteps call"
```

---

## Chunk 2: Landing page rewrite

### Task 4: Rewrite `apps/web/app/page.tsx` — aurora background + race search hero

**Files:**
- Modify: `apps/web/app/page.tsx` (full rewrite)

The bloom CSS `@keyframes` are injected via an inline `<style>` tag directly in the JSX — this is valid in React 19 and keeps the animation CSS co-located with the only component that uses it.

- [ ] **Step 1: Replace `apps/web/app/page.tsx` entirely**

```typescript
"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, Loader2 } from "lucide-react"
import { format, parseISO } from "date-fns"
import { authClient } from "@/lib/auth-client"
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow"
import { SignInSheet } from "@/app/plan/sign-in-sheet"
import { RACES, type Race } from "@/data/races"
import { DISTANCE_LABELS, type OnboardingData, type RaceData } from "@/components/onboarding/types"

export default function Page() {
  const router = useRouter()
  const { data: sessionData, isPending } = authClient.useSession()
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showSignIn, setShowSignIn] = useState(false)
  const [initialData, setInitialData] = useState<Partial<OnboardingData> | undefined>()
  const [query, setQuery] = useState("")
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isPending && sessionData?.session) {
      router.replace("/dashboard")
    }
  }, [isPending, sessionData?.session, router])

  // Close dropdown on outside click
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleMouseDown)
    return () => document.removeEventListener("mousedown", handleMouseDown)
  }, [])

  if (isPending || sessionData?.session) {
    return (
      <main style={{ display: "flex", minHeight: "100svh", alignItems: "center", justifyContent: "center", background: "#020208" }}>
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "rgba(255,255,255,0.3)" }} />
      </main>
    )
  }

  if (showOnboarding) {
    return (
      <main className="min-h-svh">
        <OnboardingFlow onExit={() => setShowOnboarding(false)} initialData={initialData} />
      </main>
    )
  }

  const filtered =
    query.trim() === ""
      ? RACES
      : RACES.filter((r) => {
          const q = query.toLowerCase()
          return (
            r.name.toLowerCase().includes(q) ||
            r.city.toLowerCase().includes(q) ||
            r.province.toLowerCase().includes(q)
          )
        })

  function handleRaceSelect(race: Race) {
    const raceData: RaceData = {
      name: race.name,
      city: `${race.city}, ${race.province}`,
      date: parseISO(race.date),
      distance: race.distance,
    }
    setInitialData({ goal: "race", race: raceData })
    setShowOnboarding(true)
  }

  function handleManualEntry() {
    setInitialData({ goal: "race", manualRaceEntry: true })
    setShowOnboarding(true)
  }

  const isOpen = dropdownOpen || query.trim() !== ""

  return (
    <>
      <style>{`
        @keyframes bloom-1 {
          0%   { transform: translate(0%, 0%) scale(1) rotate(0deg); }
          33%  { transform: translate(6%, 8%) scale(1.15) rotate(15deg); }
          66%  { transform: translate(-4%, 3%) scale(0.95) rotate(-8deg); }
          100% { transform: translate(0%, 0%) scale(1) rotate(0deg); }
        }
        @keyframes bloom-2 {
          0%   { transform: translate(0%, 0%) scale(1) rotate(0deg); }
          40%  { transform: translate(-8%, -5%) scale(1.1) rotate(-20deg); }
          70%  { transform: translate(5%, 6%) scale(1.05) rotate(10deg); }
          100% { transform: translate(0%, 0%) scale(1) rotate(0deg); }
        }
        @keyframes bloom-3 {
          0%   { transform: translate(0%, 0%) scale(1); }
          50%  { transform: translate(4%, -6%) scale(1.08); }
          100% { transform: translate(0%, 0%) scale(1); }
        }
      `}</style>

      <main style={{ position: "relative", width: "100vw", height: "100svh", overflow: "hidden", background: "#020208" }}>

        {/* Dot grid */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage:
            "linear-gradient(rgba(80,100,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(80,100,255,0.05) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />

        {/* Aurora blooms */}
        <div style={{
          position: "absolute", borderRadius: "50%", filter: "blur(80px)", pointerEvents: "none",
          width: "70vw", height: "60vh", top: "-15vh", left: "-10vw",
          background: "radial-gradient(ellipse, rgba(30,55,200,0.22) 0%, transparent 70%)",
          animation: "bloom-1 28s ease-in-out infinite alternate",
        }} />
        <div style={{
          position: "absolute", borderRadius: "50%", filter: "blur(80px)", pointerEvents: "none",
          width: "60vw", height: "55vh", bottom: "-10vh", right: "-5vw",
          background: "radial-gradient(ellipse, rgba(15,80,180,0.18) 0%, transparent 70%)",
          animation: "bloom-2 34s ease-in-out infinite alternate",
        }} />
        <div style={{
          position: "absolute", borderRadius: "50%", filter: "blur(80px)", pointerEvents: "none",
          width: "50vw", height: "45vh", top: "20vh", left: "25vw",
          background: "radial-gradient(ellipse, rgba(40,40,160,0.12) 0%, transparent 65%)",
          animation: "bloom-3 22s ease-in-out infinite alternate",
        }} />

        {/* Vignette */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse 75% 75% at 50% 48%, transparent 20%, rgba(1,1,8,0.7) 100%)",
        }} />

        {/* Nav */}
        <nav style={{
          position: "absolute", top: 0, left: 0, right: 0,
          padding: "24px 36px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          zIndex: 10,
        }}>
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.85)" }}>
            ATHLORYX
          </span>
          <button
            onClick={() => setShowSignIn(true)}
            style={{
              fontSize: 13, color: "rgba(255,255,255,0.38)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8, padding: "7px 18px",
              background: "none", cursor: "pointer",
            }}
          >
            Log in
          </button>
        </nav>

        {/* Hero */}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 24, zIndex: 5,
          textAlign: "center", padding: "0 24px",
        }}>
          <h1 style={{
            fontSize: "clamp(40px, 6vw, 64px)",
            fontWeight: 700, color: "#fff",
            letterSpacing: "-0.04em", lineHeight: 1.0, margin: 0,
          }}>
            When&apos;s your<br />next race?
          </h1>

          {/* Search widget */}
          <div ref={wrapRef} style={{ position: "relative", width: "100%", maxWidth: 480 }}>

            {/* Input box */}
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              height: 56, padding: "0 18px",
              background: "rgba(255,255,255,0.05)",
              border: `1px solid ${isOpen ? "rgba(100,140,255,0.35)" : "rgba(255,255,255,0.12)"}`,
              borderRadius: isOpen ? "14px 14px 0 0" : 14,
              backdropFilter: "blur(12px)",
            }}>
              <Search style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0, width: 16, height: 16 }} />
              <input
                placeholder="Search races by name or city…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setDropdownOpen(true)}
                style={{
                  flex: 1, background: "none", border: "none", outline: "none",
                  fontSize: 15, color: "rgba(255,255,255,0.85)",
                  fontFamily: "inherit", letterSpacing: "0.01em",
                }}
              />
            </div>

            {/* Dropdown */}
            {isOpen && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20,
                background: "rgba(8,8,20,0.95)",
                border: "1px solid rgba(100,140,255,0.25)",
                borderTop: "none",
                borderBottomLeftRadius: 14,
                borderBottomRightRadius: 14,
                backdropFilter: "blur(20px)",
                overflow: "hidden",
              }}>
                <div style={{ maxHeight: 320, overflowY: "auto" }}>
                  {filtered.length > 0 ? (
                    filtered.map((race) => (
                      <DropdownRaceRow key={race.id} race={race} onSelect={handleRaceSelect} />
                    ))
                  ) : (
                    <div style={{ padding: "12px 18px", fontSize: 13, color: "rgba(255,255,255,0.32)" }}>
                      No races found for &ldquo;{query}&rdquo;
                    </div>
                  )}
                </div>
                <ManualEntryFooter onSelect={handleManualEntry} />
              </div>
            )}
          </div>
        </div>

        {showSignIn && (
          <SignInSheet
            onBeforeSignIn={() => {}}
            onClose={() => setShowSignIn(false)}
            callbackURL="/dashboard"
          />
        )}
      </main>
    </>
  )
}

function ManualEntryFooter({ onSelect }: { onSelect: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      role="button"
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "10px 18px", fontSize: 11,
        color: hovered ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.2)",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        textAlign: "center", cursor: "pointer",
      }}
    >
      Don&apos;t see yours? Add it manually →
    </div>
  )
}

function DropdownRaceRow({ race, onSelect }: { race: Race; onSelect: (r: Race) => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      role="button"
      onClick={() => onSelect(race)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "12px 18px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        cursor: "pointer",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        background: hovered ? "rgba(80,120,255,0.08)" : "transparent",
      }}
    >
      <div style={{ textAlign: "left" }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.82)" }}>
          {race.name}
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", marginTop: 2 }}>
          {race.city}, {race.province} · {format(parseISO(race.date), "MMM d, yyyy")}
        </div>
      </div>
      <span style={{
        fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
        color: "rgba(100,150,255,0.7)",
        background: "rgba(80,120,255,0.1)",
        border: "1px solid rgba(80,120,255,0.18)",
        borderRadius: 4, padding: "2px 7px",
        flexShrink: 0, marginLeft: 16,
      }}>
        {DISTANCE_LABELS[race.distance]}
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck — expect clean**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Smoke test in browser**

```bash
pnpm dev
```

Open `http://localhost:3000`. Verify:
- Aurora blooms animate slowly in the background (check after ~5s)
- Dot grid is visible
- "ATHLORYX" appears top-left, "Log in" appears top-right
- "When's your next race?" headline is centered
- Search input renders — clicking it opens the dropdown with the full race list
- Typing "Boston" filters to Boston races
- Hovering a race row highlights it
- Clicking a race row closes the landing page and opens onboarding at "What's your time goal?" (Step 2, skipping race selection)
- Clicking "Don't see yours? Add it manually →" opens onboarding at `StepFindRace` in manual mode (form fields visible immediately, not the search list)
- Clicking "Log in" opens the sign-in sheet
- Clicking outside the dropdown closes it
- Old "Create a Plan" button is gone

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/page.tsx
git commit -m "feat: redesign landing page with aurora background and embedded race search"
```
