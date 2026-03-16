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
