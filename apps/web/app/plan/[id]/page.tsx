"use client"

import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, ChevronLeft } from "lucide-react"
import Link from "next/link"
import { authClient } from "@/lib/auth-client"
import type { WorkoutDay, PlanGenerationInput } from "@workspace/ai"
import { PlanHeader } from "@/app/plan/plan-header"
import { PlanCalendar } from "@/app/plan/plan-calendar"
import { PlanFeed } from "@/app/plan/plan-feed"

interface Plan {
  id: string
  name: string
  days: WorkoutDay[]
  input: PlanGenerationInput
  totalWeeks: number
  totalKm: string
  peakWeekKm: string
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default function PlanViewPage({ params }: PageProps) {
  const { id } = use(params)
  const router = useRouter()
  const { data: sessionData, isPending: sessionPending } = authClient.useSession()

  const [plan, setPlan] = useState<Plan | null | "not-found">(null)
  const [fetching, setFetching] = useState(false)

  // Redirect if no session
  useEffect(() => {
    if (!sessionPending && !sessionData?.session) {
      router.replace("/")
    }
  }, [sessionPending, sessionData?.session, router])

  // Fetch plan once session confirmed
  useEffect(() => {
    if (!sessionPending && !sessionData?.session) return
    if (sessionPending) return

    setFetching(true)
    fetch(`/api/plans/${id}`)
      .then(async (res) => {
        if (res.status === 404 || res.status === 401) {
          setPlan("not-found")
          return
        }
        if (!res.ok) {
          setPlan("not-found")
          return
        }
        const data = (await res.json()) as { plan: Plan }
        setPlan(data.plan)
      })
      .catch(() => setPlan("not-found"))
      .finally(() => setFetching(false))
  }, [id, sessionPending, sessionData?.session])

  if (sessionPending || fetching || plan === null) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    )
  }

  if (plan === "not-found") {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-4">
        <p className="text-muted-foreground">Plan not found.</p>
        <Link
          href="/dashboard"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </main>
    )
  }

  const units = plan.input.units
  const raceDistance = plan.input.race?.distance

  return (
    <main className="min-h-svh flex flex-col">
      <PlanHeader
        planName={plan.name}
        totalWeeks={plan.totalWeeks}
        totalKm={Number(plan.totalKm)}
        units={units}
        status="complete"
        backHref="/dashboard"
      />

      {/* Desktop: calendar */}
      <div className="hidden md:block flex-1">
        <PlanCalendar
          days={plan.days}
          units={units}
          totalWeeks={plan.totalWeeks}
          raceDistance={raceDistance}
        />
      </div>

      {/* Mobile: feed */}
      <div className="md:hidden flex-1 overflow-y-auto pt-2">
        <PlanFeed
          days={plan.days}
          units={units}
          totalWeeks={plan.totalWeeks}
          raceDistance={raceDistance}
        />
      </div>
    </main>
  )
}
