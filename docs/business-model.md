# Athlos Business Model Exploration

_Last updated: 2026-03-16_

## Context

Athlos is an adaptive training system for hybrid athletes (running + lifting). The core differentiator is intelligent plan adaptation based on performance, recovery, and goals — not just static plan generation.

---

## Options Evaluated

### 1. Subscription (monthly/annual) — **recommended**

Adaptive training is an ongoing relationship. Users who see results stay for months. Predictable MRR funds the AI/data flywheel that creates defensibility.

- Suggested range: $15–25/mo or $120–180/yr
- Hybrid athletes are self-selecting; willing to pay for specificity
- The product compounds in value over time — subscription pricing reflects this

### 2. Freemium (limited free → subscription)

Works best if the free tier *demonstrates* the adaptive logic without fully delivering on it.

- Free: static plan, no adaptation, no re-generation
- Paid: adaptive adjustments, re-generation after workouts, historical analysis
- Risk: hybrid athletes are a small TAM; can't rely on volume alone to make conversion math work
- Risk: users may churn before reaching the "aha moment" if the free plan feels indistinguishable from a generic app

### 3. Coaching Marketplace (B2B2C)

Coaches buy tool access → athletes subscribe through coaches. Higher ACV, lower CAC.

- Coaches (CrossFit, HYROX, endurance) pay for programming tools that scale their client base
- Athletes get coach-guided adaptive plans
- Coaches become the acquisition channel
- Higher-ceiling play but more complex to build and sell
- Best as a Phase 2 expansion after direct-to-consumer proves the core

### 4. Usage-based

Doesn't fit. Training needs continuity. Usage-based removes the incentive to keep improving the product and doesn't match how athletes budget for training tools.

### 5. One-time purchase

Doesn't fit. Same reasons as usage-based — no recurring revenue to invest in adaptation quality.

---

## Current Recommendation

**Start with subscription + time-limited trial (14–30 days full access).**

The product only proves its value if someone trains through a full adaptation cycle — that takes weeks. A permanent free tier may not allow users to reach the aha moment before churning.

Long-term: build toward coaching marketplace as the B2B expansion once direct-to-consumer is validated.

---

## Plan Generation & Front-Loading Value

### Current Architecture

The onboarding → plan generation flow is well-structured for front-loading:

1. User completes 6–7 onboarding steps (race, goal time, training age, days, strength, mileage)
2. Clicks "Build My Plan" on the final screen
3. Plan streams in real-time — user sees it being built week by week
4. No account required to generate or view the plan
5. Sign-in is only prompted when the user tries to **save** the plan

This is a strong front-loaded approach: the user receives full value (a complete, personalized training plan) before any account or payment commitment.

### Strengths

- Zero friction to value — no account wall before seeing the plan
- Streaming creates a sense of work being done on their behalf ("this is being built for me")
- Plan snapshot persists across OAuth redirect, so the save flow doesn't lose the generated plan
- The plan includes phases, running + strength integration, and goal-time pacing — clearly not a generic template

### Gaps to Address

1. **The adaptation is invisible** — the initial plan looks static. The core differentiator (adaptive re-generation based on performance) isn't felt until the user starts logging workouts. Consider surfacing this in the UI: "Your plan will adapt as you train."

2. **Long onboarding before any payoff** — 6–7 steps before the user sees anything. Consider whether a partial plan preview or a "here's what your week might look like" teaser can be shown earlier in the flow to sustain intent.

3. **The paywall moment is unclear** — currently sign-in is the only gate, and it's framed as "save your plan." If the business model is subscription, the paywall needs to appear at the right moment: after the user has felt value, before they can act on it (e.g., after viewing week 1 of their plan, before accessing week 2+ or adaptive features).

4. **Free plan vs. paid plan distinction** — there's no visible distinction yet. The Stripe integration exists but what it gates isn't defined in the UI.

### Front-Loading Recommendations

| When | What to show |
|------|-------------|
| During onboarding | Brief preview of what their plan structure will look like (e.g. "Your plan will be ~18 weeks, peaking at ~65km/week") |
| Plan generation complete | Prominently surface the adaptive value: "As you log workouts, Athlos will adjust this plan in real time" |
| Save / subscribe moment | Show the full week 1 for free; gate weeks 2+ or adaptive features behind a trial start |
| Post-trial | Re-generate plan based on first 2 weeks of logged data as the trial conversion hook |

---

## Decision Log

- 2026-03-16: Exploring business model options; leaning toward subscription + trial over freemium due to small TAM and need for users to reach adaptation aha moment
- 2026-03-16: Identified coaching marketplace as the strongest long-term expansion play
