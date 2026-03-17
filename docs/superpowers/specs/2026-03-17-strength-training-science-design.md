# Strength Training Science Document — Design Spec

**Date:** 2026-03-17
**Status:** Approved

---

## Overview

This spec defines the structure and content of a new training science reference document:
`docs/training-science/strength-training-science.md`

It is a supplementary document to `modern-marathon-science.md`, focused entirely on strength training for marathon performance. Its primary purpose is to inform Athlos plan generation logic — specifically, how strength session content and emphasis should change across training phases.

---

## Document Structure

### Section 1 — Overview and Scheduling Rules

Brief framing: this doc expands the Strength Training section from `modern-marathon-science.md` into a full programming reference. States the core claim upfront: strength training is a first-class performance intervention, not supplementary.

This section restates the scheduling constraints inline (not merely by reference):
- 2×/week resistance training on easy run days only (subject to displacement; see Build note below)
- Always after the run, not before
- Never on quality session days (tempo, intervals, MP) — or the day immediately before or after a quality session
- Not on the day immediately **before** the long run (pre-only constraint — the day after is acceptable; see `quality-and-strength-placement.md`)
- Reduce to 1×/week in Peak (the session furthest from the long run)
- 1×/week in Taper Week 1 only; 0 from Taper Week 2 onward
- 0 in Race Week
- Core training: 3×/week in General Fitness, Base, and Build; 2×/week in Peak; 1×/week in Taper Week 1; 0 from Taper Week 2 onward and Race Week (core is separate from resistance and not subject to the long-run adjacency rule)

**Note on divergence from parent doc:** `modern-marathon-science.md` states "reduce to 1x/week in taper" without distinguishing W1 vs. W2+. This document refines that to: 1×/week in Taper W1 only, 0 from W2 onward. The parent doc should be updated to match.

**Note on Peak frequency:** `modern-marathon-science.md` does not state a frequency reduction in Peak. This document introduces Peak as 1×/week (already implemented in the phase-aware strength scheduling feature). The parent doc should be updated to reflect this.

---

### Section 2 — Mechanism: Why Strength Training Improves Marathon Performance

Three mechanisms grounded in meta-analytic evidence:

1. **Neuromuscular efficiency** — Heavy resistance training recruits high-threshold motor units and improves rate of force development. This reduces the relative muscular effort per stride at marathon pace, delaying fatigue.

2. **Tendon stiffness and elastic energy return** — Resistance and plyometric training increases Achilles and patellar tendon stiffness. Stiffer tendons store and release more elastic energy per stride, directly improving running economy without additional metabolic cost.

3. **Running economy (RE)** — The downstream effect of 1 and 2. The 2024 meta-analysis (PMC11052887, 31 studies, 652 runners) quantified combined heavy + plyometric training at ES = −0.426 for RE. Heavy alone: ES = −0.266. Plyometrics alone: not significant at marathon-relevant speeds.

**Key implication for plan generation:** The cited interventions ran 10–14 weeks; RE gains should be expected over that timeframe. A plan must start strength sessions early enough for the adaptations to materialize before race day. The ≥80% 1RM threshold is where significant RE gains occur; early phases use lower intensity intentionally for tissue tolerance (see Section 3).

---

### Section 3 — Phase-by-Phase Programming

The core section. Each phase specifies: training goal, frequency, intensity (% 1RM), volume (sets × reps), session focus, and key constraints.

**Note on Build subdivisions:** Build (early) and Build (late) are internal subdivisions of the Build phase, not separate named phases. The plan engine uses a single "Build" phase; the early/late split is a programming guideline, not a scheduler boundary.

**Note on Build strength frequency:** The 2×/week target in Build is the programming goal, not a guarantee. In Build weeks with two quality sessions (intervals + MP/tempo), the second quality session (typically Friday) displaces the second strength slot, reducing actual strength sessions to 1 that week. This is intentional and correct — high-intensity running weeks deprioritize the second strength day. See `quality-and-strength-placement.md` for the full scheduling resolution logic.

**Note on General Fitness:** General Fitness has 0 running quality sessions per the parent doc. Strength training (2×/week) is not a quality running session and does not conflict with this rule.

#### Phase Table

| Phase | Goal | Frequency | Intensity | Volume | Focus |
|-------|------|-----------|-----------|--------|-------|
| General Fitness | Build tissue tolerance, movement quality | 2×/week | 60–75% 1RM | 3×10–12 | Bilateral compound, unilateral intro — sub-threshold by design; RE gain is not the goal here |
| Base | Hypertrophy → max strength transition | 2×/week | 70–85% 1RM | 3–4×6–10 | Heavy compound lower body, hip drive |
| Build (early) | Maximum strength | 2×/week | ≥85% 1RM | 3–5×3–6 | Peak load, low volume — this is where RE adaptations primarily occur |
| Build (late) | Strength → power transition | 2×/week | 75–85% 1RM + plyos | 3×4–6 + plyos | Explosive variants, single-leg; plyometric complement introduced here only |
| Peak | Strength maintenance | 1×/week | ≥80% 1RM | 2–3×3–5 | Maintain neural adaptations, minimal fatigue; 1×/week = lowest fatigue cost while preserving gains |
| Taper W1 | Keep motor patterns fresh | 1×/week | ≥75% 1RM | 2×4–6 | Reduced volume, maintained intensity — neural pattern retention without new load stress |
| Taper W2+ | 0 | — | — | — | — |
| Race Week | 0 | — | — | — | — |

