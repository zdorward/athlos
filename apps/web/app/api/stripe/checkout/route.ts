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
