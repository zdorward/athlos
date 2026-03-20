# Add Race Manually — UI Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix mobile calendar height jump, replace distance dropdown with a segmented control, and make the landing-page sheet responsive (bottom drawer on mobile, centered dialog on desktop).

**Architecture:** Add a `useMediaQuery` hook, then apply it in `ManualRaceSheet` to swap the outer shell between a bottom-sheet and a shadcn `Dialog`. Field improvements (inline calendar with `fixedWeeks`, segmented distance control) are applied identically to both `ManualRaceSheet` and the onboarding `ManualRaceForm`.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, shadcn/ui (`Dialog`, `Calendar`), react-day-picker (`fixedWeeks` prop)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/web/hooks/use-media-query.ts` | Create | SSR-safe hook that returns whether a CSS media query matches |
| `apps/web/app/manual-race-sheet.tsx` | Modify | Responsive container (sheet on mobile, Dialog on desktop) + field improvements |
| `apps/web/components/onboarding/steps/step-find-race.tsx` | Modify | Field improvements to `ManualRaceForm` only (inline calendar, segmented distance) |

---

### Task 1: Create `useMediaQuery` hook

**Files:**
- Create: `apps/web/hooks/use-media-query.ts`

- [ ] **Step 1: Create the hook**

```ts
"use client"

import { useEffect, useState } from "react"

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const media = window.matchMedia(query)
    setMatches(media.matches)
    const listener = () => setMatches(media.matches)
    media.addEventListener("change", listener)
    return () => media.removeEventListener("change", listener)
  }, [query])

  return matches
}
```

Note: `useState(false)` as the SSR default ensures no hydration mismatch — the effect runs only in the browser.

- [ ] **Step 2: Commit**

```bash
git add apps/web/hooks/use-media-query.ts
git commit -m "feat: add useMediaQuery hook"
```

---

### Task 2: Improve `ManualRaceSheet` (landing page)

**Files:**
- Modify: `apps/web/app/manual-race-sheet.tsx`

The component has two concerns: the outer shell (how it's presented) and the form fields. Replace both.

- [ ] **Step 1: Rewrite the file**

Replace the entire file contents with:

```tsx
"use client"

import { useState } from "react"
import { format } from "date-fns"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Calendar } from "@workspace/ui/components/calendar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@workspace/ui/components/dialog"
import { cn } from "@workspace/ui/lib/utils"
import {
  DISTANCE_LABELS,
  type Distance,
  type RaceData,
} from "@/components/onboarding/types"
import { useMediaQuery } from "@/hooks/use-media-query"

