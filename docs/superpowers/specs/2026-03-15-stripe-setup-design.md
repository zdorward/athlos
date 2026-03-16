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

### Webhook events handled

- `checkout.session.completed` → set `plan = "pro"`, save `stripeCustomerId` on user
- `customer.subscription.deleted` → set `plan = "free"`

All other events are ignored.

## Environment Variables

```
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
```

One Product ("Athlos Pro") with one recurring Price created in the Stripe dashboard. The price ID is stored in `STRIPE_PRO_PRICE_ID`.

## Paywalling

A single server utility `getUserPlan(userId): Promise<"free" | "pro">` reads `user.plan` from the DB. Called at the point of need when a paid feature is accessed. Returns 403 or redirects if the user is on the free tier.

No middleware, no complex permission layer.

## What This Does Not Include

- Any paid features (to be designed separately)
- Stripe Elements or embedded payment UI
- Multiple tiers or prices
- Trial periods
- Usage-based billing
