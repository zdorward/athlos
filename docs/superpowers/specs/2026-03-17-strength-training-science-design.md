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

### Section 1 — Overview

Brief framing: this doc expands the Strength Training section from `modern-marathon-science.md` into a full programming reference. States the core claim upfront: strength training is a first-class performance intervention, not supplementary. Links back to the parent doc for scheduling rules (frequency per phase, day-of-week constraints).

---

### Section 2 — Mechanism: Why Strength Training Improves Marathon Performance

Three mechanisms grounded in meta-analytic evidence:

1. **Neuromuscular efficiency** — Heavy resistance training recruits high-threshold motor units and improves rate of force development. This reduces the relative muscular effort per stride at marathon pace, delaying fatigue.

2. **Tendon stiffness and elastic energy return** — Resistance and plyometric training increases Achilles and patellar tendon stiffness. Stiffer tendons store and release more elastic energy per stride, directly improving running economy without additional metabolic cost.

3. **Running economy (RE)** — The downstream effect of 1 and 2. The 2024 meta-analysis (PMC11052887, 31 studies, 652 runners) quantified combined heavy + plyometric training at ES = −0.426 for RE. Heavy alone: ES = −0.266. Plyometrics alone: not significant at marathon-relevant speeds.

**Key implication for plan generation:** RE gains require ≥10–14 weeks of consistent resistance training. A plan must start strength sessions early enough for the adaptations to materialize before race day.

---

### Section 3 — Phase-by-Phase Programming

The core section. Each phase specifies: training goal, frequency, intensity (% 1RM), volume (sets × reps), session focus, example exercises, and key constraints.

#### Phase Table

| Phase | Goal | Frequency | Intensity | Volume | Focus |
|-------|------|-----------|-----------|--------|-------|
| General Fitness | Build tissue tolerance, movement quality | 2×/week | 60–75% 1RM | 3×10–12 | Bilateral compound, unilateral intro |
| Base | Hypertrophy → max strength transition | 2×/week | 70–85% 1RM | 3–4×6–10 | Heavy compound lower body, hip drive |
| Build (early) | Maximum strength | 2×/week | ≥85% 1RM | 3–5×3–6 | Peak load, low volume |
| Build (late) | Strength → power transition | 2×/week | 75–85% 1RM + plyos | 3×4–6 + plyos | Explosive variants, single-leg |
| Peak | Strength maintenance | 1×/week | ≥80% 1RM | 2–3×3–5 | Maintain neural adaptations, minimal fatigue |
| Taper W1 | Keep motor patterns fresh | 1×/week | 70–75% 1RM | 2×4–6 | No new stress |
| Taper W2+ | 0 | — | — | — | — |
| Race Week | 0 | — | — | — | — |

#### Example Exercises (reference, not prescriptive)

- **Lower body compound:** squat, trap bar deadlift, Romanian deadlift
- **Unilateral:** Bulgarian split squat, single-leg press, step-up
- **Hip/glute:** hip thrust, cable pull-through
- **Calf/Achilles:** heavy single-leg calf raise (seated + standing), loaded drop
- **Plyometric complement (Build late only):** box jump, broad jump, single-leg hop

---

### Section 4 — What Not To Do (Plan Generation Anti-Patterns)

Rules the plan engine must not violate:

1. **No strength on quality days** — Concurrent strength + interval/tempo sessions impair adaptation in both. Always separate by at least 24 hours; ideally on easy run days.
2. **No strength adjacent to the long run** — Avoid the day before or after the long run. Residual fatigue from heavy resistance compromises both sessions.
3. **No plyometrics as the primary intervention** — Plyometrics alone show no significant RE effect at marathon-relevant speeds. They are a complement to heavy resistance in Build (late), not a substitute.
4. **No high-volume strength in Peak** — Volume drops to maintenance level (2–3×3–5). Accumulating new strength stimulus in Peak generates fatigue without time to adapt before race day.
5. **No new exercises in Taper or Peak** — Novel movement patterns cause DOMS. Only exercises established earlier in the plan.
6. **Don't start strength late** — RE adaptations require ≥10–14 weeks. A plan that introduces resistance training in Build or Peak won't produce meaningful gains before race day.

---

### Section 5 — Gaps and Uncertainties

- **Exercise selection RCTs are limited** — Most evidence measures RE and time-trial outcomes but doesn't compare specific exercises head-to-head. "Heavy compound lower body" is supported; which specific compound lift is optimal is not established.
- **Optimal load periodization is unresolved** — The hypertrophy → max strength → power arc is coaching consensus and theoretically grounded, but no RCT has tested this specific sequence for marathon runners vs. alternatives.
- **Plyometric volume thresholds** — Evidence doesn't establish a minimum effective dose for plyometrics as a complement to heavy resistance. Current guidance (Build late only, low volume) is conservative.
- **Concurrent training interference** — Strength-after-easy-run scheduling has physiological rationale but limited direct experimental testing in marathon populations. The same-day-after vs. separate-day question is practically unstudied.
- **Female runners** — Most meta-analyses skew male. Whether loading parameters differ meaningfully for female athletes is an open question.

---

## Output File

`docs/training-science/strength-training-science.md`

## Sources to Cite

- [PMC11052887](https://pmc.ncbi.nlm.nih.gov/articles/PMC11052887/) — Strength training for runners meta-analysis (2024, 31 studies, 652 runners)
- [PMC9653533](https://pmc.ncbi.nlm.nih.gov/articles/PMC9653533/) — Heavy resistance vs. plyometrics (2022)
