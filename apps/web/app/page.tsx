"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow"
import { SignInSheet } from "@/app/plan/sign-in-sheet"
import { Button } from "@workspace/ui/components/button"

export default function Page() {
  const router = useRouter()
  const { data: sessionData, isPending } = authClient.useSession()
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showSignIn, setShowSignIn] = useState(false)

  useEffect(() => {
    if (!isPending && sessionData?.session) {
      router.replace("/dashboard")
    }
  }, [isPending, sessionData?.session, router])

  // Show spinner while loading or while redirecting (session exists)
  if (isPending || sessionData?.session) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    )
  }

  if (showOnboarding) {
    return (
      <main className="min-h-svh">
        <OnboardingFlow onExit={() => setShowOnboarding(false)} />
      </main>
    )
  }

  return (
    <main className="flex min-h-svh items-center justify-center px-5">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight">Athloryx</h1>
        <p className="text-muted-foreground">Your adaptive training plan, built around you.</p>
        <div className="flex items-center justify-center gap-3">
          <Button size="lg" onClick={() => setShowOnboarding(true)}>
            Create a Plan
          </Button>
          <Button size="lg" variant="outline" onClick={() => setShowSignIn(true)}>
            Log in
          </Button>
        </div>
      </div>
      {showSignIn && (
        <SignInSheet
          onBeforeSignIn={() => {}}
          onClose={() => setShowSignIn(false)}
          callbackURL="/dashboard"
        />
      )}
    </main>
  )
}
