import { differenceInWeeks, format } from "date-fns"
import type { ReactNode } from "react"
import { Calendar, MapPin, Timer } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@workspace/ui/components/button"
import { type Distance, type OnboardingData } from "./types"

const SESSION_KEY = "athloryx_onboarding"

const DISTANCE_KM: Record<Distance, string> = {
  "5k":   "5 km",
  "10k":  "10 km",
  "half": "21.1 km",
  "full": "42.2 km",
  "ultra": "Ultra",
}

const DISTANCE_MI: Record<Distance, string> = {
  "5k":   "3.1 mi",
  "10k":  "6.2 mi",
  "half": "13.1 mi",
  "full": "26.2 mi",
  "ultra": "Ultra",
}

interface FinalScreenProps {
  formData: OnboardingData
}

function DetailRow({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <span className="shrink-0">{icon}</span>
      <span>{text}</span>
    </div>
  )
}

export function FinalScreen({ formData }: FinalScreenProps) {
  const router = useRouter()
  const { race, goal, units } = formData

  function handleGenerate() {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(formData))
    router.push("/plan")
  }
  const isRace = goal === "race" && race

  const distanceLabel = isRace
    ? (units === "miles" ? DISTANCE_MI[race.distance] : DISTANCE_KM[race.distance])
    : null

  const weeks = isRace ? Math.max(0, differenceInWeeks(race.date, new Date())) : null

  const cityDisplay = isRace ? race.city : null

  const title = isRace
    ? `Your ${race.name} plan is nearly ready`
    : "Your aerobic base plan is nearly ready"

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>

      {isRace && (
        <div className="space-y-4">
          <DetailRow
            icon={<Timer className="h-4 w-4" />}
            text={`${weeks} weeks · ${distanceLabel}`}
          />
          <DetailRow
            icon={<Calendar className="h-4 w-4" />}
            text={format(race.date, "EEE, MMM d, yyyy")}
          />
          <DetailRow
            icon={<MapPin className="h-4 w-4" />}
            text={cityDisplay!}
          />
        </div>
      )}

      <Button className="w-full" size="lg" onClick={handleGenerate}>
        Generate Plan
      </Button>
    </div>
  )
}
