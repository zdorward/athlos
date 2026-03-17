# Strength Training Science Document Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Write `docs/training-science/strength-training-science.md` — a full phase-by-phase strength programming reference for the Athlos plan engine — and update `modern-marathon-science.md` to stay in sync.

**Architecture:** Two documentation files, no code changes. The new document is a supplementary science reference that expands the brief Strength Training section in `modern-marathon-science.md` into a complete programming guide. The parent doc's scheduling section is updated to reflect rules already implemented (Peak 1×/week, Taper W1-only) that aren't currently documented there.

**Tech Stack:** Markdown only. No build steps required.

---

## Files

- **Create:** `docs/training-science/strength-training-science.md` — new strength training science reference
- **Modify:** `docs/training-science/modern-marathon-science.md` — update Strength Training scheduling section and Gaps section

---

### Task 1: Write `strength-training-science.md`

**Files:**
- Create: `docs/training-science/strength-training-science.md`

Reference spec: `docs/superpowers/specs/2026-03-17-strength-training-science-design.md`

- [ ] **Step 1: Create the file with Section 1 — Overview and Scheduling Rules**

Write the following content to `docs/training-science/strength-training-science.md`:

```markdown
# Strength Training Science for Marathon Performance

This document is a full programming reference for strength training within marathon preparation. It expands the Strength Training section in `modern-marathon-science.md` into a complete phase-by-phase guide. Where this document and the parent conflict, this document wins — it is more specific.

**Core claim:** Strength training is a first-class performance intervention. The 2024 meta-analysis (PMC11052887, 31 studies, 652 runners) places its effect on running economy in the same tier as lactate threshold work. It is not supplementary.

---

## Scheduling Rules

These rules govern when strength sessions may be placed. They apply across all phases unless a phase-specific note overrides them.

- **Easy run days only.** Strength sessions go on days that have only easy running — never on quality session days (tempo, intervals, MP).
- **After the run, not before.** Strength follows the run on the same day; it does not precede it.
- **Not adjacent to quality sessions (either side).** No strength on the day immediately before or after a tempo, interval, or MP session. Pre-quality strength compromises session performance; post-quality means recovering from two hard efforts simultaneously.
- **Not the day before the long run.** Pre-long-run strength creates fatigue that compromises the most important session of the week. The day *after* the long run is acceptable — post-effort fatigue is not the concern. See `quality-and-strength-placement.md` for full rationale.
- **Frequency by phase:**
  - General Fitness, Base, Build: 2×/week (subject to quality session displacement — see Phase 3 note)
  - Peak: 1×/week (the session furthest from the long run day)
  - Taper Week 1: 1×/week
  - Taper Week 2 onward: 0
  - Race Week: 0
- **Core training** (separate from resistance, not subject to long-run adjacency rule):
  - General Fitness, Base, Build: 3×/week
  - Peak: 2×/week
  - Taper Week 1: 1×/week
  - Taper Week 2 onward and Race Week: 0

> **Divergence from `modern-marathon-science.md`:** The parent doc states "reduce to 1x/week in taper" without a W1/W2 distinction, and does not mention Peak reduction. This document is the authoritative source; the parent doc should be updated to match.

---
```

- [ ] **Step 2: Append Section 2 — Mechanism**

Append to the file:

```markdown
## Why Strength Training Improves Marathon Performance

Three mechanisms explain the running economy gains seen in the meta-analytic evidence:

### 1. Neuromuscular Efficiency

Heavy resistance training recruits high-threshold motor units and improves rate of force development. The result: less relative muscular effort per stride at marathon pace, which delays fatigue over the final miles. This is a neural adaptation — it does not require meaningful muscle hypertrophy, which is why high-intensity, low-volume protocols (≥85% 1RM, 3–5 sets of 3–6 reps) outperform bodybuilding-style training for runners.

### 2. Tendon Stiffness and Elastic Energy Return

Resistance and plyometric training increases stiffness in the Achilles and patellar tendons. Stiffer tendons store and release more elastic energy with each ground contact, directly improving running economy without additional metabolic cost. This is also why calf and single-leg loading — exercises that stress the Achilles directly — are high-value for marathon runners specifically.

### 3. Running Economy (RE) — The Downstream Effect

Running economy is the measurable output of mechanisms 1 and 2. The evidence:

- **PMC11052887 (2024, 31 studies, 652 runners):** Combined heavy + plyometric training produced ES = −0.426 for RE (moderate effect). Heavy load alone: ES = −0.266 (significant). Plyometrics alone: not significant at marathon-relevant speeds.
- **PMC9653533 (2022):** Heavy resistance outperforms plyometrics for RE (g = −0.32 vs −0.13) and time-trial performance (g = −0.24 vs −0.17). Optimal protocol: ≥80–90% 1RM, 10–14 week interventions.

**Plan generation implication:** The cited interventions ran 10–14 weeks. RE adaptations should be expected over that timeframe — not sooner. A plan must begin strength sessions early enough for gains to materialize before race day. The ≥80% 1RM threshold is where significant RE gains occur; early phases use lower intensity intentionally (see Phase-by-Phase section).

---
```

