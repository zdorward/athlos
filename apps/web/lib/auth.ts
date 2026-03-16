import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { magicLink } from "better-auth/plugins"
import { dash } from "@better-auth/infra"
import { Resend } from "resend"
import { db } from "@workspace/db"
import * as schema from "@workspace/db/schema"

// Defer initialization to request time so this module can be imported during
// `next build` without BETTER_AUTH_SECRET / BETTER_AUTH_URL being set.
function createAuth() {
  return betterAuth({
      secret: process.env.BETTER_AUTH_SECRET!,
      trustedOrigins: process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",").map(s => s.trim()).filter(Boolean) ?? [],
      database: drizzleAdapter(db, {
        provider: "pg",
        schema,
      }),
      socialProviders: {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
      },
      user: {
        additionalFields: {
          units: {
            type: "string",
            defaultValue: "km",
            required: false,
          },
        },
      },
      plugins: [
        dash(),
        magicLink({
          sendMagicLink: async ({ email, url }) => {
            await new Resend(process.env.RESEND_API_KEY).emails.send({
              from: "Athlos <hello@athlos.run>",
              to: email,
              subject: "Sign in to Athlos",
              html: `<p>Click the link below to sign in to Athlos:</p><p><a href="${url}">${url}</a></p>`,
            })
          },
        }),
      ],
  })
}

let _auth: ReturnType<typeof createAuth> | undefined
function getAuth() {
  return (_auth ??= createAuth())
}

export const auth = new Proxy({} as ReturnType<typeof createAuth>, {
  get(_t, prop) {
    const a = getAuth()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const val = (a as any)[prop]
    return typeof val === "function" ? (val as (...args: unknown[]) => unknown).bind(a) : val
  },
  has(_t, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return prop in (getAuth() as any)
  },
})
