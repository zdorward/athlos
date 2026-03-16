"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow"

export default function NewPlanPage() {
  const router = useRouter()
  const { data: sessionData, isPending } = authClient.useSession()

  // Clear any stale draft synchronously BEFORE OnboardingFlow mounts.
  // OnboardingFlow reads sessionStorage in its useState initializers, so this
  // must happen before it renders — a useEffect would be too late.
  const [_cleared] = useState(() => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("athlos_onboarding_draft")
    }
    return true
  })

  useEffect(() => {
    if (!isPending && !sessionData?.session) router.replace("/")
  }, [isPending, sessionData?.session, router])

  if (isPending || !sessionData?.session) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    )
  }

  return (
    <main className="min-h-svh">
      <OnboardingFlow onExit={() => router.replace("/dashboard")} />
    </main>
  )
}