- [ ] **Step 3: Append Section 3 — Phase-by-Phase Programming**

Append to the file:

```markdown
## Phase-by-Phase Programming

This is the plan generation reference. Each phase has a training goal, loading parameters, and session focus. Example exercises are listed as reference — they are guidelines, not prescriptions.

### Notes Before the Table

**Build subdivisions:** Build (early) and Build (late) are internal programming subdivisions, not separate named phases. The plan engine uses a single "Build" phase. The early/late split is a guideline for how loading should evolve within Build, not a scheduler boundary.

**Build frequency displacement:** In Build weeks that carry two quality sessions (e.g., intervals on Tuesday and MP on Friday), the second quality session makes Friday ineligible for strength. This reduces actual strength sessions to 1 that week. This is correct — high-intensity running weeks deprioritize the second strength day. See `quality-and-strength-placement.md`.

**General Fitness:** General Fitness has 0 running quality sessions. Strength training (2×/week) is not a quality running session and does not conflict with this rule.

---

### Phase Table

| Phase | Goal | Frequency | Intensity | Volume | Focus |
|-------|------|-----------|-----------|--------|-------|
| General Fitness | Build tissue tolerance, movement quality | 2×/week | 60–75% 1RM | 3×10–12 | Bilateral compound, unilateral intro — sub-threshold by design; RE gain is not the goal here |
| Base | Hypertrophy → max strength transition | 2×/week | 70–85% 1RM | 3–4×6–10 | Heavy compound lower body, hip drive |
| Build (early) | Maximum strength | 2×/week* | ≥85% 1RM | 3–5×3–6 | Peak load, low volume — this is where RE adaptations primarily occur |
| Build (late) | Strength → power transition | 2×/week* | 75–85% 1RM + plyos | 3×4–6 + plyos | Explosive variants, single-leg; plyometric complement introduced here only |
| Peak | Strength maintenance | 1×/week | ≥80% 1RM | 2–3×3–5 | Maintain neural adaptations, minimal fatigue; 1×/week = lowest fatigue cost while preserving gains |
| Taper W1 | Keep motor patterns fresh | 1×/week | ≥75% 1RM | 2×4–6 | Reduced volume, maintained intensity — neural pattern retention without new load stress |
| Taper W2+ | 0 | — | — | — | — |
| Race Week | 0 | — | — | — | — |

*Subject to quality session displacement; may be 1×/week when two quality sessions are present.

---

### Why Early Phases Are Sub-Threshold

General Fitness and Base use 60–85% 1RM — below the ≥80% threshold where significant RE gains occur. This is intentional. Connective tissue (tendons, ligaments) adapts more slowly than muscle. Beginning at lower loads and higher rep ranges builds tissue tolerance before progressing to heavy training. Starting ≥85% 1RM from week 1 without a prior adaptation base increases injury risk without commensurate RE benefit.

The Base-to-Build transition (up to 85% → ≥85% 1RM) is continuous, not a hard step. Athletes in late Base who are tolerating 85% comfortably should begin progressing into Build-early territory ahead of the phase boundary.

### Why Taper W1 Maintains Load

Taper W1 reduces volume (2×4–6 sets) but maintains relative intensity (≥75% 1RM). The goal in Taper is to arrive at the start line fresh without losing neuromuscular adaptations. Volume reduction achieves freshness; maintaining intensity prevents neural detraining. Dropping load below 70% in Taper W1 shifts the session toward hypertrophic stimulus — the wrong direction — and increases muscle soreness risk going into Race Week.

### Example Exercises

These are reference examples only. Exercise selection is not prescribed by this document.

- **Lower body compound:** squat, trap bar deadlift, Romanian deadlift
- **Unilateral lower body:** Bulgarian split squat, single-leg press, step-up
- **Hip and glute:** hip thrust, cable pull-through
- **Calf and Achilles:** heavy single-leg calf raise (seated and standing), loaded eccentric drop
- **Plyometric complement (Build late only):** box jump, broad jump, single-leg hop

---
```

- [ ] **Step 4: Append Section 4 — Anti-Patterns**

Append to the file:

