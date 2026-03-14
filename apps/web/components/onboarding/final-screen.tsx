import { format } from "date-fns"
import { Button } from "@workspace/ui/components/button"
import { DISTANCE_LABELS, DAY_LABELS, type OnboardingData } from "./types"

interface FinalScreenProps {
  formData: OnboardingData
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  )
}

export function FinalScreen({ formData }: FinalScreenProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold tracking-tight">Here's your plan summary</h2>

      <div className="rounded-xl border p-6 space-y-4">
        <Row
          label="Goal"
          value={formData.goal === "race" ? "Race" : "Build Aerobic Base"}
        />

        {formData.goal === "race" && formData.race && (
          <Row
            label="Race"
            value={`${formData.race.name} · ${formData.race.city} · ${format(formData.race.date, "MMM d, yyyy")} · ${DISTANCE_LABELS[formData.race.distance]}`}
          />
        )}

        <Row
          label="Training days"
          value={`${formData.daysPerWeek} days/week — ${formData.selectedDays?.map((d) => DAY_LABELS[d].short).join(", ")}`}
        />

        <Row
          label="Long run"
          value={formData.longRunDay ? DAY_LABELS[formData.longRunDay].full : "—"}
        />

        <Row label="Units" value={formData.units ?? "—"} />

        <Row
          label="Strength training"
          value={formData.strengthTraining === true ? "Yes" : "No"}
        />
      </div>

      <Button className="w-full" size="lg" onClick={() => {}}>
        Generate Plan
      </Button>
    </div>
  )
}
