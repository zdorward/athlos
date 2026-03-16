# Landing Page Plan Preview — Responsive & Dynamic Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static, hardcoded plan preview on the landing page with a dynamic, responsive mock that shows a calendar grid on desktop and a workout list on mobile.

**Architecture:** All changes are confined to `apps/web/app/page.tsx`. The static `MOCK_WEEKS` constant is replaced with a `WEEK_TEMPLATES` constant plus a `buildMockWeeks()` function that computes real dates at render time via `useMemo`. Two sibling divs (`.mock-plan-desktop` / `.mock-plan-mobile`) render the appropriate layout, toggled by a CSS media query added to the existing `<style>` block.

**Tech Stack:** React 19, Next.js 16 App Router, TypeScript, inline styles + CSS media query

---

## Chunk 1: Full implementation

### Task 1: Update types, data, and date logic

**Files:**
- Modify: `apps/web/app/page.tsx` (lines ~1–56 and ~186–230)

This task updates the module-level type and data definitions and wires up dynamic date computation. No JSX changes yet.

- [ ] **Step 1: Add `useMemo` to the React import**

Find line 3 in `apps/web/app/page.tsx`:
```ts
import { Suspense, useEffect, useRef, useState } from "react"
```
Replace with:
```ts
import { Suspense, useEffect, useMemo, useRef, useState } from "react"
```

- [ ] **Step 2: Replace `WorkoutType`, `WorkoutStyle`, and `WORKOUT_STYLES`**

Find and replace lines 32–47 (the `WorkoutType`, `WorkoutStyle`, and `WORKOUT_STYLES` block):

```ts
type WorkoutType = "easy" | "tempo" | "long" | "strength" | "rest" | "medium-long" | "intervals"

// ── Plan preview color system ─────────────────────────────────────────────
type WorkoutStyle = { color: string; bg?: string; border?: string }

const WORKOUT_STYLES: Record<WorkoutType, WorkoutStyle | null> = {
  easy:           { color: "rgba(255,255,255,0.55)" },
  tempo:          { color: "oklch(0.78 0.15 80 / 0.9)" },
  long:           { color: "rgba(147,197,253,0.85)", bg: "rgba(80,130,255,0.07)", border: "rgba(100,160,255,0.2)" },
  strength:       { color: "oklch(0.65 0.15 300 / 0.85)" },
  rest:           null,
  "medium-long":  { color: "rgba(120,200,255,0.80)" },
  intervals:      { color: "oklch(0.72 0.18 40 / 0.90)" },
}
```

- [ ] **Step 3: Replace `MockDay` type and all module-level mock data**

Find and replace lines 49–174 (the `MockDay` type through the end of `MOCK_WEEKS`):

```ts
type MockDay = {
  dayLabel: string   // "Mon", "Tue", etc. — filled in by buildMockWeeks()
  date: number       // day-of-month — filled in by buildMockWeeks()
  type: WorkoutType
  title: string      // full name, e.g. "Easy Run", "Rest Day"
  km: string         // "10 km", or "" for strength/rest
  desc: string       // subtitle for mobile list
}

const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

const WEEK_TEMPLATES: Array<{
  phase: string | null
  km: string
  days: Array<Pick<MockDay, "type" | "title" | "km" | "desc">>
}> = [
  {
    phase: "Base",
    km: "72 km",
    days: [
      { type: "easy",         title: "Easy Run",     km: "10 km", desc: "Easy aerobic run." },
      { type: "strength",     title: "Strength",     km: "",      desc: "Strength training." },
      { type: "easy",         title: "Easy Run",     km: "12 km", desc: "Easy aerobic run." },
      { type: "medium-long",  title: "Medium-Long",  km: "16 km", desc: "16 km medium-long run." },
      { type: "easy",         title: "Easy Run",     km: "10 km", desc: "Easy run with strides." },
      { type: "rest",         title: "Rest Day",     km: "",      desc: "" },
      { type: "long",         title: "Long Run",     km: "24 km", desc: "24 km long run at easy pace." },
    ],
  },
  {
    phase: null,
    km: "90 km",
    days: [
      { type: "easy",         title: "Easy Run",     km: "12 km", desc: "Easy recovery run." },
      { type: "intervals",    title: "Intervals",    km: "14 km", desc: "6 × 1 km at 5K pace." },
      { type: "strength",     title: "Strength",     km: "",      desc: "Strength training." },
      { type: "medium-long",  title: "Medium-Long",  km: "18 km", desc: "18 km medium-long run." },
      { type: "easy",         title: "Easy Run",     km: "10 km", desc: "Easy recovery run." },
      { type: "easy",         title: "Easy Run",     km: "8 km",  desc: "Easy shakeout run." },
      { type: "long",         title: "Long Run",     km: "28 km", desc: "28 km long run — last 8 km at marathon pace." },
    ],
  },
]

function buildMockWeeks() {
  const today = new Date()
  const day = today.getDay()                                    // 0 = Sun, 1 = Mon
  const daysToMonday = day === 1 ? 0 : day === 0 ? 1 : 8 - day
  const monday = new Date(today)
  monday.setDate(today.getDate() + daysToMonday)
  monday.setHours(0, 0, 0, 0)

  return WEEK_TEMPLATES.map((template, wi) => {
    const weekStart = new Date(monday)
    weekStart.setDate(monday.getDate() + wi * 7)
    const dateLabel = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    return {
      label: `W${wi + 1}`,
      dateLabel,
      km: template.km,
      phase: template.phase,
      days: template.days.map((d, i) => {
        const date = new Date(weekStart)
        date.setDate(weekStart.getDate() + i)
        return { ...d, date: date.getDate(), dayLabel: DAY_SHORT[i] }
      }),
    }
  })
}
```

