"use client"

import { useState } from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Calendar } from "@workspace/ui/components/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { cn } from "@workspace/ui/lib/utils"
import {
  DISTANCE_LABELS,
  type Distance,
  type RaceData,
} from "@/components/onboarding/types"

export function ManualRaceSheet({
  onClose,
  onSubmit,
}: {
  onClose: () => void
  onSubmit: (race: RaceData) => void
}) {
  const [name, setName] = useState("")
  const [city, setCity] = useState("")
  const [date, setDate] = useState<Date | undefined>(undefined)
  const [distance, setDistance] = useState<Distance | undefined>(undefined)

  const isValid =
    name.trim() !== "" &&
    city.trim() !== "" &&
    date !== undefined &&
    distance !== undefined

  function handleSubmit() {
    if (!isValid || !date || !distance) return
    onSubmit({ name: name.trim(), city: city.trim(), date, distance })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="w-full space-y-5 rounded-t-xl border-t border-border bg-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-border" />
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Add your race</h2>
          <p className="text-sm text-muted-foreground">
            Can&apos;t find it in the list? Enter the details manually.
          </p>
        </div>
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "MMM d, yyyy") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    disabled={(d) => d <= new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label>Distance</Label>
              <Select
                value={distance}
                onValueChange={(v) => setDistance(v as Distance)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Distance" />
                </SelectTrigger>
                <SelectContent>
                  {(
                    Object.entries(DISTANCE_LABELS) as [Distance, string][]
                  ).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <Button onClick={handleSubmit} disabled={!isValid} className="w-full">
          Continue
        </Button>
      </div>
    </div>
  )
}
