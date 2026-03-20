"use client"

import { useRef, useState } from "react"
import { Search } from "lucide-react"
import { format, parseISO } from "date-fns"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Calendar } from "@workspace/ui/components/calendar"
import { cn } from "@workspace/ui/lib/utils"
import { RACES, type Race } from "@/data/races"
import { DISTANCE_LABELS, type Distance, type RaceData, type StepProps } from "../types"

export function StepFindRace({ formData, onNext }: Pick<StepProps, "formData" | "onNext">) {
  const [query, setQuery] = useState("")
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const filtered =
    query.trim() === ""
      ? RACES
      : RACES.filter((r) => {
          const q = query.toLowerCase()
          return (
            r.name.toLowerCase().includes(q) ||
            r.city.toLowerCase().includes(q) ||
            r.region.toLowerCase().includes(q) ||
            r.country.toLowerCase().includes(q)
          )
        })

  const isOpen = dropdownOpen || query.trim() !== ""

  function handleSelect(race: Race) {
    const raceData: RaceData = {
      name: race.name,
      city: `${race.city}, ${race.region}`,
      date: parseISO(race.date),
      distance: race.distance,
    }
    onNext({ goal: "race", race: raceData })
  }

  function handleManualSubmit(raceData: RaceData) {
    onNext({ goal: "race", race: raceData })
  }

  if (showManual) {
    return (
      <ManualRaceForm
        onBack={() => setShowManual(false)}
        onSubmit={handleManualSubmit}
      />
    )
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Which race are you training for?</h2>
        <p className="text-sm text-muted-foreground">Search by name or city.</p>
      </div>

      <div ref={wrapRef} className="relative">
        <div className={cn(
          "flex items-center gap-3 h-12 px-4 border bg-muted/50 transition-colors",
          isOpen ? "rounded-t-xl border-primary/50" : "rounded-xl border-border",
        )}>
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            autoFocus
            placeholder="Search races…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setDropdownOpen(true)}
            onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
            className="flex-1 bg-transparent outline-none text-base placeholder:text-muted-foreground"
          />
        </div>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 z-20 bg-background border border-t-0 border-border rounded-b-xl overflow-hidden shadow-lg">
            <div className="max-h-52 overflow-y-auto">
              {filtered.length > 0 ? (
                filtered.map((race) => (
                  <button
                    key={race.id}
                    onMouseDown={() => handleSelect(race)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-muted/60 transition-colors border-b border-border/40 last:border-0 cursor-pointer"
                  >
                    <div>
                      <p className="text-sm font-medium">{race.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {race.city}, {race.region} · {format(parseISO(race.date), "MMM d, yyyy")}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-primary/70 bg-primary/10 border border-primary/20 rounded px-1.5 py-0.5 shrink-0 ml-4">
                      {DISTANCE_LABELS[race.distance]}
                    </span>
                  </button>
                ))
              ) : (
                <p className="px-4 py-3 text-sm text-muted-foreground">
                  No races found for &ldquo;{query}&rdquo;
                </p>
              )}
            </div>
            <button
              onMouseDown={() => { setDropdownOpen(false); setShowManual(true) }}
              className="w-full px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground border-t border-border transition-colors text-center cursor-pointer"
            >
              Don&apos;t see yours? Add it manually →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ManualRaceForm({
  onBack,
  onSubmit,
}: {
  onBack: () => void
  onSubmit: (race: RaceData) => void
}) {
  const [name, setName] = useState("")
  const [city, setCity] = useState("")
  const [date, setDate] = useState<Date | undefined>()
  const [distance, setDistance] = useState<Distance>("full")

  const isValid = name.trim() !== "" && city.trim() !== "" && date !== undefined

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Add your race</h2>
        <p className="text-sm text-muted-foreground">
          Can&apos;t find it in the list? Enter the details.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="race-name">Race name</Label>
          <Input
            id="race-name"
            placeholder="e.g. Boston Marathon"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
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
          <Label>Distance</Label>
          <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border">
            {(Object.entries(DISTANCE_LABELS) as [Distance, string][]).map(
              ([value, label], i) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDistance(value as Distance)}
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
      </div>

      <div className="space-y-3">
        <Button
          onClick={() => {
            if (isValid && date) onSubmit({ name: name.trim(), city: city.trim(), date, distance })
          }}
          disabled={!isValid}
          className="w-full"
        >
          Continue
        </Button>
        <div className="text-center">
          <button
            onClick={onBack}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            ← Back to search
          </button>
        </div>
      </div>
    </div>
  )
}
