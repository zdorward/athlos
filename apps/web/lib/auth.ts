import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { magicLink } from "better-auth/plugins"
import { Resend } from "resend"
import { db } from "@workspace/db"
import * as schema from "@workspace/db/schema"

const resend = new Resend(process.env.RESEND_API_KEY)

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
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
          from: "Athlos <onboarding@resend.dev>",
          to: email,
          subject: "Sign in to Athlos",
          html: `<p>Click the link below to sign in to Athlos:</p><p><a href="${url}">${url}</a></p>`,
        })
      },
    }),
  ],
})
