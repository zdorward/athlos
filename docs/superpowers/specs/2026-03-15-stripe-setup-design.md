# Stripe Setup Design

**Date:** 2026-03-15
**Status:** Approved

## Overview

Add Stripe Billing + Customer Portal to Athlos to support a freemium model. The implementation is intentionally minimal — no paid features exist yet, so the goal is to wire up the billing infrastructure so it's ready when needed.

## Business Model

- **Target market:** Serious marathon runners chasing BQ times
- **Free tier:** Full AI plan generation, pre-auth (generates before sign-in, saves after)
- **Pro tier:** Hybrid run+lift plans, adaptive mid-cycle adjustments, watch data integration (future)
- **Monetization:** Stripe Checkout + Customer Portal, single recurring subscription price

## Data Model

Two columns added to the existing `user` table in `packages/db/src/schema.ts`:

```ts
stripeCustomerId: text("stripe_customer_id")          // nullable, set on first checkout
plan: text("plan").notNull().default("free")           // "free" | "pro"
```

No new tables. A user is pro if `plan = "pro"`. This is the only value checked when gating features.

## API Routes

Three new routes under `apps/web/app/api/stripe/`:

| Route | Method | Purpose |
|---|---|---|
| `/api/stripe/checkout` | POST | Creates Stripe Checkout session, returns URL |
| `/api/stripe/portal` | POST | Creates Customer Portal session, returns URL |
| `/api/stripe/webhook` | POST | Handles Stripe events (no auth, signature-verified) |

Checkout and portal routes require the user to be signed in. Both return a URL — the frontend redirects to it. No Stripe UI embedded in the app.

Checkout session uses:
- `success_url`: `/dashboard?upgraded=true` — dashboard detects this param and shows a one-time success banner, then re-fetches the user's plan
- `cancel_url`: `/settings`

Portal route requires `stripeCustomerId` to be set. If it is null (user has never checked out), return a 400 — the portal button should only be shown to users who have previously subscribed.

### Webhook events handled

- `checkout.session.completed` → save `stripeCustomerId` on user (plan is set by subscription event)
- `customer.subscription.updated` → if `status` is `"active"` or `"trialing"` set `plan = "pro"`, otherwise set `plan = "free"`
- `customer.subscription.deleted` → set `plan = "free"`

`subscription.updated` is the single source of truth for plan status — it handles both upgrades and downgrades, including payment recovery after lapse. All other events are ignored.

The `stripe` npm package is used server-side for all Stripe API calls and webhook signature verification.

## Environment Variables

```
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
```

One Product ("Athlos Pro") with one recurring Price created in the Stripe dashboard. The price ID is stored in `STRIPE_PRO_PRICE_ID`.

## Paywalling

A single server utility `getUserPlan(userId): Promise<"free" | "pro">` reads `user.plan` from the DB and returns the value. The caller decides what to do — API routes return 403, page routes redirect. No middleware, no complex permission layer.

No paid features exist yet, so `getUserPlan` has no call sites in this implementation. It is defined and exported so it is ready to use when the first paid feature is built.

## What This Does Not Include

- Any paid features (to be designed separately)
- Stripe Elements or embedded payment UI
- Multiple tiers or prices
- Trial periods
- Usage-based billing
