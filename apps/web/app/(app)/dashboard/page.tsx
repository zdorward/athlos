// apps/web/app/(app)/dashboard/page.tsx
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { eq, desc } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db, plans } from "@workspace/db"
import { DashboardClient, type Plan } from "./dashboard-client"

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) redirect("/")

  const userPlans = await db
    .select()
    .from(plans)
    .where(eq(plans.userId, session.user.id))
    .orderBy(desc(plans.createdAt))

  const units = (session.user as { units?: "km" | "miles" }).units ?? "km"
  const plan = userPlans.length > 0 ? (userPlans[0] as unknown as Plan) : "empty"

  return <DashboardClient initialPlan={plan} units={units} />
}
