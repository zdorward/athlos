# BQ Reframe: Copy & Positioning Update — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all "hybrid athlete / runners who lift" framing in user-facing copy with "adaptive marathon training for runners with a real goal time" positioning.

**Architecture:** Pure copy changes — no functional logic, routing, or data model changes. Each task targets one file independently; tasks can be done in any order.

**Tech Stack:** Next.js 16 App Router (TSX), JSON (webmanifest), Markdown (CLAUDE.md, README.md)

**Spec:** `docs/superpowers/specs/2026-03-16-bq-reframe-design.md`

---

## Chunk 1: Core app copy changes

### Task 1: Update landing page copy (`apps/web/app/page.tsx`)

**Files:**
- Modify: `apps/web/app/page.tsx:446` (tagline)
- Modify: `apps/web/app/page.tsx:617-618` (plan preview subtitle)
- Modify: `apps/web/app/page.tsx:980` (how it works step 3 body)
- Modify: `apps/web/app/page.tsx:1018-1054` (founder note section — full removal)

- [ ] **Step 1: Update the tagline (line 446)**

  Find:
  ```tsx
              Adaptive race training for runners who lift.
  ```
  Replace with:
  ```tsx
              Adaptive marathon training for runners with a real goal.
  ```

- [ ] **Step 2: Update the plan preview subtitle (lines 617–618)**

  Find:
  ```tsx
              Runs and lifts scheduled together — strength days placed where
              they won&apos;t wreck your key sessions.
  ```
  Replace with:
  ```tsx
              Runs and strength sessions scheduled together — each placed where
              they won&apos;t wreck your key workouts.
  ```

- [ ] **Step 3: Update "How it works" step 3 body (line 980)**

  Find:
  ```tsx
                body: "A personalized week-by-week run + lift plan.",
  ```
  Replace with:
  ```tsx
                body: "A personalized week-by-week plan built around your goal time.",
  ```

- [ ] **Step 4: Remove the founder note section (lines 1018–1054)**

  Remove the entire `{/* ── Founder note ── */}` section block, from the opening comment through the closing `</section>` tag. The section immediately before it ends with `</section>` (closing "How it works") and the section immediately after is `{/* ── Bottom CTA ── */}`.

  Remove this entire block:
  ```tsx
        {/* ── Founder note ─────────────────────────────────────────────── */}
        <section
          style={{ padding: "0 24px 96px", maxWidth: 540, margin: "0 auto" }}
        >
          <div
            style={{
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.07)",
              background: "rgba(255,255,255,0.02)",
              padding: "36px 32px",
            }}
          >
            <p
              style={{
                fontSize: 15,
                color: "rgba(255,255,255,0.58)",
                lineHeight: 1.75,
                fontStyle: "italic",
                margin: "0 0 16px",
              }}
            >
              &ldquo;I was training for the Victoria Marathon and chasing a PR.
              I didn&apos;t want to pay for Runna, so I ended up duct-taping
              ChatGPT and Google Sheets together. It kind of worked, but I also
              lift, so I just built something that handled both.&rdquo;
            </p>
            <p
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.28)",
                margin: 0,
              }}
            >
              &mdash; Zack, builder &amp; runner
            </p>
          </div>
        </section>
  ```

- [ ] **Step 5: Verify the file builds cleanly**

  Run from repo root:
  ```bash
  pnpm typecheck
  ```
  Expected: no TypeScript errors in `apps/web/app/page.tsx`

- [ ] **Step 6: Commit**

  ```bash
  git add apps/web/app/page.tsx
  git commit -m "copy: reframe landing page to serious marathoner positioning"
  ```

---

### Task 2: Update metadata and PWA manifest

**Files:**
- Modify: `apps/web/app/layout.tsx:13`
- Modify: `apps/web/public/site.webmanifest:4`

- [ ] **Step 1: Update the meta description in `layout.tsx` (line 13)**

  Find:
  ```ts
    description: "Adaptive training system for hybrid athletes",
  ```
  Replace with:
  ```ts
    description: "Adaptive marathon training for runners with a real goal time.",
  ```

- [ ] **Step 2: Update the PWA manifest description**

  In `apps/web/public/site.webmanifest`, find:
  ```json
    "description": "Adaptive training system for hybrid athletes",
  ```
  Replace with:
  ```json
    "description": "Adaptive marathon training for runners with a real goal time.",
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/app/layout.tsx apps/web/public/site.webmanifest
  git commit -m "copy: update meta description and PWA manifest to new positioning"
  ```

---

### Task 3: Update onboarding strength training step

**Files:**
- Modify: `apps/web/components/onboarding/steps/step-strength-training.tsx:22`
- Modify: `apps/web/components/onboarding/steps/step-strength-training.tsx:28`

- [ ] **Step 1: Update the subheading (line 22)**

  Find:
  ```tsx
          We&apos;ll schedule lifting days that don&apos;t interfere with your key runs.
  ```
  Replace with:
  ```tsx
          We&apos;ll work strength sessions around your key runs.
  ```

- [ ] **Step 2: Update the "Yes" option description (line 28)**

  Find:
  ```tsx
          description="We'll schedule lifting days around your runs"
  ```
  Replace with:
  ```tsx
          description="Strength sessions scheduled around your runs"
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/components/onboarding/steps/step-strength-training.tsx
  git commit -m "copy: reframe strength training onboarding as scheduling feature"
  ```

