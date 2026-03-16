import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { eq, desc } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db, plans } from "@workspace/db"
import { AppNav } from "./components/app-nav"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/")

  const userPlans = await db
    .select({ id: plans.id })
    .from(plans)
    .where(eq(plans.userId, session.user.id))
    .orderBy(desc(plans.createdAt))
    .limit(1)

  const planHref = userPlans[0] ? `/plan/${userPlans[0].id}` : "/plan-empty"

  return (
    <div>
      <AppNav
        user={{
          name: session.user.name,
          email: session.user.email,
          image: session.user.image ?? null,
        }}
        planHref={planHref}
      />
      <main className="md:pt-16 pb-16 md:pb-0">
        {children}
      </main>
    </div>
  )
}
