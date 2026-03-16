import { type NextRequest } from "next/server"
import { eq } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db, adaptationSuggestions } from "@workspace/db"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; suggestionId: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id, suggestionId } = await params

  if (!UUID_RE.test(id) || !UUID_RE.test(suggestionId)) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  try {
    const [suggestion] = await db
      .select()
      .from(adaptationSuggestions)
      .where(eq(adaptationSuggestions.id, suggestionId))
      .limit(1)

    if (!suggestion) {
      return Response.json({ error: "Not found" }, { status: 404 })
    }

    // Verify suggestion belongs to this user AND this plan
    if (suggestion.userId !== session.user.id || suggestion.planId !== id) {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }

    // Idempotent
    if (suggestion.status !== "pending") {
      return Response.json({ ok: true })
    }

    await db
      .update(adaptationSuggestions)
      .set({ status: "dismissed", resolvedAt: new Date() })
      .where(eq(adaptationSuggestions.id, suggestionId))

    return Response.json({ ok: true })
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