#### Why Early Phases Are Sub-Threshold

General Fitness and Base use 60–85% 1RM, below the ≥80% threshold for significant RE gains. This is intentional: connective tissue (tendons, ligaments) adapts more slowly than muscle. Starting at lower loads and higher rep ranges builds tissue tolerance before progressing to heavy loads. Running heavy resistance from week 1 without prior adaptation base increases injury risk without commensurate benefit.

The Base-to-Build transition (85% → ≥85% 1RM) is intentionally continuous, not a hard step. Athletes in late Base who are handling 85% comfortably begin progressing into Build-early territory. The phase label is a guideline, not a gate.

#### Taper W1 Load Note

Taper W1 reduces volume but maintains relative intensity (≥75% 1RM). The rationale: in Taper, the goal is to arrive at the start line fresh while retaining neuromuscular adaptations. Volume reduction achieves the former; maintaining intensity prevents neural detraining. Dropping load significantly (below 70%) in Taper W1 shifts the session toward hypertrophic stimulus, which is the wrong direction and increases muscle soreness risk in race week.

#### Example Exercises (reference, not prescriptive)

- **Lower body compound:** squat, trap bar deadlift, Romanian deadlift
- **Unilateral:** Bulgarian split squat, single-leg press, step-up
- **Hip/glute:** hip thrust, cable pull-through
- **Calf/Achilles:** heavy single-leg calf raise (seated + standing), loaded drop
- **Plyometric complement (Build late only):** box jump, broad jump, single-leg hop

---

### Section 4 — What Not To Do (Plan Generation Anti-Patterns)

Rules the plan engine must not violate:

1. **No strength on quality days or the day immediately before or after a quality session** — Concurrent strength impairs adaptation in both directions: pre-quality compromises session performance; post-quality means recovering from two hard efforts simultaneously. Schedule strength on easy run days that are not adjacent to a quality session in either direction.
2. **No strength on the day immediately before the long run** — Pre-effort fatigue compromises long run quality and increases injury risk. The day after the long run is acceptable (post-effort fatigue is not the concern; see `quality-and-strength-placement.md` for full rationale).
3. **No plyometrics as the primary intervention** — Plyometrics alone show no significant RE effect at marathon-relevant speeds. They are a complement to heavy resistance in Build (late), not a substitute.
4. **No high-volume strength in Peak** — Volume drops to maintenance level (2–3×3–5). Accumulating new strength stimulus in Peak generates fatigue without time to adapt before race day.
5. **No new exercises in Taper or Peak** — Novel movement patterns cause DOMS. Only exercises established earlier in the plan.
6. **Don't start strength late** — The cited interventions ran 10–14 weeks before RE gains were measured. For plans shorter than 12 weeks where strength would not begin until Build, still include strength sessions but note to the user that RE adaptations may not fully materialize before race day.

---

### Section 5 — Gaps and Uncertainties

- **Exercise selection RCTs are limited** — Most evidence measures RE and time-trial outcomes but doesn't compare specific exercises head-to-head. "Heavy compound lower body" is supported; which specific compound lift is optimal is not established.
- **Optimal load periodization is unresolved** — The hypertrophy → max strength → power arc is coaching consensus and theoretically grounded, but no RCT has tested this specific sequence for marathon runners vs. alternatives.
- **Plyometric volume thresholds** — Evidence doesn't establish a minimum effective dose for plyometrics as a complement to heavy resistance. Current guidance (Build late only, low volume) is conservative.
- **Female runners** — Most meta-analyses skew male. Whether loading parameters differ meaningfully for female athletes is an open question.
- **Core training programming** — `CLAUDE.md` specifies 3×/week core as a distinct intervention. This document specifies core frequency by phase but does not specify phase-by-phase core exercise selection or volume. Core programming details are deferred to a future document or coach guidance.

---

## Output File

`docs/training-science/strength-training-science.md`

## Sources to Cite

- [PMC11052887](https://pmc.ncbi.nlm.nih.gov/articles/PMC11052887/) — Strength training for runners meta-analysis (2024, 31 studies, 652 runners)
- [PMC9653533](https://pmc.ncbi.nlm.nih.gov/articles/PMC9653533/) — Heavy resistance vs. plyometrics (2022)

## Related Documents to Update

After writing the output document, the following items in `modern-marathon-science.md` should be updated:
- Strength Training scheduling section: note Peak 1×/week and Taper W1-only rules
- Gaps section: remove the "strength-after-easy-run" gap entry (it is covered in `quality-and-strength-placement.md`)
