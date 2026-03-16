# Landing Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update landing page copy to establish authority with the BQ/Pfitzinger audience.

**Architecture:** Copy-only changes to apps/web/app/page.tsx. No logic, no new components, no layout changes.

**Tech Stack:** Next.js 16, React 19, TypeScript.

---

## Hero Section

- [ ] **Replace headline**

  Old:
  ```
  When&apos;s your next race?
  ```
  New:
  ```
  Pfitzinger-based marathon training.<br />Built around your goal time.
  ```

  The `<h1>` currently renders a plain string. Replace it with JSX that includes a `<br />` tag between the two phrases so the line break is enforced at all viewport widths. The surrounding `<h1>` style is unchanged.

- [ ] **Replace subheading**

  Old:
  ```
  Adaptive marathon training for runners with a real goal.
  ```
  New:
  ```
  Strength training built in from day one.
  Adapts when your body says it needs to.
  ```

  Rendered as two lines. Use a `<br />` between the two phrases inside the existing `<p>` tag. All existing inline styles on the `<p>` are unchanged.

- [ ] **Add trust bar**

  Insert a new `<p>` element immediately after the closing `</div>` of the `ref={wrapRef}` search widget div and before the closing `</div>` of the hero content flex container (the one with `paddingBottom: "14vh"`).

  Old (the closing pair of divs at lines 534–536):
  ```jsx
            </div>

          </div>
  ```
  New:
  ```jsx
            </div>

            <p style={{ fontSize: 12, margin: 0, color: "rgba(255,255,255,0.22)", letterSpacing: "0.02em" }}>
              Adaptive · Hybrid-athlete ready · Built for BQ
            </p>

          </div>
  ```

---

## Middle Section — "Why Athlos" (replaces "How it works")

- [ ] **Update section comment**

  Old:
  ```
  {/* ── How it works ─────────────────────────────────────────────── */}
  ```
  New:
  ```
  {/* ── Why Athlos ──────────────────────────────────────────────── */}
  ```

- [ ] **Update section heading**

  Old:
  ```
              How it works
  ```
  New:
  ```
              Why Athlos
  ```

- [ ] **Replace card data and remove icon render block**

  Old (the entire `.map((f) => (` data array and the icon render div inside the map):
  ```jsx
            {[
              {
                icon: "🔍",
                title: "Find your race",
                body: "Search from hundreds of races, or add your own.",
              },
              {
                icon: "⚙️",
                title: "Tell us about yourself",
                body: "Your goal time, weekly mileage, and preferred workout days.",
              },
              {
                icon: "📋",
                title: "Get your plan",
                body: "A week-by-week plan built on Pfitzinger's methodology — structured by your goal time, adapted by AI.",
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
                <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
                <div
  ```
  New:
  ```jsx
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
  ```

---

## Bottom CTA Section

- [ ] **Replace CTA headline**

  Old:
  ```
            Ready to build your plan?
  ```
  New:
  ```
            Build your plan.
  ```

- [ ] **Replace CTA body**

  Old:
  ```
            Pick your race above and you&apos;ll have a full plan in under 2
            minutes.
  ```
  New:
  ```
            Pick your race. Set your goal time. We&apos;ll handle the rest.
  ```

---

## Verification & Commit

- [ ] **Typecheck**

  ```bash
  pnpm typecheck
  ```

  Expect zero errors. The changes are copy-only; no new imports or type references are introduced.

- [ ] **Commit**

  ```bash
  git add apps/web/app/page.tsx
  git commit -m "feat: update landing page copy for BQ/Pfitzinger audience"
  ```
