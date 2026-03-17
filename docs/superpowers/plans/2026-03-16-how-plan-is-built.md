# How Your Plan Is Built — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "How your plan is built" section to the landing page explaining the five real inputs and what each drives in the generated plan.

**Architecture:** Single JSX block inserted into `apps/web/app/page.tsx` between the existing "Why Athlos" section and the bottom CTA. No new files, no new components, no logic changes — pure markup and inline styles matching the existing page conventions.

**Tech Stack:** Next.js 16, React 19, inline styles (no Tailwind in this file)

---

## Chunk 1: Insert the "How your plan is built" section

### Task 1: Add the section to page.tsx

**Files:**
- Modify: `apps/web/app/page.tsx` (between the `{/* ── Why Athlos ──` section closing tag and the `{/* ── Bottom CTA ──` comment)

- [ ] **Step 1: Locate the insertion point**

Open `apps/web/app/page.tsx`. Find the comment `{/* ── Bottom CTA ────────────────────────────────────────────── */}` at approximately line 500. The new section goes immediately before it, after the closing `</section>` of the "Why Athlos" block.

- [ ] **Step 2: Insert the new section**

Add the following JSX block immediately before `{/* ── Bottom CTA ──`:

```tsx
{/* ── How your plan is built ────────────────────────────── */}
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
      How your plan is built
    </h2>
    <p
      style={{
        fontSize: 14,
        color: "rgba(255,255,255,0.32)",
        margin: "8px 0 0",
      }}
    >
      Five inputs. One coherent plan.
    </p>
  </div>
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 24,
    }}
  >
    {[
      {
        label: "Goal time",
        title: "Sets your training load",
        body: "Sub-3:15 means higher mileage and more intensity sessions. Sub-4:30 means more aerobic base, less threshold work. Your target pace determines what your body needs to do to get there.",
      },
      {
        label: "Current weekly mileage",
        title: "Sets your volume ceiling",
        body: "Where you are now determines how aggressively the plan can ramp. Running 60km/week already? The plan builds on that. Starting from 30km? It gets you there safely over the base phase.",
      },
      {
        label: "Running days",
        title: "Determines session mix",
        body: "5 days gets you a long run, a tempo, and three easy runs. 4 days drops the least valuable session first. The long run and quality work are always protected.",
      },
      {
        label: "Strength days",
        title: "Kept in the picture",
        body: "Tell us which days you lift. The plan is built around your full training week, running and strength included.",
      },
    ].map((card) => (
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
        <div
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.38)",
            lineHeight: 1.6,
          }}
        >
          {card.body}
        </div>
      </div>
    ))}
    {/* Full-width fifth card */}
    <div
      style={{
        gridColumn: "1 / -1",
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
      <div
        style={{
          fontSize: 12,
          color: "rgba(255,255,255,0.38)",
          lineHeight: 1.6,
        }}
      >
        18 or more weeks gets a full base, build, peak, taper arc. Shorter windows compress the base and extend the peak. The taper stays at 3 weeks regardless.
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 3: Verify it builds**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: Visual check**

```bash
pnpm dev
```

Open `http://localhost:3000`. Scroll past the "Why Athlos" section. Confirm:
- "How your plan is built" heading appears
- "Five inputs. One coherent plan." subheading below it
- 2x2 grid of four cards (Goal time, Current weekly mileage, Running days, Strength days)
- Full-width "Weeks to race" card below the grid
- Section flows cleanly into the "Build your plan." CTA below

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/page.tsx
git commit -m "feat: add 'How your plan is built' section to landing page"
```