```markdown
## Plan Generation Anti-Patterns

Rules the plan engine must not violate.

1. **No strength on quality days or adjacent to them.** No strength on the day of, the day before, or the day after a tempo, interval, or MP session. This applies in both directions — pre-quality compromises performance, post-quality doubles recovery demand.

2. **No strength the day before the long run.** Pre-long-run fatigue compromises the week's most important session. The day after the long run is acceptable.

3. **No plyometrics as the primary intervention.** Plyometrics alone produce no significant RE effect at marathon-relevant speeds. They are a Build (late) complement to heavy resistance only — not a substitute.

4. **No high-volume strength in Peak.** Volume drops to maintenance (2–3×3–5). New strength stimulus in Peak creates fatigue without time to adapt before race day.

5. **No new exercises in Peak or Taper.** Novel movement patterns cause DOMS. Only exercises established earlier in the plan.

6. **Don't start strength late.** RE adaptations require 10–14 weeks. For plans shorter than 12 weeks where strength cannot begin until Build, include strength sessions anyway — but note to the user that RE gains may not fully materialize before race day.

---
```

- [ ] **Step 5: Append Section 5 — Gaps and Uncertainties**

Append to the file:

```markdown
## Gaps and Uncertainties

- **Exercise selection: no head-to-head RCTs.** Most evidence measures RE and time-trial outcomes but doesn't compare specific exercises. "Heavy compound lower body" is well-supported; which specific lift is optimal is not established.
- **Load periodization arc: coaching consensus.** The hypertrophy → max strength → power progression is theoretically grounded but no RCT has tested this specific sequence for marathon runners against alternatives.
- **Plyometric volume thresholds: unknown.** Evidence does not establish a minimum effective dose for plyometrics as a complement to heavy resistance. Current guidance (Build late only, low volume) is conservative.
- **Female runners: limited data.** Most meta-analyses skew male. Whether loading parameters differ meaningfully for female athletes is an open question.
- **Core training programming** — `CLAUDE.md` specifies 3×/week core as a distinct intervention. This document specifies core frequency by phase but does not specify phase-by-phase core exercise selection or volume. Core programming details are deferred to a future document or coach guidance.

---

## Sources

- [PMC11052887](https://pmc.ncbi.nlm.nih.gov/articles/PMC11052887/) — Strength training and running economy meta-analysis (2024, 31 studies, 652 runners)
- [PMC9653533](https://pmc.ncbi.nlm.nih.gov/articles/PMC9653533/) — Heavy resistance vs. plyometrics for running economy (2022)
```

- [ ] **Step 6: Verify the document reads correctly end-to-end**

Open `docs/training-science/strength-training-science.md` and confirm:
- All 5 sections are present
- Phase table renders correctly (8 rows including Race Week)
- No broken markdown (unclosed code fences, malformed table rows)
- Sources section has both PMC links

- [ ] **Step 7: Commit**

```bash
git add docs/training-science/strength-training-science.md
git commit -m "docs: add strength training science reference document"
```

---

### Task 2: Update `modern-marathon-science.md`

**Files:**
- Modify: `docs/training-science/modern-marathon-science.md`

Two targeted edits. Do not rewrite sections — make the minimum changes to bring the parent doc in sync.

- [ ] **Step 1: Update the Scheduling subsection**

Find the `### Scheduling` heading under `## Strength Training` by matching the exact text below. Replace it in full:

```markdown
### Scheduling

- 2x/week resistance training on easy run days (after the run, not adjacent to long run or quality sessions)
- Reduce to 1x/week in taper
- 0 in race week
- Never on quality session days
```

Replace with:

```markdown
### Scheduling

- 2×/week resistance training on easy run days (after the run; not adjacent to long run or quality sessions)
- Reduce to 1×/week in Peak (session furthest from the long run)
- 1×/week in Taper Week 1 only; 0 from Taper Week 2 onward
- 0 in Race Week
- Never on quality session days or the day immediately before or after a quality session

> For full phase-by-phase programming details, see `docs/training-science/strength-training-science.md`.
```

- [ ] **Step 2: Update the Gaps section — remove the concurrent training interference entry**

Find the Gaps section near the bottom of the file. Remove the following entry (it is now covered in `quality-and-strength-placement.md`):

```
- "After easy run, not on quality days" for strength has physiological rationale but limited direct experimental testing.
```

Leave all other gap entries unchanged.

- [ ] **Step 3: Verify the edit looks correct**

Read `docs/training-science/modern-marathon-science.md` lines 109–180 and confirm:
- Scheduling section reflects Peak and Taper W1/W2+ rules
- Cross-reference link to `strength-training-science.md` is present
- Removed gap entry is gone
- No other content was accidentally changed

- [ ] **Step 4: Commit**

```bash
git add docs/training-science/modern-marathon-science.md
git commit -m "docs: update strength training scheduling rules in parent doc"
```
