"use client"

import { useState } from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Calendar } from "@workspace/ui/components/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { cn } from "@workspace/ui/lib/utils"
import { DISTANCE_LABELS, type Distance, type OnboardingData } from "../types"

interface StepFindRaceProps {
  formData: OnboardingData
  onNext: (data: Partial<OnboardingData>) => void
  onBack: () => void
}

export function StepFindRace({ formData, onNext }: StepFindRaceProps) {
  const existing = formData.race
  const [name, setName] = useState(existing?.name ?? "")
  const [city, setCity] = useState(existing?.city ?? "")
  const [date, setDate] = useState<Date | undefined>(existing?.date)
  const [distance, setDistance] = useState<Distance | undefined>(existing?.distance)

  const isValid =
    name.trim() !== "" && city.trim() !== "" && date !== undefined && distance !== undefined

  function handleNext() {
    if (!isValid || !date || !distance) return
    onNext({ race: { name: name.trim(), city: city.trim(), date, distance } })
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">Tell us about your race</h2>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="race-name">Race Name</Label>
          <Input
            id="race-name"
            placeholder="e.g. Boston Marathon"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="race-city">City</Label>
          <Input
            id="race-city"
            placeholder="e.g. Boston, MA"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </div>

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
                {date ? format(date, "MMMM d, yyyy") : "Pick a date"}
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
          <Select value={distance} onValueChange={(v) => setDistance(v as Distance)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a distance" />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(DISTANCE_LABELS) as [Distance, string][]).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button onClick={handleNext} disabled={!isValid} className="w-full">
        Next
      </Button>
    </div>
  )
}
