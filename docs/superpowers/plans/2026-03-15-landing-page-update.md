# Landing Page Update Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the landing page plan preview to look like the real app, replace AI-sounding feature blocks with a "How it works" section, and replace the fake social proof with a founder note.

**Architecture:** All changes are confined to `apps/web/app/page.tsx`. The `TYPE_STYLES` constant is replaced with real app colors sourced from `workout-utils.ts`. The `MOCK_WEEKS` data is updated with realistic dates and phase info. Three JSX sections are updated in place.

**Tech Stack:** Next.js App Router, React, inline styles (existing pattern in this file)

---

## Chunk 1: All changes

### File Map

- Modify: `apps/web/app/page.tsx`
  - Update `TYPE_STYLES` color values to match `workout-utils.ts`
  - Update `MOCK_WEEKS` with realistic dates and phase label
  - Update plan preview section JSX (section 2) to match real app UI
  - Replace feature blocks section (section 3) with "How it works"
  - Replace social proof section (section 4) with founder note

---

### Task 1: Update TYPE_STYLES to match real app colors

The existing `TYPE_STYLES` record uses saturated rgba colors that don't match the real app. Replace with values from `workout-utils.ts`.

**Files:**
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Read the current TYPE_STYLES in page.tsx**

Open `apps/web/app/page.tsx` and locate the `TYPE_STYLES` constant (around line 36). Note the existing shape: `{ bg, border, label, dot }` per type.

- [ ] **Step 2: Replace TYPE_STYLES with real app colors**

Replace the entire `TYPE_STYLES` constant and its type with a simpler structure that only carries what the new mock needs — a text color and (for Long Run only) a subtle cell tint:

```tsx
// ── Plan preview color system (matches workout-utils.ts) ──────────────────
type WorkoutStyle = { color: string; bg?: string; border?: string }

const WORKOUT_STYLES: Record<WorkoutType, WorkoutStyle | null> = {
  easy:     { color: "rgba(255,255,255,0.55)" },
  tempo:    { color: "oklch(0.78 0.15 80 / 0.9)" },
  long:     { color: "rgba(147,197,253,0.85)", bg: "rgba(80,130,255,0.07)", border: "rgba(100,160,255,0.2)" },
  strength: { color: "oklch(0.65 0.15 300 / 0.85)" },
  rest:     null,
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/page.tsx
git commit -m "refactor: replace TYPE_STYLES with real app color values"
```

---

### Task 2: Update MOCK_WEEKS with realistic dates and phase info

**Files:**
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Replace MOCK_WEEKS**

Replace the existing `MOCK_WEEKS` constant with data that matches the real app structure — realistic dates, a phase label per week, and the correct workout mix:

```tsx
const MOCK_WEEKS = [
  {
    label: "W1", date: "Mar 16", km: "54 km", phase: "Base",
    days: [
      { day: "Mon", date: 16, type: "easy"     as WorkoutType, title: "Easy Run",  sub: "8 km" },
      { day: "Tue", date: 17, type: "strength" as WorkoutType, title: "Strength",  sub: "" },
      { day: "Wed", date: 18, type: "easy"     as WorkoutType, title: "Easy Run",  sub: "8 km" },
      { day: "Thu", date: 19, type: "easy"     as WorkoutType, title: "Easy Run",  sub: "6 km", extra: "strength" },
      { day: "Fri", date: 20, type: "easy"     as WorkoutType, title: "Easy Run",  sub: "8 km" },
      { day: "Sat", date: 21, type: "rest"     as WorkoutType, title: "",          sub: "" },
      { day: "Sun", date: 22, type: "long"     as WorkoutType, title: "Long Run",  sub: "12 km" },
    ],
  },
  {
    label: "W2", date: "Mar 23", km: "56 km", phase: null,
    days: [
      { day: "Mon", date: 23, type: "easy"     as WorkoutType, title: "Easy Run",  sub: "8 km" },
      { day: "Tue", date: 24, type: "strength" as WorkoutType, title: "Strength",  sub: "" },
      { day: "Wed", date: 25, type: "easy"     as WorkoutType, title: "Easy Run",  sub: "8 km" },
      { day: "Thu", date: 26, type: "tempo"    as WorkoutType, title: "Tempo Run", sub: "8 km" },
      { day: "Fri", date: 27, type: "easy"     as WorkoutType, title: "Easy Run",  sub: "8 km" },
      { day: "Sat", date: 28, type: "strength" as WorkoutType, title: "Strength",  sub: "" },
      { day: "Sun", date: 29, type: "long"     as WorkoutType, title: "Long Run",  sub: "14 km" },
    ],
  },
]
```

