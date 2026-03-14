import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { magicLink } from "better-auth/plugins"
import { Resend } from "resend"
import { db } from "@workspace/db"
import * as schema from "@workspace/db/schema"

const resend = new Resend(process.env.RESEND_API_KEY)

export const auth = betterAuth({
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
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await resend.emails.send({
          from: "Athloryx <noreply@athloryx.com>",
          to: email,
          subject: "Sign in to Athloryx",
          html: `<p>Click the link below to sign in to Athloryx:</p><p><a href="${url}">${url}</a></p>`,
        })
      },
    }),
  ],
})
