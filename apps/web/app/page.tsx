import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { LandingPage } from "./landing-page"

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session) redirect("/dashboard")
  return <LandingPage />
}
