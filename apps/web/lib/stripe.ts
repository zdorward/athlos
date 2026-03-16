import Stripe from "stripe"

// Defer validation to query time so this module can be imported during `next build`
// without STRIPE_SECRET_KEY. At runtime STRIPE_SECRET_KEY must be set.
function createStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set")
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2026-02-25.clover",
  })
}

let _stripe: ReturnType<typeof createStripe> | undefined

export const stripe = new Proxy({} as ReturnType<typeof createStripe>, {
  get(_t, prop) {
    const s = (_stripe ??= createStripe())
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const val = (s as any)[prop]
    return typeof val === "function" ? (val as (...args: unknown[]) => unknown).bind(s) : val
  },
})
