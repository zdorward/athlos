# Athlos Roadmap

Adaptive marathon training for hybrid athletes targeting BQ qualification. Freemium model — plan generation free, advanced features paid.

---

## Shipped

- **Plan generation** — AI-powered week-by-week marathon plan from race + goal time + schedule
- **Onboarding** — race search, goal time, training age, running days, strength days, weekly mileage
- **Plan view** — calendar (desktop) + feed (mobile), workout detail, plan editing
- **Workout completion** — mark workouts done, effort logging
- **Adaptive training** — post-workout feedback (effort + soreness), 7-day rolling trigger, swap suggestions with athlete approval
- **Auth** — sign in with Google/GitHub, session persistence
- **Stripe** — billing infrastructure in place

---

## Now

> Active development focus

- Bug fixes and polish from early user feedback
- Freemium gating — define what's free vs. paid and enforce it

---

## Next

> Highest-impact features for BQ audience

**Plan vs. actual tracking**
The clearest gap vs. Intervals.icu. Athletes need to see planned vs. logged mileage per week, and understand how missed or modified sessions affect the plan. Foundation for everything else.

**Strava / Garmin integration**
Auto-populate workout completion and effort from device data. Removes the manual logging step. The `workout_logs` schema already has `sourceActivityId` and `externalHR` extension points.

**Pending suggestions on dashboard mount**
Currently suggestions only surface immediately after logging. If the user closes the app and returns, the pending suggestion is lost from view. Needs to be fetched on dashboard load.

---

## Later

> Meaningful but not blocking growth

**Multi-week adaptation**
After Strava/Garmin: detect deload patterns across 2+ weeks. Propose a recovery week by shifting plan structure rather than single-session swaps.

**Training load charts**
CTL/ATL/TSB (fitness/fatigue/form) curves over time. The data is already in `workout_logs`. High value for BQ athletes who understand training load concepts.

**Race performance prediction**
Estimate finish time from recent training data. Useful for goal-setting and mid-cycle recalibration.

**Mobile app**
PWA or React Native. Web-first until there's enough usage to justify the investment.

---

## Out of scope (for now)

- AI-generated coaching commentary
- Social / community features
- Non-running sports (cycling, triathlon)
- Multi-user / team plans