Note: `extra: "strength"` on Thu of W1 indicates a double day (run + strength). The JSX will render it as a small secondary label.

- [ ] **Step 2: Add MockDay type**

Add this type above `MOCK_WEEKS` so TypeScript doesn't error when `extra` is used in Task 3:

```tsx
type MockDay = {
  day: string
  date: number
  type: WorkoutType
  title: string
  sub: string
  extra?: string
}
```

Update `MOCK_WEEKS` type annotation to `Array<{ label: string; date: string; km: string; phase: string | null; days: MockDay[] }>` (or TypeScript will infer it — either is fine).

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/page.tsx
git commit -m "refactor: update mock weeks with realistic dates and phase label"
```

---

### Task 3: Update plan preview section JSX

This is the biggest visual change. The browser chrome stays; the interior is rebuilt to match the real `PlanCalendar` layout.

**Files:**
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Update browser chrome outer div background**

Find the outer browser chrome mockup `<div>` (around line 275, has `background: "rgba(255,255,255,0.02)"`). Update it to navy:

```tsx
<div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", background: "#0d1117" }}>
```

- [ ] **Step 2: Update plan header bar**

Find the "Plan header bar" comment block (around line 291). Update background and font sizes to match real app:

```tsx
{/* Plan header bar */}
<div style={{ padding: "12px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0d1117" }}>
  <div>
    <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>Toronto Waterfront Marathon</div>
    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>16 weeks · 42.2 km · Goal: 3:45</div>
  </div>
  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "5px 12px" }}>
    Save Plan
  </div>
