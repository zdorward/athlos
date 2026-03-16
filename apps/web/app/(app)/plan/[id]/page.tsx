"use client"

import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import Link from "next/link"
import { authClient } from "@/lib/auth-client"
import type { WorkoutDay, WorkoutType, PlanGenerationInput } from "@workspace/ai"
import { PlanHeader } from "@/app/plan/plan-header"
import { PlanCalendar } from "@/app/plan/plan-calendar"
import { PlanFeed } from "@/app/plan/plan-feed"
import { Spinner } from "@workspace/ui/components/spinner"

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
  const { data: sessionData } = authClient.useSession()

  const [plan, setPlan] = useState<Plan | null | "not-found">(null)
  const [days, setDays] = useState<WorkoutDay[]>([])
  const [selectedKey, setSelectedKey] = useState<{ date: string; type: WorkoutType } | null>(null)
  const [fetching, setFetching] = useState(false)

  // Fetch plan on mount — layout already redirects unauthenticated users server-side
  useEffect(() => {
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
        setDays(data.plan.days)
      })
      .catch(() => setPlan("not-found"))
      .finally(() => setFetching(false))
  }, [id])

  // Show spinner only on initial load — don't flash on background session re-validation
  if (plan === null) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <Spinner />
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

  const units = (sessionData?.user as { units?: "km" | "miles" } | undefined)?.units
    ?? plan.input.units
    ?? "km"
  const raceDistance = plan.input.race?.distance

  async function handleStartNewPlan() {
    if (typeof plan !== "object" || plan === null) return
    if (!window.confirm("This will delete your current plan. Continue?")) return
    try {
      await fetch(`/api/plans/${plan.id}`, { method: "DELETE" })
    } catch {
      // ignore
    }
    router.push("/new-plan")
  }

  function handleToggleComplete(date: string, type: WorkoutType, completed: boolean) {
    if (typeof plan !== "object" || plan === null) return
    const prevDays = days
    const updatedDays = days.map((d) =>
      d.date === date && d.type === type ? { ...d, completed } : d,
    )
    setDays(updatedDays)
    fetch(`/api/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, type, completed }),
    }).catch(() => {
      setDays(prevDays)
    })
  }

  function handleSaveEdit(
    date: string,
    originalType: WorkoutType,
    update: {
      type?: WorkoutType
      distanceKm?: number | null
      description?: string
      targetHR?: string
      targetPace?: string
    }
  ) {
    if (typeof plan !== "object" || plan === null) return
    const prevDays = days
    const prevSelectedKey = selectedKey

    const updatedDays = days.map((d) => {
      if (d.date !== date || d.type !== originalType) return d
      const next = { ...d }
      if (update.type !== undefined) next.type = update.type
      if (update.description !== undefined) next.description = update.description
      if (update.targetHR !== undefined) next.targetHR = update.targetHR
      if (update.targetPace !== undefined) next.targetPace = update.targetPace
      if ("distanceKm" in update) {
        if (update.distanceKm === null) {
          delete next.distanceKm
        } else if (update.distanceKm !== undefined) {
          next.distanceKm = update.distanceKm
        }
      }
      return next
    })
    setDays(updatedDays)

    if (update.type !== undefined && update.type !== originalType) {
      setSelectedKey({ date, type: update.type })
    }

    fetch(`/api/plans/${plan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, type: originalType, update }),
    }).then((res) => {
      if (!res.ok) throw new Error()
    }).catch(() => {
      setDays(prevDays)
      setSelectedKey(prevSelectedKey)
    })
  }

  return (
    <main className="min-h-svh flex flex-col">
      <PlanHeader
        planName={plan.name}
        totalWeeks={plan.totalWeeks}
        totalKm={Number(plan.totalKm)}
        units={units}
        status="complete"
        backHref="/dashboard"
        onNewPlan={() => void handleStartNewPlan()}
      />

      {/* Desktop: calendar */}
      <div className="hidden md:block flex-1">
        <PlanCalendar
          days={days}
          units={units}
          totalWeeks={plan.totalWeeks}
          raceDistance={raceDistance}
          onToggleComplete={handleToggleComplete}
          onSaveEdit={handleSaveEdit}
          selectedKey={selectedKey}
          onSelectedKeyChange={setSelectedKey}
        />
      </div>

      {/* Mobile: feed */}
      <div className="md:hidden flex-1 overflow-y-auto pt-2">
        <PlanFeed
          days={days}
          units={units}
          totalWeeks={plan.totalWeeks}
          raceDistance={raceDistance}
          onToggleComplete={handleToggleComplete}
          onSaveEdit={handleSaveEdit}
          selectedKey={selectedKey}
          onSelectedKeyChange={setSelectedKey}
        />
      </div>
    </main>
  )
}