---

### Task 4: Update onboarding weekly mileage tier labels

**Files:**
- Modify: `apps/web/components/onboarding/steps/step-weekly-mileage.tsx:11-12` (KM_OPTIONS)
- Modify: `apps/web/components/onboarding/steps/step-weekly-mileage.tsx:18-19` (MILES_OPTIONS)

Both arrays share the same descriptions for the middle two tiers. Update both.

- [ ] **Step 1: Update KM_OPTIONS tier labels (lines 11–12)**

  Find:
  ```ts
    { value: "40-60",   label: "40–60 km/week",      description: "Solid recreational runner" },
    { value: "60-80",   label: "60–80 km/week",      description: "Committed club runner" },
  ```
  Replace with:
  ```ts
    { value: "40-60",   label: "40–60 km/week",      description: "Consistent recreational runner" },
    { value: "60-80",   label: "60–80 km/week",      description: "Consistent club runner" },
  ```

- [ ] **Step 2: Update MILES_OPTIONS tier labels (lines 18–19)**

  Find:
  ```ts
    { value: "40-60",   label: "25–37 mi/week",      description: "Solid recreational runner" },
    { value: "60-80",   label: "37–50 mi/week",      description: "Committed club runner" },
  ```
  Replace with:
  ```ts
    { value: "40-60",   label: "25–37 mi/week",      description: "Consistent recreational runner" },
    { value: "60-80",   label: "37–50 mi/week",      description: "Consistent club runner" },
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/components/onboarding/steps/step-weekly-mileage.tsx
  git commit -m "copy: update mileage tier labels to drop identity-framing language"
  ```

---

## Chunk 2: Project documentation

### Task 5: Update CLAUDE.md overview

**Files:**
- Modify: `CLAUDE.md:5-7` (Overview section)

- [ ] **Step 1: Replace the Overview section**

  Find:
  ```markdown
  ## Overview

  Athlos is an adaptive training system for hybrid athletes (running + lifting). The goal is to build a platform that intelligently adjusts training programs based on athlete performance, recovery, and goals. Currently building out the web app with plans to implement mobile later. Business model will be freemium.
  ```
  Replace with:
  ```markdown
  ## Overview

  Athlos is an adaptive marathon training platform for serious runners with a real goal time. The core differentiator is intelligent plan adaptation based on athlete performance, recovery, and goals — not just static plan generation. Target audience: runners chasing a qualifying time (BQ as the implied benchmark). Strength training is supported as a scheduling feature. Currently building out the web app with plans to implement mobile later. Business model is subscription + time-limited trial (not freemium).
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add CLAUDE.md
  git commit -m "docs: update CLAUDE.md overview to reflect BQ/serious marathoner positioning"
  ```

---

### Task 6: Update root README.md

**Files:**
- Modify: `README.md` (update first paragraph; preserve "Adding Components" and "Using Components" sections)

The current `README.md` has this structure:
1. `# Athlos` heading + description paragraph
2. `## Adding Components` section
3. `## Using Components` section

Only the description paragraph changes.

- [ ] **Step 1: Replace the description paragraph**

  Find this exact string in `README.md`:
  ```
  An adaptive training system for hybrid athletes. The platform intelligently adjusts training programs based on athlete performance, recovery, and goals across multiple disciplines.
  ```

  Replace it with this exact string (note: the `## Dev setup` section and its code block must be included verbatim):

  ````
  Adaptive marathon training for runners with a real goal time. Athlos generates personalized week-by-week plans and adapts them based on performance and recovery. Supports running-only or running + strength scheduling.

  **Tech stack:** pnpm monorepo · Next.js 16 (App Router) · React 19 · Tailwind CSS v4 · shadcn/ui · Neon (Postgres)

  ## Dev setup

  Run all commands from the repo root:

  ```bash
  pnpm dev          # Start Next.js dev server with Turbopack
  pnpm build        # Build all packages and apps
  pnpm lint         # Run ESLint across all packages
  pnpm typecheck    # TypeScript type checking
  ```
  ````

  The existing `## Adding Components` section that follows in the file must be preserved unchanged.

- [ ] **Step 2: Commit**

  ```bash
  git add README.md
  git commit -m "docs: update README with new positioning and dev setup"
  ```

---

## Chunk 3: Final verification

### Task 7: Verify no old framing remains in user-facing copy

- [ ] **Step 1: Search for remaining instances of old copy**

  Run from repo root, scoped to user-facing paths only:
  ```bash
  grep -rE "hybrid athlete|runners who lift|run \+ lift" \
    --include="*.tsx" --include="*.ts" --include="*.json" \
    apps/web/ README.md CLAUDE.md
  ```

  Expected output: empty (no matches).

  If any file appears, fix it before proceeding.

  > **Note:** The following files intentionally contain this copy and are excluded from the check:
  > - `apps/web/package.json` — developer-facing description field (not user-facing)
  > - `docs/` tree — historical specs, plans, and business model doc quote old copy verbatim; leave unchanged

- [ ] **Step 2: Run typecheck to confirm no TypeScript errors were introduced**

  ```bash
  pnpm typecheck
  ```
  Expected: exits with 0 errors.

- [ ] **Step 3: Run lint**

  ```bash
  pnpm lint
  ```
  Expected: no new lint errors.
