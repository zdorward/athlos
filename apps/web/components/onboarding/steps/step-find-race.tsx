"use client"

import { useState } from "react"
import { format, parseISO } from "date-fns"
import { CalendarIcon, Search, ChevronLeft } from "lucide-react"
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
import { DISTANCE_LABELS, type Distance, type StepProps } from "../types"
import { RACES, type Race } from "@/data/races"

type Mode = "search" | "manual"

function RaceCard({ race, onClick }: { race: Race; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full cursor-pointer rounded-xl border border-border bg-card p-4 text-left transition-all hover:bg-muted/50"
    >
      <div className="font-medium">{race.name}</div>
      <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
        <span>{race.city}, {race.province}</span>
        <span>·</span>
        <span>{format(parseISO(race.date), "MMM d, yyyy")}</span>
        <span>·</span>
        <span>{DISTANCE_LABELS[race.distance]}</span>
      </div>
    </button>
  )
}

export function StepFindRace({ formData, onNext }: Pick<StepProps, "formData" | "onNext">) {
  const [mode, setMode] = useState<Mode>("search")
  const [query, setQuery] = useState("")

  // Manual form state
  const existing = formData.race
  const [name, setName] = useState(existing?.name ?? "")
  const [city, setCity] = useState(existing?.city ?? "")
  const [date, setDate] = useState<Date | undefined>(existing?.date)
  const [distance, setDistance] = useState<Distance | undefined>(existing?.distance)

  const isManualValid =
    name.trim() !== "" && city.trim() !== "" && date !== undefined && distance !== undefined

  function handleRaceSelect(race: Race) {
    onNext({
      race: {
        name: race.name,
        city: `${race.city}, ${race.province}`,
        date: parseISO(race.date),
        distance: race.distance,
      },
    })
  }

  function handleManualNext() {
    if (!isManualValid || !date || !distance) return
    onNext({ race: { name: name.trim(), city: city.trim(), date, distance } })
  }

  const filtered = query.trim() === ""
    ? RACES
    : RACES.filter((r) => {
        const q = query.toLowerCase()
        return (
          r.name.toLowerCase().includes(q) ||
          r.city.toLowerCase().includes(q) ||
          r.province.toLowerCase().includes(q)
        )
      })

  if (mode === "manual") {
    return (
      <div className="space-y-6">
        <button
          onClick={() => setMode("search")}
          className="flex cursor-pointer items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Search for my race
        </button>

        <h2 className="text-2xl font-semibold tracking-tight">Add your race</h2>

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

        <Button onClick={handleManualNext} disabled={!isManualValid} className="w-full">
          Next
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-semibold tracking-tight">Find your race</h2>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by race name or city..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
          autoFocus
        />
      </div>

      <div className="max-h-72 space-y-2 overflow-y-auto">
        {filtered.length > 0 ? (
          filtered.map((race) => (
            <RaceCard key={race.id} race={race} onClick={() => handleRaceSelect(race)} />
          ))
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No races found for &ldquo;{query}&rdquo;
          </p>
        )}
      </div>

      <button
        onClick={() => setMode("manual")}
        className="w-full cursor-pointer text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        My race isn&apos;t listed — add it manually →
      </button>
    </div>
  )
}