export function ManualRaceSheet({
  onClose,
  onSubmit,
}: {
  onClose: () => void
  onSubmit: (race: RaceData) => void
}) {
  const isDesktop = useMediaQuery("(min-width: 768px)")

  const fields = <ManualRaceFormFields onClose={onClose} onSubmit={onSubmit} />

  if (isDesktop) {
    return (
      <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
        <DialogContent className="max-w-sm" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Add your race</DialogTitle>
            <DialogDescription>
              Can&apos;t find it in the list? Enter the details manually.
            </DialogDescription>
          </DialogHeader>
          {fields}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="w-full space-y-5 rounded-t-xl border-t border-border bg-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-border" />
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Add your race</h2>
          <p className="text-sm text-muted-foreground">
            Can&apos;t find it in the list? Enter the details manually.
          </p>
        </div>
        {fields}
      </div>
    </div>
  )
}

function ManualRaceFormFields({
  onClose,
  onSubmit,
}: {
  onClose: () => void
  onSubmit: (race: RaceData) => void
}) {
  const [name, setName] = useState("")
  const [city, setCity] = useState("")
  const [date, setDate] = useState<Date | undefined>(undefined)
  const [distance, setDistance] = useState<Distance>("full")

  const isValid =
    name.trim() !== "" &&
    city.trim() !== "" &&
    date !== undefined

  function handleSubmit() {
    if (!isValid || !date) return
    onSubmit({ name: name.trim(), city: city.trim(), date, distance })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="manual-race-name">Race name</Label>
        <Input
          id="manual-race-name"
          placeholder="e.g. Boston Marathon"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="manual-race-city">City</Label>
        <Input
          id="manual-race-city"
          placeholder="e.g. Boston, MA"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Distance</Label>
        <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border">
          {(Object.entries(DISTANCE_LABELS) as [Distance, string][]).map(
            ([value, label], i) => (
              <button
                key={value}
                type="button"
                onClick={() => setDistance(value)}
                className={cn(
                  "py-2 text-sm font-medium transition-colors",
                  i > 0 && "border-l border-border",
                  distance === value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            )
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Race date</Label>
        <div className="rounded-lg border border-border">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            disabled={(d) => d <= new Date()}
            fixedWeeks
            initialFocus
          />
        </div>
      </div>
      <Button onClick={handleSubmit} disabled={!isValid} className="w-full">
        Continue
      </Button>
    </div>
  )
}
```

**Key points:**
- `distance` now defaults to `"full"` — no longer requires selection to be valid
- `isValid` no longer checks `distance !== undefined` since it always has a value
- `fixedWeeks` on `Calendar` eliminates the height jump between months
- Segmented control iterates `DISTANCE_LABELS` so it stays in sync if distances are ever added
- On desktop, `Dialog` is opened imperatively (`open` always true); `onOpenChange` calls `onClose` when Radix closes it (Escape key, overlay click)

- [ ] **Step 2: Start dev server and verify visually**

```bash
pnpm dev
```

Open the landing page. Trigger "Add manually":
- **Mobile viewport (< 768px):** Bottom sheet appears with drag handle, inline calendar, segmented control defaulting to Full
- **Desktop viewport (≥ 768px):** Centered dialog appears, same form
- Navigate calendar months — confirm sheet/dialog does not jump in height
- Select Half, confirm segment highlights; select Full, confirm it switches back
- Submit with all fields filled — confirm it proceeds correctly

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/manual-race-sheet.tsx
git commit -m "feat: responsive ManualRaceSheet with inline calendar and segmented distance"
```

---

### Task 3: Improve `ManualRaceForm` in onboarding

**Files:**
- Modify: `apps/web/components/onboarding/steps/step-find-race.tsx`

Only `ManualRaceForm` (the inner component) changes. `StepFindRace` and the search UI are untouched.

- [ ] **Step 1: Replace `ManualRaceForm`**

Locate the `ManualRaceForm` function by name and replace it entirely with:

```tsx
function ManualRaceForm({
  onBack,
  onSubmit,
}: {
  onBack: () => void
  onSubmit: (race: RaceData) => void
}) {
  const [name, setName] = useState("")
  const [city, setCity] = useState("")
  const [date, setDate] = useState<Date | undefined>()
  const [distance, setDistance] = useState<Distance>("full")

  const isValid = name.trim() !== "" && city.trim() !== "" && date !== undefined

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Add your race</h2>
        <p className="text-sm text-muted-foreground">
          Can&apos;t find it in the list? Enter the details.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="race-name">Race name</Label>
          <Input
            id="race-name"
            placeholder="e.g. Boston Marathon"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
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
          <Label>Distance</Label>
          <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border">
            {(Object.entries(DISTANCE_LABELS) as [Distance, string][]).map(
              ([value, label], i) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDistance(value as Distance)}
                  className={cn(
                    "py-2 text-sm font-medium transition-colors",
                    i > 0 && "border-l border-border",
                    distance === value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              )
            )}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Race date</Label>
          <div className="rounded-lg border border-border">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              disabled={(d) => d <= new Date()}
              fixedWeeks
              initialFocus
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <Button
          onClick={() => {
            if (isValid && date) onSubmit({ name: name.trim(), city: city.trim(), date, distance })
          }}
          disabled={!isValid}
          className="w-full"
        >
          Continue
        </Button>
        <div className="text-center">
          <button
            onClick={onBack}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            ← Back to search
          </button>
        </div>
      </div>
    </div>
  )
}
```

Also remove the now-unused imports from the top of the file:
- Remove `{ CalendarIcon }` from `"lucide-react"`
- Remove `Popover, PopoverContent, PopoverTrigger` from `"@workspace/ui/components/popover"`
- Remove `Select, SelectContent, SelectItem, SelectTrigger, SelectValue` from `"@workspace/ui/components/select"`
- Add `Calendar` import: `import { Calendar } from "@workspace/ui/components/calendar"`

- [ ] **Step 2: Verify imports compile**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Verify visually**

Go through the onboarding flow to the "Which race are you training for?" step. Click "Don't see yours? Add it manually →":
- Confirm segmented control appears with Full pre-selected
- Confirm inline calendar renders without a trigger button
- Navigate calendar months — confirm page does not jump
- Submit — confirm it proceeds to the next step

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/onboarding/steps/step-find-race.tsx
git commit -m "feat: inline calendar and segmented distance in onboarding ManualRaceForm"
```
