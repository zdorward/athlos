# Why Athlos Is Genuinely Good

Read this when you're wondering if what you're building matters.

---

## The problem you solved that nobody else has

Every serious marathon runner faces the same situation: they want to qualify for Boston, they know about Pfitzinger, and they're also doing strength training. Their options are:

1. **Buy the book.** The plan is static. It doesn't know you missed Tuesday's run because your legs were wrecked. It doesn't know you do squats. It doesn't know your goal time. You transcribe it into a spreadsheet and hope.

2. **Hire a coach.** $200–400/month on TrainingPeaks. Most people can't or won't do this.

3. **Use Runna.** Generic plan, no real Pfitzinger structure, strength training is an afterthought bolted on.

4. **Use Intervals.icu or Runalyze.** These don't generate plans. They analyse data from a plan you already have.

**You built the thing that was missing:** a Pfitzinger-structured plan that actually knows about strength training, adapts when training tells it to, and costs less than a coaching session.

---

## The insights that make this different

**Insight 1: Strength training and running aren't separate.** Every other tool treats them as separate domains. You scheduled them together from day one, understanding that a hard squat session the day before a tempo run is a problem, and that most hybrid athletes are managing exactly this tension every week.

**Insight 2: "Hard" means different things.** A hard tempo run is supposed to be hard. An easy run that felt brutal is a signal. You built a system that distinguishes between the two — `expectedEffort` derived from workout type at log time, compared against `actualEffort` from the athlete. Nobody else makes this distinction automatically.

**Insight 3: Athlete-approved adaptation.** The plan never changes silently. Suggestions are proposals, not edits. This is right because athletes have context the system doesn't — a hard run before a race might be intentional. Trust is built by transparency, not automation.

**Insight 4: Freemium works here because plan generation is the hook.** Getting a personalised Pfitzinger-structured plan in 2 minutes — free — is a genuinely surprising experience. Nobody expects it to be that fast or that structured. That's the moment that converts.

---

## What you've actually built (shipped)

- AI plan generation grounded in Pfitzinger's periodisation principles (base → build → peak → taper), with phases, pace zones, and weekly mileage calibrated to a specific goal time
- Hybrid athlete scheduling: strength days placed to not compromise key runs
- Post-workout feedback loop: effort rating + soreness, rolling 7-day adaptation trigger
- Athlete-approved swap suggestions: specific replacement workouts proposed, never silently applied
- Plan editing: athletes can override anything
- Auth, persistence, Stripe infrastructure — the boring stuff that makes a real product

---

## Who this is for (and why they'll pay)

BQ qualifiers are a specific, knowable person:
- They've run a few marathons and know they're capable of more
- They've read Pfitzinger or know who he is
- They're probably doing some strength training
- They're frustrated that no tool understands both halves of their training
- They spend money on running — shoes, races, nutrition. A training tool at $20–30/month is nothing compared to a $200 race entry

This is not a casual jogger product. That's a feature, not a bug. A focused audience with a real problem is where products win.

---

## The competitive position

| | Pfitz structure | Strength integrated | Adaptive | Plan generation | Price |
|---|---|---|---|---|---|
| **Athlos** | ✅ | ✅ | ✅ | ✅ | Freemium |
| Runna | ❌ | Partial | Basic | ✅ | $20/mo |
| TrainingPeaks + coach | ✅ | Manual | Manual | Manual | $200+/mo |
| Intervals.icu | ❌ | ❌ | ❌ | ❌ | Free |
| Pfitz book | ✅ | ❌ | ❌ | ❌ | $20 once |

The gap in that table is real. You're filling it.

---

## What's next that matters

The one thing that would dramatically increase stickiness: **plan vs. actual tracking**. Once athletes are logging workouts, they want to see the delta. "I planned 65 km this week, I ran 58 km" — that single insight is what Intervals.icu gives people and why they check it daily. You have all the data. It's just not surfaced yet.

After that: Strava/Garmin sync. Remove the logging friction entirely and the adaptive system becomes automatic.

---

Keep building.
