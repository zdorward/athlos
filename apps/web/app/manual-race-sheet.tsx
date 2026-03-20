"use client"

import { useState } from "react"
import { XIcon } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Calendar } from "@workspace/ui/components/calendar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@workspace/ui/components/dialog"
import { cn } from "@workspace/ui/lib/utils"
import {
  DISTANCE_LABELS,
  type Distance,
  type RaceData,
} from "@/components/onboarding/types"
import { useMediaQuery } from "@/hooks/use-media-query"

export function ManualRaceSheet({
  onClose,
  onSubmit,
}: {
  onClose: () => void
  onSubmit: (race: RaceData) => void
}) {
  const isDesktop = useMediaQuery("(min-width: 768px)")

  const fields = <ManualRaceFormFields onSubmit={onSubmit} />

  if (isDesktop) {
    return (
      <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
        <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden">
          <div className="overflow-y-auto max-h-[90dvh] p-4 space-y-4">
            <DialogHeader>
              <DialogTitle>Add your race</DialogTitle>
              <DialogDescription>
                Can&apos;t find it in the list? Enter the details manually.
              </DialogDescription>
            </DialogHeader>
            {fields}
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-h-[90dvh] overflow-y-auto space-y-5 rounded-t-xl border-t border-border bg-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-border" />
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Add your race</h2>
            <p className="text-sm text-muted-foreground">
              Can&apos;t find it in the list? Enter the details manually.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        {fields}
      </div>
    </div>
  )
}

function ManualRaceFormFields({
  onSubmit,
}: {
  onSubmit: (race: RaceData) => void
}) {
  const [name, setName] = useState("")
  const [city, setCity] = useState("")
  const [date, setDate] = useState<Date | undefined>(undefined)
  const [distance, setDistance] = useState<Distance>("full")

  const isValid =
    name.trim() !== "" &&
    city.trim() !== "" &&
    date !== undefined

  function handleSubmit() {
    if (!isValid || !date) return
    onSubmit({ name: name.trim(), city: city.trim(), date, distance })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="manual-race-name">Race name</Label>
        <Input
          id="manual-race-name"
          placeholder="e.g. Boston Marathon"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="manual-race-city">City</Label>
        <Input
          id="manual-race-city"
          placeholder="e.g. Boston, MA"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Distance</Label>
        <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border">
          {(Object.entries(DISTANCE_LABELS) as [Distance, string][]).map(
            ([value, label], i) => (
              <button
                key={value}
                type="button"
                onClick={() => setDistance(value)}
                className={cn(
                  "py-2 text-sm font-medium transition-colors",
                  i > 0 && "border-l border-border",
                  distance === value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            )
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Race date</Label>
        <div className="w-fit mx-auto rounded-lg border border-border">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            disabled={(d) => d <= new Date()}
            fixedWeeks
            initialFocus
            className="[--cell-size:2.75rem]"
          />
        </div>
      </div>
      <Button onClick={handleSubmit} disabled={!isValid} className="w-full">
        Continue
      </Button>
    </div>
  )
}
