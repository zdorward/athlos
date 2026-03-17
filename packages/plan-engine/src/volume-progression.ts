import type { PhaseEntry } from "./types"

type WeeklyMileageRange = "under-40" | "40-60" | "60-80" | "80-plus"

export interface VolumeProgressionInput {
  totalWeeks: number
  weeklyMileageRange: WeeklyMileageRange
  peakWeeklyKm: number
  phases: PhaseEntry[]
}

const WEEK1_VOLUME_KM: Record<WeeklyMileageRange, number> = {
  "under-40": 30,
  "40-60": 40,
  "60-80": 60,
  "80-plus": 80,
}

export function computeWeeklyVolumes(input: VolumeProgressionInput): number[] {
  const { totalWeeks, weeklyMileageRange, peakWeeklyKm, phases } = input

  const taperPhase = phases.find(p => p.name === "Taper")
  const hasTaper = !!taperPhase

  const volumes: number[] = []

  for (let weekNumber = 1; weekNumber <= totalWeeks; weekNumber++) {
    const idx = weekNumber - 1
    let volume: number

    // Rule 1: taper weeks
    if (hasTaper && taperPhase && weekNumber >= taperPhase.startWeek) {
      const taperIndex = weekNumber - taperPhase.startWeek // 0-based
      const pct = taperIndex === 0 ? 0.8 : taperIndex === 1 ? 0.6 : 0.4
      volume = peakWeeklyKm * pct
    }
    // Rule 2: final non-taper week (suppresses recovery rule)
    else if (!hasTaper && weekNumber === totalWeeks) {
      volume = weekNumber === 1
        ? WEEK1_VOLUME_KM[weeklyMileageRange]
        : volumes[idx - 1]! * 1.1
    }
    // Rule 3: recovery weeks (weekNumber % 4 === 0, 1-indexed)
    else if (weekNumber % 4 === 0) {
      volume = volumes[idx - 1]! * 0.7
    }
    // Rule 4: week 1
    else if (weekNumber === 1) {
      volume = WEEK1_VOLUME_KM[weeklyMileageRange]
    }
    // Rule 5: all other weeks
    else {
      volume = volumes[idx - 1]! * 1.1
    }

    // Rule 6: cap (unconditional post-processing)
    volumes.push(Math.min(volume, peakWeeklyKm))
  }

  return volumes
}
