# Stripe Setup Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up Stripe Billing + Customer Portal so Athlos can accept subscriptions and manage billing when paid features are ready.

**Architecture:** Schema gets two new columns on `user` (`stripe_customer_id`, `plan`). Three API routes handle checkout session creation, portal session creation, and Stripe webhook events. A `getUserPlan` utility provides the paywall primitive for future use.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM (Neon/Postgres), Better Auth, `stripe` npm package

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `packages/db/src/schema.ts` | Modify | Add `stripeCustomerId` + `plan` to `user` table |
| `packages/db/drizzle/` | Generated | New migration for schema changes |
| `apps/web/lib/stripe.ts` | Create | Stripe client singleton |
| `apps/web/lib/get-user-plan.ts` | Create | `getUserPlan(userId)` utility |
| `apps/web/app/api/stripe/checkout/route.ts` | Create | POST — create Checkout session |
| `apps/web/app/api/stripe/portal/route.ts` | Create | POST — create Customer Portal session |
| `apps/web/app/api/stripe/webhook/route.ts` | Create | POST — handle Stripe webhook events |
| `apps/web/app/api/user/route.ts` | Modify | Add GET handler returning `plan` + `stripeCustomerId` |
| `apps/web/app/(app)/settings/page.tsx` | Modify | Add billing section (upgrade / manage buttons) |
| `apps/web/app/(app)/dashboard/page.tsx` | Modify | Add `?upgraded=true` success banner |

---

## Chunk 1: Schema, Migration, and Stripe Client

### Task 1: Add Stripe columns to user schema

**Files:**
- Modify: `packages/db/src/schema.ts`

- [ ] **Step 1: Add the two new columns to the `user` table**

In `packages/db/src/schema.ts`, update the `user` table definition to add after the `units` field:

```ts
stripeCustomerId: text("stripe_customer_id"),
plan: text("plan").notNull().default("free"),
```

The full updated `user` table should look like:

```ts
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  units: text("units").notNull().default("km"),
  stripeCustomerId: text("stripe_customer_id"),
  plan: text("plan").notNull().default("free"),
})
```

- [ ] **Step 2: Generate the migration**

```bash
pnpm --filter @workspace/db db:generate
```

Expected: a new `.sql` file appears in `packages/db/drizzle/` with `ALTER TABLE "user" ADD COLUMN "stripe_customer_id" text` and `ADD COLUMN "plan" text NOT NULL DEFAULT 'free'`.

- [ ] **Step 3: Apply the migration**

```bash
pnpm --filter @workspace/db db:migrate
```

Expected: migration applies cleanly against your Neon DB with no errors.

- [ ] **Step 4: Verify typecheck passes**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema.ts packages/db/drizzle/
git commit -m "feat: add stripe_customer_id and plan columns to user table"
```

---

### Task 2: Install Stripe and add environment variables

**Files:**
- Modify: `apps/web/package.json` (via pnpm)
- Modify: `apps/web/.env.local` (manual)

- [ ] **Step 1: Install the Stripe SDK**

```bash
pnpm --filter web add stripe
```

Expected: `"stripe"` appears in `apps/web/package.json` dependencies.

- [ ] **Step 2: Add env vars to `.env.local`**

Open `apps/web/.env.local` and add:

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_1TBRTAPcDwGJDLJ05AxdLuCh
```

Get `STRIPE_SECRET_KEY` from the Stripe dashboard → Developers → API keys (use the test key for now).
`STRIPE_WEBHOOK_SECRET` will be filled in Task 6 when you set up the webhook endpoint.

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "feat: install stripe sdk"
```

---

### Task 3: Create Stripe client singleton

**Files:**
- Create: `apps/web/lib/stripe.ts`

- [ ] **Step 1: Create the file**

```ts
// apps/web/lib/stripe.ts
import Stripe from "stripe"

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set")
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-01-27.acacia",
})
```

> Note: use whatever API version Stripe suggests in their latest SDK. Check with `npx stripe --version` or just let TypeScript infer from the installed package.

- [ ] **Step 2: Verify typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/stripe.ts
git commit -m "feat: add stripe client singleton"
```

---

### Task 4: Create getUserPlan utility

**Files:**
- Create: `apps/web/lib/get-user-plan.ts`

- [ ] **Step 1: Create the file**

```ts
// apps/web/lib/get-user-plan.ts
import { eq } from "drizzle-orm"
import { db, user } from "@workspace/db"

export async function getUserPlan(userId: string): Promise<"free" | "pro"> {
  const [row] = await db
    .select({ plan: user.plan })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  if (!row) return "free"
  return row.plan === "pro" ? "pro" : "free"
}
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/get-user-plan.ts
git commit -m "feat: add getUserPlan utility"
```

---

## Chunk 2: API Routes

### Task 5: Checkout route

**Files:**
- Create: `apps/web/app/api/stripe/checkout/route.ts`

- [ ] **Step 1: Create the route**

