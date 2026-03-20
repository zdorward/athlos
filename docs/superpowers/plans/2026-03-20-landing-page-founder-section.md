# Landing Page Founder Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Why I built this" founder section to the landing page and update the bottom CTA to surface free pricing.

**Architecture:** All changes are in a single file (`apps/web/app/landing-page.tsx`). A new `FounderSection` function component is added at the bottom of the file alongside existing sub-components, then inserted into `PageContent`'s JSX. The bottom CTA gets a minor copy update. No new files, no new dependencies.

**Tech Stack:** Next.js 16, React 19, inline styles (no Tailwind — the landing page uses only inline styles throughout)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/web/app/landing-page.tsx` | Modify | Add `FounderSection` component, insert into JSX, update bottom CTA |
| `apps/web/public/zack.jpg` | Not part of implementation | Zack provides separately; `onError` fallback handles absence |

---

### Task 1: Add `FounderSection` component

**Files:**
- Modify: `apps/web/app/landing-page.tsx`

This task has no unit tests — it is a static visual component. Verification is done by running the dev server and checking visually.

- [ ] **Step 1: Add `FounderSection` to the bottom of the file**

Open `apps/web/app/landing-page.tsx`. After the `DropdownRaceRow` function (currently the last function in the file, ending around line 768), add the following function:

```tsx
function FounderSection() {
  const [photoError, setPhotoError] = useState(false)

  return (
    <section style={{ padding: "0 24px 96px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>

        {/* Flex row: photo column | text column */}
        <div style={{ display: "flex", gap: 32, alignItems: "flex-start", flexWrap: "wrap" }}>

          {/* Photo column */}
          <div style={{ flexShrink: 0, minWidth: 120, display: "flex", flexDirection: "column", alignItems: "center" }}>
            {photoError ? (
              <div style={{
                width: 88, height: 88, borderRadius: "50%",
                background: "rgba(255,255,255,0.08)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, color: "rgba(255,255,255,0.4)",
              }}>ZD</div>
            ) : (
              <img
                src="/zack.jpg"
                alt="Zack"
                onError={() => setPhotoError(true)}
                style={{ width: 88, height: 88, borderRadius: "50%", objectFit: "cover", display: "block" }}
              />
            )}
            <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.88)", marginTop: 10 }}>Zack</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", marginTop: 2 }}>Edmonton, AB</div>
          </div>

          {/* Text column */}
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
              textTransform: "uppercase", color: "rgba(100,150,255,0.7)", marginBottom: 16,
            }}>
              Why I built this
            </div>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: "rgba(255,255,255,0.55)", margin: "0 0 14px" }}>
              I ran my first marathon in September 2025 in{" "}
              <strong style={{ color: "rgba(255,255,255,0.88)", fontWeight: 600 }}>3:52</strong>. I&apos;m trying to run{" "}
              <strong style={{ color: "rgba(255,255,255,0.88)", fontWeight: 600 }}>3:20 at Victoria BC</strong>{" "}
              this year and I&apos;m using Athlos to get there.
            </p>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: "rgba(255,255,255,0.55)", margin: "0 0 14px" }}>
              I wanted something that fit how I actually train. I lift, I care about how I look, and I run.
              Most plans don&apos;t really account for that. I built this mostly for myself and figured other
              people probably had the same problem.
            </p>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: "rgba(255,255,255,0.55)", margin: 0 }}>
              I also just don&apos;t think training plans should cost money.{" "}
              <strong style={{ color: "rgba(255,255,255,0.88)", fontWeight: 600 }}>Athlos is free.</strong>{" "}
              The core plan always will be.
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div style={{
          display: "flex", marginTop: 32,
          border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, overflow: "hidden",
        }}>
          {[
            { value: "3:52", color: "rgba(255,255,255,0.88)", label: "First marathon · Sept 2025" },
            { value: "3:20", color: "rgba(100,150,255,0.9)", label: "Goal · Victoria BC 2026" },
            { value: "2:55", color: "rgba(167,139,250,0.9)", label: "BQ goal · 2027" },
          ].map((stat, i) => (
            <div key={stat.value} style={{
              flex: 1, padding: "16px 20px", textAlign: "center",
              borderRight: i < 2 ? "1px solid rgba(255,255,255,0.07)" : undefined,
            }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", marginTop: 4 }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Early access callout */}
        <div style={{
          marginTop: 20, padding: "14px 18px",
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 8, display: "flex", alignItems: "flex-start", gap: 12,
        }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>⚡</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.88)" }}>Early access</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.38)" }}>
              I&apos;m looking for people to try this and tell me what&apos;s wrong with it. I read every message.
            </div>
            <a
              href="mailto:zack@athlos.run"
              style={{ fontSize: 12, color: "rgba(100,150,255,0.9)", textDecoration: "none" }}
            >
              zack@athlos.run
            </a>
          </div>
        </div>

      </div>
    </section>
  )
}
```

- [ ] **Step 2: Insert `<FounderSection />` into `PageContent`'s JSX**

In the `PageContent` function's return JSX, find the comment `{/* ── Bottom CTA ──...*/}` (around line 620). Insert `<FounderSection />` immediately before that bottom CTA `<section>`:

```tsx
        {/* existing "How your plan is built" section ends here */}

        <FounderSection />

        {/* ── Bottom CTA ────────────────────────────────────────────────── */}
        <section style={{ padding: "0 24px 120px", textAlign: "center" }}>
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: Verify visually**

```bash
pnpm dev
```

Open http://localhost:3000. Scroll past "How your plan is built". Confirm:
- Founder section appears with the "ZD" placeholder (since `/zack.jpg` doesn't exist yet)
- Photo column: grey circle with "ZD", "Zack", "Edmonton, AB" below
- Text column: "WHY I BUILT THIS" label, three paragraphs
- Stats row: 3:52 / 3:20 / 2:55 in correct colors
- Early access callout with zack@athlos.run as a clickable mailto link
- On a narrow viewport (<400px), photo stacks above text

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/landing-page.tsx
git commit -m "feat: add founder section to landing page"
```

---

### Task 2: Update bottom CTA with free pricing line

**Files:**
- Modify: `apps/web/app/landing-page.tsx`

- [ ] **Step 1: Update the subtitle margin and add the free pricing line**

In the bottom CTA `<section>` (around line 621), find the subtitle `<p>` element:

```tsx
          <p
            style={{
              fontSize: 14,
              color: "rgba(255,255,255,0.32)",
              margin: "0 0 28px",
            }}
          >
            Pick your race. Set your goal time. We&apos;ll handle the rest.
          </p>
```

Change `margin: "0 0 28px"` to `margin: "0 0 8px"`, and add a new element immediately after the closing `</p>`:

```tsx
          <p
            style={{
              fontSize: 14,
              color: "rgba(255,255,255,0.32)",
              margin: "0 0 8px",
            }}
          >
            Pick your race. Set your goal time. We&apos;ll handle the rest.
          </p>
          <p
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "#4ade80",
              margin: "0 0 28px",
            }}
          >
            Free. No account required to start.
          </p>
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Verify visually**

Open http://localhost:3000. Scroll to the bottom CTA. Confirm:
- "Pick your race. Set your goal time. We'll handle the rest." appears in grey
- "Free. No account required to start." appears below it in green
- Spacing between the green line and the button looks correct (28px gap)

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/landing-page.tsx
git commit -m "feat: add free pricing line to landing page CTA"
```
