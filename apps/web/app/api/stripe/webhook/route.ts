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
          .set({ stripeCustomerId: customerId, plan: "pro" })
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
