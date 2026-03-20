# Landing Page Science Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the "Why Athlos" section, refactor "How your plan is built" into a responsive component with tighter copy, and add a new "The Science" section with three scannable blocks.

**Architecture:** All changes are in `apps/web/app/landing-page.tsx`. No new files. Two new named functions (`PlanInputsSection`, `ScienceSection`) are added at the bottom of the file, consistent with the existing `FounderSection` pattern. `PageContent` is updated to use `<PlanInputsSection />` and `<ScienceSection />` in place of the old inline JSX.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, inline styles (existing pattern in this file)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/web/app/landing-page.tsx` | Modify | Remove Why Athlos; replace inline "How your plan is built" JSX with `<PlanInputsSection />`; add `<ScienceSection />` before `<FounderSection />`; add both component functions at bottom of file |

---

## Task 1: Remove "Why Athlos" and replace "How your plan is built" with PlanInputsSection

**Files:**
- Modify: `apps/web/app/landing-page.tsx`

This task has no testable logic — it is pure JSX restructuring. Verification is typecheck.

### Context

In `PageContent`, the render return contains (in order):
1. Hero section
2. `<PlanPreview />`
3. "Why Athlos" section (lines ~398–468) — **delete this entirely**
4. "How your plan is built" section (lines ~471–613) — **replace with `<PlanInputsSection />`**
5. `<FounderSection />`
6. Bottom CTA

The `PlanInputsSection` function is added at the bottom of the file after `FounderSection`.

---

- [ ] **Step 1: In `PageContent`, delete the "Why Athlos" section**

Find and delete this entire block (including the blank line before it):

```tsx
        {/* ── Why Athlos ──────────────────────────────────────────────── */}
        <section
          style={{ padding: "0 24px 96px", maxWidth: 1100, margin: "0 auto" }}
        >
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <h2
              style={{
                fontSize: "clamp(22px, 3.5vw, 36px)",
                fontWeight: 700,
                color: "#fff",
                letterSpacing: "-0.03em",
                margin: 0,
              }}
            >
              Why Athlos
            </h2>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 24,
            }}
          >
            {[
              {
                title: "Pfitzinger methodology",
                body: "Not generic intervals. Structured phases: base, build, peak, taper — built around your race date and goal time.",
              },
              {
                title: "Strength training included",
                body: "Lift days scheduled around your key runs, not as an afterthought.",
              },
              {
                title: "Adaptive by default",
                body: "Log how a session felt. If you're accumulating fatigue, the plan adjusts — before it becomes an injury.",
              },
            ].map((f) => (
              <div
                key={f.title}
                style={{
                  padding: 28,
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.07)",
                  background: "rgba(255,255,255,0.02)",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.88)",
                    marginBottom: 8,
                  }}
                >
                  {f.title}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "rgba(255,255,255,0.38)",
                    lineHeight: 1.6,
                  }}
                >
                  {f.body}
                </div>
              </div>
            ))}
          </div>
        </section>
```

- [ ] **Step 2: Replace the "How your plan is built" section with `<PlanInputsSection />`**

Find and replace the entire "How your plan is built" section (from the comment through the closing `</section>`) with a single self-closing tag:

Delete:
```tsx
        {/* ── How your plan is built ────────────────────────────────── */}
        <section
          style={{ padding: "0 24px 96px", maxWidth: 1100, margin: "0 auto" }}
        >
          ...all content...
        </section>
```

Replace with:
```tsx
        <PlanInputsSection />
```

- [ ] **Step 3: Add the `PlanInputsSection` function at the bottom of the file**

Add after the closing `}` of `FounderSection` (before the end of the file):

```tsx
function PlanInputsSection() {
  const cards = [
    {
      label: "Goal time",
      title: "Sets your training load",
      body: "Sets your training intensity and marathon-pace volume. Faster goals mean more threshold work and higher mileage.",
    },
    {
      label: "Current weekly mileage",
      title: "Sets your volume ceiling",
      body: "Determines your starting point and how aggressively the plan can build.",
    },
    {
      label: "Running days",
      title: "Determines session mix",
      body: "Sets how many sessions per week and which types fit in.",
    },
    {
      label: "Strength days",
      title: "Kept in the picture",
      body: "Tell us which days you lift. The plan is built around your full training week.",
    },
  ]

  return (
    <section style={{ padding: "0 24px 96px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <h2
          style={{
            fontSize: "clamp(22px, 3.5vw, 36px)",
            fontWeight: 700,
            color: "#fff",
            letterSpacing: "-0.03em",
            margin: 0,
          }}
        >
          How your plan is built
        </h2>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.32)", margin: "8px 0 0" }}>
          Five inputs. Grounded in what actually predicts marathon performance.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cards.map((card) => (
          <div
            key={card.label}
            style={{
              padding: 28,
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.07)",
              background: "rgba(255,255,255,0.02)",
              textAlign: "left",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "rgba(100,150,255,0.7)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              {card.label}
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "rgba(255,255,255,0.88)",
                marginBottom: 6,
              }}
            >
              {card.title}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", lineHeight: 1.6 }}>
              {card.body}
            </div>
          </div>
        ))}
        {/* Fifth card — full width on desktop */}
        <div
          className="md:col-span-2"
          style={{
            padding: 28,
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.07)",
            background: "rgba(255,255,255,0.02)",
            textAlign: "left",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "rgba(100,150,255,0.7)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Weeks to race
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "rgba(255,255,255,0.88)",
              marginBottom: 6,
            }}
          >
            Defines your phase structure
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", lineHeight: 1.6 }}>
            Determines how long each phase runs and how much time is available to build before the taper.
          </div>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Typecheck**

