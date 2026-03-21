// apps/web/app/(app)/dashboard/page.tsx
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { eq, desc } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db, plans } from "@workspace/db"
import { computePhases, type WeeklyMileageRange } from "@workspace/plan-engine"
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

  let plan: Plan | "empty" = "empty"
  if (userPlans.length > 0) {
    const raw = userPlans[0] as unknown as Plan
    const input = raw.input as { race?: { distance?: string }; weeklyMileageRange?: string } | undefined
    const phases = input?.race?.distance && input?.weeklyMileageRange
      ? computePhases(raw.totalWeeks, input.race.distance as "half" | "full", input.weeklyMileageRange as WeeklyMileageRange)
      : undefined
    plan = { ...raw, phases }
  }

  return <DashboardClient initialPlan={plan} units={units} />
}
