"use client"

import { useState } from "react"
import { format, addDays, nextMonday, startOfToday } from "date-fns"
import { Button } from "@workspace/ui/components/button"
import { Calendar } from "@workspace/ui/components/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover"
import { CalendarIcon } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import type { StepProps } from "../types"

function toISO(date: Date): string {
  return date.toLocaleDateString("en-CA")
}

export function StepStartDate({ formData, onNext }: Pick<StepProps, "formData" | "onNext">) {
  const defaultStart = nextMonday(startOfToday())
  const [selected, setSelected] = useState<Date>(
    formData.startDate ? new Date(formData.startDate + "T00:00:00") : defaultStart,
  )

  const today = startOfToday()
  const isThisMonday = toISO(selected) === toISO(defaultStart)

  function handleNext() {
    onNext({ startDate: toISO(selected) })
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">When do you want to start?</h2>
        <p className="text-sm text-muted-foreground">
          Your plan will begin on this date.
        </p>
      </div>

      <div className="space-y-3">
        {/* Quick options */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setSelected(defaultStart)}
            className={cn(
              "rounded-xl border px-4 py-3 text-left transition-colors cursor-pointer",
              isThisMonday
                ? "border-primary bg-primary/5 text-foreground"
                : "border-border bg-muted/30 text-muted-foreground hover:border-border/80",
            )}
          >
            <p className="text-sm font-medium">This Monday</p>
            <p className="text-xs text-muted-foreground mt-0.5">{format(defaultStart, "MMM d")}</p>
          </button>
          <button
            onClick={() => setSelected(addDays(defaultStart, 7))}
            className={cn(
              "rounded-xl border px-4 py-3 text-left transition-colors cursor-pointer",
              !isThisMonday && toISO(selected) === toISO(addDays(defaultStart, 7))
                ? "border-primary bg-primary/5 text-foreground"
                : "border-border bg-muted/30 text-muted-foreground hover:border-border/80",
            )}
          >
            <p className="text-sm font-medium">Next Monday</p>
            <p className="text-xs text-muted-foreground mt-0.5">{format(addDays(defaultStart, 7), "MMM d")}</p>
          </button>
        </div>

        {/* Custom date picker */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "w-full rounded-xl border px-4 py-3 flex items-center gap-3 text-left transition-colors cursor-pointer",
                !isThisMonday && toISO(selected) !== toISO(addDays(defaultStart, 7))
                  ? "border-primary bg-primary/5"
                  : "border-border bg-muted/30 text-muted-foreground hover:border-border/80",
              )}
            >
              <CalendarIcon className="h-4 w-4 shrink-0" />
              <span className="text-sm">
                {!isThisMonday && toISO(selected) !== toISO(addDays(defaultStart, 7))
                  ? format(selected, "EEEE, MMM d")
                  : "Pick a specific date"}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selected}
              onSelect={(d) => d && setSelected(d)}
              disabled={(d) => d < today}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <Button onClick={handleNext} className="w-full">
        Next
      </Button>
    </div>
  )
}