```bash
cd /Users/zackdorward/dev/athlos && pnpm typecheck
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/landing-page.tsx
git commit -m "feat: remove Why Athlos section, extract PlanInputsSection with responsive grid"
```

---

## Task 2: Add ScienceSection

**Files:**
- Modify: `apps/web/app/landing-page.tsx`

### Context

Insert `<ScienceSection />` in `PageContent` between `<PlanInputsSection />` and `<FounderSection />`. Add the `ScienceSection` function at the bottom of the file after `PlanInputsSection`.

---

- [ ] **Step 1: Insert `<ScienceSection />` in `PageContent`**

Find:
```tsx
        <PlanInputsSection />

        <FounderSection />
```

Replace with:
```tsx
        <PlanInputsSection />

        <ScienceSection />

        <FounderSection />
```

- [ ] **Step 2: Add the `ScienceSection` function at the bottom of the file**

Add after the closing `}` of `PlanInputsSection`:

```tsx
function ScienceSection() {
  const phases = [
    {
      name: "Base",
      focus: "Aerobic foundation. Tempo runs introduce lactate threshold work. Easy volume builds the engine.",
      labelStyle: { background: "rgba(80,120,255,0.15)", color: "rgba(100,150,255,0.9)" },
    },
    {
      name: "Build",
      focus: "Early: tempo + VO2max intervals raise your ceiling. Late Build shifts toward marathon pace.",
      labelStyle: { background: "rgba(120,80,255,0.15)", color: "rgba(160,120,255,0.9)" },
    },
    {
      name: "Peak",
      focus: "Marathon-pace dominant. The final 6–8 weeks are the most race-specific of the entire plan.",
      labelStyle: { background: "rgba(255,120,50,0.15)", color: "rgba(255,150,80,0.9)" },
    },
    {
      name: "Taper",
      focus: "3 weeks. One light tempo session in Week 1. Full easy running from Week 2 through race day.",
      labelStyle: { background: "rgba(80,200,120,0.15)", color: "rgba(100,220,140,0.9)" },
    },
  ]

  return (
    <section style={{ padding: "0 24px 96px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <h2
          style={{
            fontSize: "clamp(22px, 3.5vw, 36px)",
            fontWeight: 700,
            color: "#fff",
            letterSpacing: "-0.03em",
            margin: 0,
          }}
        >
          The Science
        </h2>
      </div>

      {/* Block 1 — Built on Pfitzinger, improved */}
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.88)" }}>
          Built on Pfitzinger, improved
        </div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", marginTop: 6 }}>
          Pfitz is the gold standard for volume progression and phase structure. We keep what works and fix what doesn&apos;t.
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", lineHeight: 1.6, marginTop: 8 }}>
          What we keep: the 10% progression rule, long run targets, recovery week cadence, and the Base → Build → Peak → Taper arc. What we change: intensity distribution is polarized (80% easy / 20% hard) to eliminate the gray-zone fatigue that Pfitz&apos;s medium-long runs create. Phase order is reversed — threshold work comes before VO2max in early phases, then marathon-pace dominates the final 6–8 weeks. And marathon-pace volume is dramatically higher than Pfitz prescribes (~14 miles over 12 weeks). Modern coaching prescribes 5–10× that.
        </div>
      </div>

      {/* Block 2 — Training phases */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 28, marginTop: 28 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.88)" }}>
          Training phases
        </div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", marginTop: 6 }}>
          Four phases, each with a distinct purpose. The taper is always 3 weeks — everything else scales to your timeline.
        </div>
        <div className="mt-4 space-y-3">
          {phases.map((phase) => (
            <div key={phase.name} className="flex items-start gap-3">
              <div
                className="shrink-0 rounded px-2 py-0.5 text-xs font-semibold"
                style={phase.labelStyle}
              >
                {phase.name}
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.6, color: "rgba(255,255,255,0.55)" }}>
                {phase.focus}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Block 3 — Strength training */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 28, marginTop: 28 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.88)" }}>
          Strength training is performance, not maintenance
        </div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", marginTop: 6 }}>
          A 2024 meta-analysis of 31 studies and 652 runners puts heavy resistance training on the same performance tier as lactate threshold work.
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", lineHeight: 1.6, marginTop: 8 }}>
          Heavy resistance (≥80% 1RM) combined with plyometrics improves neuromuscular efficiency, tendon stiffness, and running economy. The effect size is meaningful (ES = −0.426). We schedule strength on easy run days, after the run, never adjacent to quality sessions or the long run. Volume tapers with the plan: 2×/week resistance in Base and Build, 1×/week in Peak, and zero from Taper Week 2 through race day.
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Typecheck**

```bash
cd /Users/zackdorward/dev/athlos && pnpm typecheck
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/landing-page.tsx
git commit -m "feat: add ScienceSection to landing page with Pfitz, phases, and strength blocks"
```

---

## Task 3: Verify

**Files:** none (verification only)

- [ ] **Step 1: Lint**

```bash
pnpm lint
```

Expected: no errors

- [ ] **Step 2: Smoke test on desktop**

```bash
pnpm dev
```

Open `http://localhost:3000`. Verify:
- "Why Athlos" section is gone
- "How your plan is built" shows 5 cards in 2-col on desktop, "Weeks to race" spans full width
- "The Science" section appears below with 3 blocks separated by hairline borders
- Phase labels (Base/Build/Peak/Taper) show colored badges

- [ ] **Step 3: Smoke test on mobile**

Resize browser to mobile width (375px). Verify:
- "How your plan is built" cards stack to single column
- "The Science" blocks read cleanly at narrow width

- [ ] **Step 4: Push**

```bash
git push origin develop
```