- [ ] **Step 4: Call `buildMockWeeks` via `useMemo` inside `PageContent`**

Inside the `PageContent` function body, after the existing `useState` declarations (around line 196), add:

```ts
const mockWeeks = useMemo(buildMockWeeks, [])
```

- [ ] **Step 5: Run typecheck — expect no errors**

```bash
pnpm typecheck
```

Expected: exits cleanly with no TypeScript errors. If there are errors, fix them before continuing.

---

### Task 2: Replace plan preview JSX with responsive layout

**Files:**
- Modify: `apps/web/app/page.tsx` (plan preview section ~lines 571–924)

This task replaces the hardcoded calendar JSX with two responsive sibling divs and adds the CSS toggle to the `<style>` block.

- [ ] **Step 1: Add responsive CSS to the `<style>` block**

Inside `PageContent`'s return, find the existing `<style>` block that contains `@keyframes bloom-1`, `@keyframes bloom-2`, `@keyframes bloom-3`. Append the following CSS inside it (before the closing backtick):

```css
.mock-plan-desktop { display: block }
.mock-plan-mobile  { display: none  }
@media (max-width: 639px) {
  .mock-plan-desktop { display: none  }
  .mock-plan-mobile  { display: block }
}
```

- [ ] **Step 2: Replace the plan preview calendar content**

Inside the plan preview `<section>` (the one with `"Every week, mapped out."` heading), find the `{/* Calendar */}` div — it currently contains the day-of-week header and `MOCK_WEEKS.map(...)`. Replace everything inside that outer div (keep the outer div with `padding: "0 16px 16px"` and `overflowX: "auto"`) with the following two sibling elements:

```tsx
{/* Desktop grid */}
<div className="mock-plan-desktop">
  {/* Day-of-week header row */}
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "52px repeat(7, 1fr)",
      gap: 3,
      padding: "8px 0 4px",
    }}
  >
    <div />
    {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((d) => (
      <div
        key={d}
        style={{
          textAlign: "center",
          fontSize: 8,
          fontWeight: 600,
          textTransform: "uppercase" as const,
          letterSpacing: "0.1em",
          color: "rgba(255,255,255,0.25)",
        }}
      >
        {d}
      </div>
    ))}
  </div>

  {mockWeeks.map((week, wi) => (
    <div key={wi}>
      {/* Phase label — only when non-null */}
      {week.phase && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "52px 1fr",
            gap: 3,
            padding: "4px 0 2px",
          }}
        >
          <div />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontSize: 7,
                fontWeight: 700,
                textTransform: "uppercase" as const,
                letterSpacing: "0.12em",
                color: "rgba(255,255,255,0.25)",
                whiteSpace: "nowrap" as const,
              }}
            >
              {week.phase}
            </span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
          </div>
        </div>
      )}

      {/* Week row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "52px repeat(7, 1fr)",
          gap: 3,
          marginBottom: 3,
        }}
      >
        {/* Week label */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            paddingRight: 4,
          }}
        >
          <p style={{ fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,0.35)", margin: 0 }}>
            {week.label}
          </p>
          <p style={{ fontSize: 7, color: "rgba(255,255,255,0.2)", margin: "1px 0 0" }}>
            {week.dateLabel}
          </p>
          <p style={{ fontSize: 7, fontWeight: 600, color: "rgba(255,255,255,0.35)", margin: "1px 0 0" }}>
            {week.km}
          </p>
        </div>

        {/* Day cells */}
        {week.days.map((d) => {
          const s = WORKOUT_STYLES[d.type]
          const isRest = d.type === "rest"
          return (
            <div
              key={d.dayLabel}
              style={{
                minHeight: 60,
                borderRadius: 4,
                border: `1px solid ${s?.border ?? (isRest ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.08)")}`,
                background: s?.bg ?? (isRest ? "rgba(255,255,255,0.01)" : "rgba(255,255,255,0.03)"),
                padding: "4px 5px",
                opacity: isRest ? 0.4 : 1,
              }}
            >
              <p style={{ fontSize: 7, color: "rgba(255,255,255,0.22)", margin: "0 0 2px" }}>
                {d.date}
              </p>
              <p
                style={{
                  fontSize: 7,
                  fontWeight: 600,
                  color: s?.color ?? "rgba(255,255,255,0.35)",
                  margin: 0,
                }}
              >
                {d.title}
              </p>
              {d.km && (
                <p style={{ fontSize: 6, color: "rgba(255,255,255,0.25)", margin: "1px 0 0" }}>
                  {d.km}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  ))}

  {/* Fade-out hint */}
  <div
    style={{
      marginTop: 8,
      height: 36,
      background: "linear-gradient(to bottom, transparent, #0d1117)",
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "center",
      paddingBottom: 4,
    }}
  >
    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.15)" }}>16 weeks total</span>
  </div>