```ts
// apps/web/app/api/stripe/checkout/route.ts
import { type NextRequest } from "next/server"
import { eq } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { stripe } from "@/lib/stripe"
import { db, user } from "@workspace/db"

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!process.env.STRIPE_PRO_PRICE_ID) {
    return Response.json({ error: "Stripe not configured" }, { status: 500 })
  }

  // Look up existing Stripe customer to avoid creating duplicates on re-subscribe
  const [row] = await db
    .select({ stripeCustomerId: user.stripeCustomerId })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1)

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: process.env.STRIPE_PRO_PRICE_ID, quantity: 1 }],
    ...(row?.stripeCustomerId
      ? { customer: row.stripeCustomerId }
      : { customer_email: session.user.email }),
    success_url: `${baseUrl}/dashboard?upgraded=true`,
    cancel_url: `${baseUrl}/settings`,
    metadata: { userId: session.user.id },
  })

  return Response.json({ url: checkoutSession.url })
}
```

> Note: also add `NEXT_PUBLIC_APP_URL=http://localhost:3000` to `.env.local` for local dev, and set it to your production URL in your hosting environment (e.g. Vercel).

- [ ] **Step 2: Verify typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api/stripe/checkout/route.ts
git commit -m "feat: add stripe checkout session route"
```

---

### Task 6: Portal route

**Files:**
- Create: `apps/web/app/api/stripe/portal/route.ts`

- [ ] **Step 1: Create the route**

```ts
// apps/web/app/api/stripe/portal/route.ts
import { type NextRequest } from "next/server"
import { eq } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { stripe } from "@/lib/stripe"
import { db, user } from "@workspace/db"

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [row] = await db
    .select({ stripeCustomerId: user.stripeCustomerId })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1)

  if (!row?.stripeCustomerId) {
    return Response.json({ error: "No billing account found" }, { status: 400 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: row.stripeCustomerId,
    return_url: `${baseUrl}/settings`,
  })

  return Response.json({ url: portalSession.url })
}
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api/stripe/portal/route.ts
git commit -m "feat: add stripe customer portal route"
```

---

### Task 7: Webhook handler

**Files:**
- Create: `apps/web/app/api/stripe/webhook/route.ts`

The webhook uses `req.text()` (not `req.json()`) to get the raw body, which Stripe requires for signature verification.

- [ ] **Step 1: Create the route**

```ts
// apps/web/app/api/stripe/webhook/route.ts
import { type NextRequest } from "next/server"
import { eq } from "drizzle-orm"
import type Stripe from "stripe"
import { stripe } from "@/lib/stripe"
import { db, user } from "@workspace/db"

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get("stripe-signature")

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return Response.json({ error: "Missing signature" }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 400 })
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.userId
      const customerId = session.customer as string | null
      if (userId && customerId) {
        await db
          .update(user)
          .set({ stripeCustomerId: customerId })
          .where(eq(user.id, userId))
      }
      break
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription
      const customerId = sub.customer as string
      const isPro = sub.status === "active" || sub.status === "trialing"
      await db
        .update(user)
        .set({ plan: isPro ? "pro" : "free" })
        .where(eq(user.stripeCustomerId, customerId))
      break
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription
      const customerId = sub.customer as string
      await db
        .update(user)
        .set({ plan: "free" })
        .where(eq(user.stripeCustomerId, customerId))
      break
    }
  }

  return Response.json({ received: true })
}
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Register the webhook in Stripe dashboard**

Go to Stripe Dashboard → Developers → Webhooks → Add endpoint.

- Endpoint URL: `https://your-domain.com/api/stripe/webhook` (for production) or use Stripe CLI for local testing (see Step 4)
- Events to listen for: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

Copy the **Signing secret** (`whsec_...`) and add it to `.env.local` as `STRIPE_WEBHOOK_SECRET`.

- [ ] **Step 4: Test webhook locally with Stripe CLI**

Install the Stripe CLI if you haven't: `brew install stripe/stripe-cli/stripe`

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

This prints a `whsec_...` secret — use it as `STRIPE_WEBHOOK_SECRET` in `.env.local` for local testing.

In another terminal, trigger a test event:

```bash
stripe trigger customer.subscription.updated
```

Expected: your Next.js dev server logs show the webhook received and no DB errors.

> Note: `stripe trigger checkout.session.completed` will not include `metadata.userId`, so the `stripeCustomerId` save branch will silently no-op. For full end-to-end testing, complete a real test checkout (Task 8 smoke test).

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/api/stripe/webhook/route.ts
git commit -m "feat: add stripe webhook handler"
```

---

## Chunk 3: Settings Page Billing UI

### Task 8: Add billing section to settings

**Files:**
- Modify: `apps/web/app/(app)/settings/page.tsx`

The settings page already has a client component with auth session. Add a new "Billing" section below "Account" with:
- If `plan === "free"`: show an "Upgrade to Pro" button that calls `/api/stripe/checkout`
- If `plan === "pro"` and `stripeCustomerId` is set: show a "Manage billing" button that calls `/api/stripe/portal`

Better Auth's `useSession` only exposes fields declared in `additionalFields` — `plan` and `stripeCustomerId` are raw DB columns, not Better Auth fields, so they won't appear in the session. You need a GET handler on `/api/user` to return them.

The existing `/api/user` route only has a `PATCH` handler. Add a GET handler.

- [ ] **Step 1: Add GET handler to `/api/user`**

Open `apps/web/app/api/user/route.ts` and add this below the existing `PATCH` export:

```ts
import { eq } from "drizzle-orm"
import { db, user } from "@workspace/db"

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [row] = await db
    .select({ plan: user.plan, stripeCustomerId: user.stripeCustomerId })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1)

  return Response.json({
    plan: row?.plan ?? "free",
    stripeCustomerId: row?.stripeCustomerId ?? null,
  })
}
```

> Note: this file already imports `headers` from `next/headers` and `auth` from `@/lib/auth` — don't duplicate those imports. Add `eq` from `drizzle-orm` and `{ db, user }` from `@workspace/db`.

- [ ] **Step 2: Add billing state and handlers to settings page**

Add to the top of `SettingsPage`:

```ts
const [plan, setPlan] = useState<"free" | "pro">("free")
const [loadingBilling, setLoadingBilling] = useState(false)