</div>
```

- [ ] **Step 3: Replace calendar section with real app layout**

Find the "Calendar" comment block (around line 302). Replace the entire calendar `<div>` with the new layout that includes a day-header row, phase label row, and week rows:

```tsx
{/* Calendar */}
<div style={{ padding: "0 16px 16px", overflowX: "auto", background: "#0d1117" }}>

  {/* Day of week header */}
  <div style={{ display: "grid", gridTemplateColumns: "52px repeat(7, 1fr)", gap: 3, padding: "8px 0 4px" }}>
    <div />
    {["MON","TUE","WED","THU","FRI","SAT","SUN"].map((d) => (
      <div key={d} style={{ textAlign: "center", fontSize: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.25)" }}>{d}</div>
    ))}
  </div>

  {MOCK_WEEKS.map((week, wi) => (
    <div key={wi}>
      {/* Phase header — only shown when phase label is present */}
      {week.phase && (
        <div style={{ display: "grid", gridTemplateColumns: "52px 1fr", gap: 3, padding: "4px 0 2px" }}>
          <div />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.25)", whiteSpace: "nowrap" }}>{week.phase}</span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
          </div>
        </div>
      )}

      {/* Week row */}
      <div style={{ display: "grid", gridTemplateColumns: "52px repeat(7, 1fr)", gap: 3, marginBottom: 3 }}>
        {/* Week label */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", paddingRight: 4 }}>
          <p style={{ fontSize: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.25)", margin: 0 }}>{week.label}</p>
          <p style={{ fontSize: 8, color: "rgba(255,255,255,0.2)", margin: "1px 0 0" }}>{week.date}</p>
          <p style={{ fontSize: 8, fontWeight: 600, color: "rgba(255,255,255,0.35)", margin: "1px 0 0" }}>{week.km}</p>
        </div>

        {/* Day cells */}
        {week.days.map((d) => {
          const s = WORKOUT_STYLES[d.type]
          const isRest = d.type === "rest"
          return (
            <div
              key={d.day}
              style={{
                minHeight: 68,
                borderRadius: 5,
                border: `1px solid ${s?.border ?? (isRest ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.08)")}`,
                background: s?.bg ?? (isRest ? "rgba(255,255,255,0.01)" : "rgba(255,255,255,0.03)"),
                padding: "5px 6px",
                opacity: isRest ? 0.4 : 1,
              }}
            >
              <p style={{ fontSize: 8, color: "rgba(255,255,255,0.22)", margin: "0 0 2px" }}>{d.date}</p>
              {s && (
                <>
                  <p style={{ fontSize: 8, fontWeight: 600, color: s.color, margin: 0 }}>{d.title}</p>
                  {d.sub && <p style={{ fontSize: 7, color: "rgba(255,255,255,0.25)", margin: "1px 0 0" }}>{d.sub}</p>}
                  {"extra" in d && d.extra === "strength" && (
                    <p style={{ fontSize: 7, color: "oklch(0.65 0.15 300 / 0.65)", margin: "2px 0 0" }}>+ Strength</p>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  ))}

  {/* Fade-out hint */}
  <div style={{ marginTop: 8, height: 36, background: "linear-gradient(to bottom, transparent, #0d1117)", display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 4 }}>
    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.15)" }}>16 weeks total</span>
  </div>
</div>
```

- [ ] **Step 4: Verify visually**

Run `pnpm dev` and open `http://localhost:3000`. Check:
- Plan preview has navy background
- Week label column visible on left (W1, Mar 16, 54 km)
- "Base" phase header appears above week 1
- Colors: easy run = white/muted, long run = blue text with tint, strength = purple, tempo = amber
- Rest days faded
- "16 weeks total" fade at bottom

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/page.tsx
git commit -m "feat: update landing plan preview to match real app UI"
```

---

### Task 4: Replace feature blocks with "How it works"

**Files:**
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Find and replace the feature highlights section**

Locate the `{/* ── Feature highlights ────────────────────────────────────────── */}` comment block (around line 338). Replace the entire section:

```tsx
{/* ── How it works ─────────────────────────────────────────────── */}
<section style={{ padding: "0 24px 96px", maxWidth: 1100, margin: "0 auto" }}>
  <div style={{ textAlign: "center", marginBottom: 40 }}>
    <h2 style={{ fontSize: "clamp(22px, 3.5vw, 36px)", fontWeight: 700, color: "#fff", letterSpacing: "-0.03em", margin: 0 }}>
      How it works
    </h2>
  </div>
  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 24 }}>
    {[
      {
        icon: "🔍",
        title: "Find your race",
        body: "Search from hundreds of races, or add your own.",
      },
      {
        icon: "⚙️",
        title: "Tell us about yourself",
        body: "Your goal time, weekly mileage, lifting days, and schedule.",
      },
      {
        icon: "📋",
        title: "Get your plan",
        body: "A personalized week-by-week plan built for runners who also lift.",
      },
    ].map((f) => (
      <div key={f.title} style={{ padding: 28, borderRadius: 14, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)", textAlign: "center" }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.88)", marginBottom: 8 }}>{f.title}</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", lineHeight: 1.6 }}>{f.body}</div>
      </div>
    ))}
  </div>
</section>
```

- [ ] **Step 2: Verify visually**

Check `http://localhost:3000` — three step cards with emoji icons, no more "Strength integrated, not bolted on" copy.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/page.tsx
git commit -m "feat: replace feature blocks with how it works steps"
```

---

### Task 5: Replace social proof placeholder with founder note

**Files:**
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Find and replace the social proof section**

Locate the `{/* ── Social proof placeholder ──────────────────────────────────── */}` comment block (around line 363). Replace the entire section:

```tsx
{/* ── Founder note ─────────────────────────────────────────────── */}
<section style={{ padding: "0 24px 96px", maxWidth: 540, margin: "0 auto" }}>
  <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)", padding: "36px 32px" }}>
    <p style={{ fontSize: 15, color: "rgba(255,255,255,0.58)", lineHeight: 1.75, fontStyle: "italic", margin: "0 0 16px" }}>
      &ldquo;I was training for the Victoria Marathon and chasing a PR. I didn&apos;t want to pay for Runna, so I was duct-taping ChatGPT and Google Sheets together. It worked, sort of &mdash; but I also lift, and no plan I found took both seriously. So I built one.&rdquo;
    </p>
    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.28)", margin: 0 }}>
      &mdash; Zack, builder &amp; runner
    </p>
  </div>
</section>
```

- [ ] **Step 2: Verify visually**

Check `http://localhost:3000` — dashed placeholder box and fake testimonials are gone, replaced by the founder quote.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/page.tsx
git commit -m "feat: replace social proof placeholder with founder note"
```

---

### Task 6: Final check

- [ ] **Step 1: Run linter and typecheck**

```bash
pnpm lint && pnpm typecheck
```

Expected: no errors. Fix any type errors from the updated MOCK_WEEKS shape (the `extra` field needs to be typed). If TypeScript complains, add it to the day type:

```tsx
type MockDay = {
  day: string
  date: number
  type: WorkoutType
  title: string
  sub: string
  extra?: string
}
```

- [ ] **Step 2: Scroll through the full landing page**

Verify the full page flow:
1. Hero with search widget
2. "Every week, mapped out." + plan preview (navy, real app colors, week labels, phase header)
3. "How it works" (3 steps)
4. Founder note
5. "Ready to build your plan?" CTA

- [ ] **Step 3: Final commit if any fixes were made**

```bash
git add apps/web/app/page.tsx
git commit -m "fix: typecheck and lint fixes for landing page update"
```
