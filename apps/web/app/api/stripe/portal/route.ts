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