useEffect(() => {
  fetch("/api/user")
    .then((r) => r.json())
    .then((data: { plan?: string }) => {
      if (data.plan === "pro") setPlan("pro")
    })
    .catch(() => {/* leave as free */})
}, [])

async function handleUpgrade() {
  setLoadingBilling(true)
  try {
    const res = await fetch("/api/stripe/checkout", { method: "POST" })
    const data = (await res.json()) as { url?: string }
    if (data.url) window.location.href = data.url
  } finally {
    setLoadingBilling(false)
  }
}

async function handleManageBilling() {
  setLoadingBilling(true)
  try {
    const res = await fetch("/api/stripe/portal", { method: "POST" })
    const data = (await res.json()) as { url?: string }
    if (data.url) window.location.href = data.url
  } finally {
    setLoadingBilling(false)
  }
}
```

- [ ] **Step 4: Add the billing section JSX**

Add after the Account section:

```tsx
{/* Billing */}
<section className="rounded-xl border border-border bg-card p-6 space-y-4">
  <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
    Billing
  </h2>

  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm font-medium">
        {plan === "pro" ? "Athlos Pro" : "Free plan"}
      </p>
      <p className="text-xs text-muted-foreground">
        {plan === "pro" ? "Active subscription" : "Upgrade to unlock Pro features"}
      </p>
    </div>
    {plan === "pro" ? (
      <Button
        variant="outline"
        onClick={() => void handleManageBilling()}
        disabled={loadingBilling}
      >
        {loadingBilling ? "Loading…" : "Manage billing"}
      </Button>
    ) : (
      <Button
        onClick={() => void handleUpgrade()}
        disabled={loadingBilling}
      >
        {loadingBilling ? "Loading…" : "Upgrade to Pro"}
      </Button>
    )}
  </div>
</section>
```

- [ ] **Step 5: Handle `?upgraded=true` on dashboard**

Open `apps/web/app/(app)/dashboard/page.tsx`. Make three precise edits:

**Edit 1** — add `useSearchParams` to the existing `next/navigation` import (line 5). `useRouter` is already imported — do not add it again:

```ts
import { useRouter, useSearchParams } from "next/navigation"
```

**Edit 2** — add state and effect inside `DashboardPage`, right after the `const [plan, setPlan] = useState(...)` line and before the early-return blocks for `null`, `"error"`, and `"empty"`. This ensures hooks are always called before any early return:

```ts
const searchParams = useSearchParams()
const [showUpgradedBanner, setShowUpgradedBanner] = useState(false)

useEffect(() => {
  if (searchParams.get("upgraded") === "true") {
    setShowUpgradedBanner(true)
    router.replace("/dashboard")
  }
}, [searchParams, router])
```

**Edit 3** — in the final `return` block, add the banner as the **first child** inside `<div className="mx-auto max-w-xl px-4 py-6 space-y-6">`, before the existing `{/* Race banner */}` comment:

```tsx
{showUpgradedBanner && (
  <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-3 text-sm text-primary font-medium">
    Welcome to Athlos Pro!
  </div>
)}
{/* Race banner — hidden after race date */}
```

> Note: `plan` is set to "pro" by `customer.subscription.updated`, not `checkout.session.completed`. After checkout, Stripe fires both events in quick succession. Confirm `customer.subscription.updated` is in your registered webhook events before running the smoke test.

- [ ] **Step 6: Verify typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 7: Manual smoke test**

1. Run `pnpm dev`
2. Sign in and go to `/settings` — should see Billing section with "Upgrade to Pro" button
3. Click upgrade — should redirect to Stripe-hosted Checkout page
4. Complete checkout with test card `4242 4242 4242 4242`, any future expiry, any CVC
5. Should redirect to `/dashboard?upgraded=true` → banner appears → banner disappears
6. Go back to `/settings` — should now show "Athlos Pro" with "Manage billing" button
7. Click "Manage billing" — should redirect to Stripe Customer Portal

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/(app)/settings/page.tsx apps/web/app/(app)/dashboard/page.tsx apps/web/app/api/user/route.ts
git commit -m "feat: add billing UI to settings and upgrade banner to dashboard"
```