</div>

{/* Mobile list */}
<div className="mock-plan-mobile">
  {mockWeeks.map((week, wi) => (
    <div key={wi}>
      {/* Week header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 0 8px",
        }}
      >
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.85)", margin: 0 }}>
            {week.label}{week.phase ? ` — ${week.phase}` : ""}
          </p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", margin: "2px 0 0" }}>
            {week.dateLabel}
          </p>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "rgba(255,255,255,0.5)",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 20,
            padding: "3px 10px",
            flexShrink: 0,
          }}
        >
          {week.km}
        </span>
      </div>

      {/* Day cards */}
      {week.days.map((d) => {
        const s = WORKOUT_STYLES[d.type]
        const isRest = d.type === "rest"
        return (
          <div
            key={d.dayLabel}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "9px 0",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
              opacity: isRest ? 0.4 : 1,
            }}
          >
            {/* Colored left bar */}
            <div
              style={{
                width: 3,
                alignSelf: "stretch",
                borderRadius: 2,
                background: isRest ? "rgba(255,255,255,0.12)" : (s?.color ?? "rgba(255,255,255,0.3)"),
                marginRight: 12,
                flexShrink: 0,
                minHeight: 36,
              }}
            />
            {/* Date + day */}
            <div style={{ width: 36, flexShrink: 0 }}>
              <p
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.85)",
                  margin: 0,
                  lineHeight: 1,
                }}
              >
                {d.date}
              </p>
              <p
                style={{
                  fontSize: 9,
                  color: "rgba(255,255,255,0.3)",
                  margin: "2px 0 0",
                  textTransform: "uppercase" as const,
                  letterSpacing: "0.05em",
                }}
              >
                {d.dayLabel}
              </p>
            </div>
            {/* Title + desc */}
            <div style={{ flex: 1 }}>
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: isRest ? "rgba(255,255,255,0.35)" : (s?.color ?? "rgba(255,255,255,0.55)"),
                  margin: 0,
                }}
              >
                {d.title}
              </p>
              {d.desc && (
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", margin: "2px 0 0" }}>
                  {d.desc}
                </p>
              )}
            </div>
            {/* km */}
            {d.km && (
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: s?.color ?? "rgba(255,255,255,0.4)",
                  margin: 0,
                  flexShrink: 0,
                  marginLeft: 8,
                }}
              >
                {d.km}
              </p>
            )}
          </div>
        )
      })}
    </div>
  ))}

  {/* Fade-out */}
  <div
    style={{
      height: 28,
      background: "linear-gradient(to bottom, transparent, #0d1117)",
      marginTop: 4,
    }}
  />
</div>
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors. If you see errors about `mockWeeks` or `MockDay` shape mismatches, verify that `buildMockWeeks` return type matches what the JSX expects.

- [ ] **Step 4: Start dev server and visually verify**

```bash
pnpm dev
```

Open `http://localhost:3000` in a browser.

- On desktop (window ≥640px): scroll past the hero to the "Every week, mapped out." section. Verify the calendar grid shows with MON–SUN columns, full workout names ("Easy Run", "Strength", "Medium-Long", "Long Run", "Rest Day"), dynamic dates starting from the next Monday, and the "Base" phase label above week 1.
- On mobile (or devtools <640px): verify the section switches to vertical list cards with colored left bars, full names, descriptions, and km right-aligned. Rest Day shows dimmed with "Rest Day" label and no km.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/page.tsx
git commit -m "feat: responsive dynamic plan preview on landing page"
```
