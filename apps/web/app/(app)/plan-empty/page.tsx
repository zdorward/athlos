"use client"

import Link from "next/link"
import { Button } from "@workspace/ui/components/button"

export default function PlanEmptyPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">No plan yet</h1>
      <p className="text-muted-foreground max-w-sm">
        Build a training plan tailored to your race and schedule.
      </p>
      <Button asChild>
        <Link href="/">Create a plan</Link>
      </Button>
    </div>
  )
}
