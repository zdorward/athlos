"use client"

import { useState, useEffect } from "react"
import { format, parseISO } from "date-fns"
import { Star, Check } from "lucide-react"
import type { WorkoutDay, WorkoutType } from "@workspace/plan-engine"
import {
  WORKOUT_NAMES,
  WORKOUT_TEXT_CLASS,
  getWorkoutColor,
  formatDistance,
  distanceUnit,
  getWorkoutNote,
  getHRZone,
} from "./workout-utils"

const KM_TO_MILES = 0.621371

type EditForm = {
  type: WorkoutType
  distanceDisplay: string  // numeric string in display units, "" if empty
  targetHR: string
  targetPace: string
}

interface PlanDayDetailProps {
  day: WorkoutDay | null
  units: "km" | "miles"
  onClose?: () => void
  onToggleComplete?: (date: string, type: WorkoutType, completed: boolean) => void
  onSaveEdit?: (
    date: string,
    originalType: WorkoutType,
    update: {
      type?: WorkoutType
      distanceKm?: number | null
      targetHR?: string
      targetPace?: string
    }
  ) => void
}

export function PlanDayDetail({ day, units, onClose, onToggleComplete, onSaveEdit }: PlanDayDetailProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [formState, setFormState] = useState<EditForm>({
    type: "easy",
    distanceDisplay: "",
    targetHR: "",
    targetPace: "",
  })

  // Re-initialize form state each time edit mode opens
  useEffect(() => {
    if (isEditing && day) {
      setFormState({
        type: day.type,
        distanceDisplay:
          day.distanceKm != null
            ? String(+(day.distanceKm * (units === "miles" ? KM_TO_MILES : 1)).toFixed(2))
            : "",
        targetHR: day.targetHR ?? "",
        targetPace: day.targetPace ?? "",
      })
    }
  }, [isEditing]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!day) setIsEditing(false)
  }, [day])

  if (!day) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-subtle-foreground">Select a workout to see details</p>
      </div>
    )
  }

  const color = getWorkoutColor(day.type)
  const textClass = WORKOUT_TEXT_CLASS[day.type]
  const colorStyle = color ? { color } : undefined

  if (isEditing) {
    const isRest = formState.type === "rest"

    function handleSave() {
      if (!day || !onSaveEdit) return
      const update: {
        type?: WorkoutType
        distanceKm?: number | null
        targetHR?: string
        targetPace?: string
      } = {}

      if (formState.type !== day.type) update.type = formState.type

      if (formState.targetHR !== (day.targetHR ?? "")) update.targetHR = formState.targetHR
      if (formState.targetPace !== (day.targetPace ?? "")) update.targetPace = formState.targetPace

      // Distance handling
      if (isRest) {
        // If original entry had a distance, explicitly clear it
        if (day.distanceKm != null) update.distanceKm = null
      } else {
        const raw = parseFloat(formState.distanceDisplay)
        const newKm = isNaN(raw) ? null : raw / (units === "miles" ? KM_TO_MILES : 1)
        const origKm = day.distanceKm ?? null
        // Compare in display units (rounded to 2dp) to avoid float precision drift on round-trip
        const origDisplayStr =
          origKm != null
            ? String(+(origKm * (units === "miles" ? KM_TO_MILES : 1)).toFixed(2))
            : ""
        if (formState.distanceDisplay !== origDisplayStr) {
          update.distanceKm = newKm
        }
      }

      onSaveEdit(day.date, day.type, update)
      setIsEditing(false)
    }

    return (
      <div className="space-y-4 p-6">
        {onClose && (
          <button
            onClick={onClose}
            className="mb-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            ✕ Close
          </button>
        )}

        {/* Type */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle-foreground mb-1 block">
            Workout Type
          </label>
          <select
            value={formState.type}
            onChange={(e) => {
              const newType = e.target.value as WorkoutType
              setFormState((prev) => ({
                ...prev,
                type: newType,
                distanceDisplay: newType === "rest" ? "" : prev.distanceDisplay,
              }))
            }}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm cursor-pointer"
          >
            {(Object.keys(WORKOUT_NAMES) as WorkoutType[]).map((t) => (
              <option key={t} value={t}>
                {WORKOUT_NAMES[t]}
              </option>
            ))}
          </select>
        </div>

        {/* Distance — hidden for rest */}
        {!isRest && (
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle-foreground mb-1 block">
              Distance ({distanceUnit(units)})
            </label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={formState.distanceDisplay}
              onChange={(e) =>
                setFormState((prev) => ({ ...prev, distanceDisplay: e.target.value }))
              }
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="e.g. 10"
            />
          </div>
        )}

        {/* Target HR Zone */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle-foreground mb-1 block">
            Target HR Zone
          </label>
          <input
            type="text"
            value={formState.targetHR}
            onChange={(e) =>
              setFormState((prev) => ({ ...prev, targetHR: e.target.value }))
            }
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="e.g. Zone 2 (130–145 bpm)"
          />
        </div>

        {/* Target Pace */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle-foreground mb-1 block">
            Target Pace
          </label>
          <input
            type="text"
            value={formState.targetPace}
            onChange={(e) =>
              setFormState((prev) => ({ ...prev, targetPace: e.target.value }))
            }
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="e.g. 5:30–6:00/km"
          />
        </div>

        {/* Save / Cancel */}
        <div className="flex items-center gap-4 pt-2">
          <button
            onClick={handleSave}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer"
          >
            Save
          </button>
          <button
            onClick={() => setIsEditing(false)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {onClose && (
        <button
          onClick={onClose}
          className="mb-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          ✕ Close
        </button>
      )}

      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle-foreground">
            {format(parseISO(day.date), "EEEE, MMM d, yyyy")}
          </p>
          {onSaveEdit && (
            <button
              onClick={() => setIsEditing(true)}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              Edit
            </button>
          )}
        </div>
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          {day.type === "race" && <Star className="h-5 w-5 fill-primary text-primary" />}
          <span className={textClass} style={colorStyle}>
            {WORKOUT_NAMES[day.type]}
          </span>
        </h2>
      </div>

      {day.distanceKm != null && (
        <div>
          <span
            className={`text-5xl font-bold tracking-tight font-mono ${textClass}`}
            style={colorStyle}
          >
            {formatDistance(day.distanceKm, units)}
          </span>
          <span className="ml-2 text-lg text-muted-foreground">{distanceUnit(units)}</span>
        </div>
      )}

      {day.type !== "rest" && (
        <p className="text-sm text-muted-foreground">
          {getWorkoutNote(day, units)}
        </p>
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle-foreground mb-2">
          Target HR Zone
        </p>
        <p className="text-sm text-subtle-foreground">{day.targetHR ?? getHRZone(day.type)}</p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle-foreground mb-2">
          Target Pace
        </p>
        <p className="text-sm text-subtle-foreground">{day.targetPace ?? "—"}</p>
      </div>

      {day.type !== "rest" && onToggleComplete && (
        day.completed ? (
          <button
            onClick={() => onToggleComplete(day.date, day.type, false)}
            className="flex items-center gap-1.5 text-sm font-semibold text-green-600 hover:opacity-50 transition-opacity cursor-pointer"
          >
            <Check className="h-4 w-4" />
            Completed
          </button>
        ) : (
          <button
            onClick={() => onToggleComplete(day.date, day.type, true)}
            className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Mark as complete
          </button>
        )
      )}
    </div>
  )
}
