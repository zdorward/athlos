import type { PhaseEntry, WeeklyMileageRange } from "./types"

export interface VolumeProgressionInput {
  totalWeeks: number
  weeklyMileageRange: WeeklyMileageRange
  peakWeeklyKm: number
  phases: PhaseEntry[]
}

export const WEEK1_VOLUME_KM: Record<WeeklyMileageRange, number> = {
  "under-40": 30,
  "40-60": 40,
  "60-80": 60,
  "80-plus": 80,
}

export function computeWeeklyVolumes(input: VolumeProgressionInput): number[] {
  const { totalWeeks, weeklyMileageRange, peakWeeklyKm, phases } = input

  const taperPhase = phases.find(p => p.name === "Taper")
  const preTaperWeeks = taperPhase ? taperPhase.startWeek - 1 : totalWeeks
  const startVol = WEEK1_VOLUME_KM[weeklyMileageRange]

  const volumes: number[] = []

  for (let weekNumber = 1; weekNumber <= totalWeeks; weekNumber++) {
    let volume: number

    if (taperPhase && weekNumber >= taperPhase.startWeek) {
      // Taper: step down from peak
      const taperIndex = weekNumber - taperPhase.startWeek
      const pct = taperIndex === 0 ? 0.8 : taperIndex === 1 ? 0.6 : 0.4
      volume = peakWeeklyKm * pct
    } else if (preTaperWeeks <= 1) {
      volume = peakWeeklyKm
    } else {
      // Linear interpolation from startVol → peakWeeklyKm over preTaperWeeks.
      // Recovery weeks (every 4th) dip to 70% of the target for that week.
      // This guarantees peak is reached by the last pre-taper week regardless
      // of the gap between starting volume and goal peak.
      const t = (weekNumber - 1) / (preTaperWeeks - 1)
      const targetVol = startVol + (peakWeeklyKm - startVol) * t
      const isRecovery = weekNumber % 4 === 0 && weekNumber !== preTaperWeeks
      volume = isRecovery ? targetVol * 0.7 : targetVol
    }

    volumes.push(Math.min(Math.round(volume * 10) / 10, peakWeeklyKm))
  }

  return volumes
}
