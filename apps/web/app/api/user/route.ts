import { type NextRequest } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { eq } from "drizzle-orm"
import { db, user } from "@workspace/db"

interface UpdateUserBody {
  units: "km" | "miles"
}

function isValidUnits(value: unknown): value is "km" | "miles" {
  return value === "km" || value === "miles"
}

export async function PATCH(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: UpdateUserBody
  try {
    const parsed = (await req.json()) as Record<string, unknown>
    if (!isValidUnits(parsed.units)) {
      return Response.json({ error: "Invalid body" }, { status: 400 })
    }
    body = { units: parsed.units }
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 })
  }

  await auth.api.updateUser({
    body: { units: body.units },
    headers: await headers(),
  })

  return Response.json({ units: body.units })
}

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
