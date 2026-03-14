import { type NextRequest } from "next/server"
import { eq, and } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db, plans } from "@workspace/db"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const [plan] = await db
    .select()
    .from(plans)
    .where(and(eq(plans.id, id), eq(plans.userId, session.user.id)))
    .limit(1)

  if (!plan) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  return Response.json({ plan })
}
