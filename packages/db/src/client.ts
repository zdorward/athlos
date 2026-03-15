import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import * as schema from "./schema"

// Defer validation to query time so this module can be imported during `next build`
// without a DATABASE_URL (static page collection). At runtime DATABASE_URL must be set.
let _db: ReturnType<typeof drizzle<typeof schema>> | undefined

function getDb() {
  if (!_db) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set")
    _db = drizzle(neon(process.env.DATABASE_URL), { schema })
  }
  return _db
}

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_t, prop) {
    const d = getDb()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const val = (d as any)[prop]
    return typeof val === "function" ? (val as (...a: unknown[]) => unknown).bind(d) : val
  },
})
