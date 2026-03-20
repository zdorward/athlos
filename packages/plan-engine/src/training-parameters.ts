/**
 * Return a soft target peak mileage range (km/week) for the given race distance
 * and goal time. The LLM uses this as a guideline, not a hard cap.
 *
 * Returns null for ultra (too variable) and invalid input (goalTotalMinutes <= 0).
 * Bucket boundaries are lower-bound inclusive, upper-bound exclusive.
 */
export function computeGoalPeakMileage(
  distance: "5k" | "10k" | "half" | "full" | "ultra",
  goalTotalMinutes: number,
): { low: number; high: number } | null {
  if (goalTotalMinutes <= 0) return null

  switch (distance) {
    case "full":
      if (goalTotalMinutes < 165) return { low: 110, high: 130 }
      if (goalTotalMinutes < 180) return { low: 95,  high: 115 }
      if (goalTotalMinutes < 210) return { low: 80,  high: 100 }
      if (goalTotalMinutes < 240) return { low: 65,  high: 80  }
      if (goalTotalMinutes < 270) return { low: 55,  high: 70  }
      return { low: 45, high: 60 }

    case "half":
      if (goalTotalMinutes < 80)  return { low: 80, high: 95 }
      if (goalTotalMinutes < 95)  return { low: 65, high: 80 }
      if (goalTotalMinutes < 110) return { low: 55, high: 70 }
      if (goalTotalMinutes < 130) return { low: 45, high: 60 }
      return { low: 35, high: 50 }

    case "10k":
      if (goalTotalMinutes < 35) return { low: 60, high: 75 }
      if (goalTotalMinutes < 40) return { low: 50, high: 65 }
      if (goalTotalMinutes < 50) return { low: 40, high: 55 }
      return { low: 30, high: 45 }

    case "5k":
      if (goalTotalMinutes < 18) return { low: 55, high: 65 }
      if (goalTotalMinutes < 22) return { low: 45, high: 55 }
      if (goalTotalMinutes < 28) return { low: 35, high: 45 }
      return { low: 25, high: 35 }

    default:
      return null  // ultra and unknown distances
  }
}

/**
 * Derive the optimal weekly training structure from goal time, distance,
 * training age, and availability. Used to inject Pfitzinger-based hard
 * constraints into the LLM prompt.
 *
 * The weeklyMileageRange fallback is used when goalMinutes is null (no goal
 * time provided) or when distance is "ultra".
 * Unknown distance values (not full/half/5k/10k/ultra) fall through to the mileage range fallback.
 */
export function computeTrainingStructure(
  goalMinutes: number | null,
  distance: string,
  selectedDaysCount: number,
  weeklyMileageRange: string,
): { runDaysPerWeek: number; restDaysPerWeek: number; maxQualitySessions: number } {
  let run: number
  let rest: number
  let quality: number

  const useMileageFallback =
    goalMinutes === null ||
    distance === "ultra" ||
    (distance !== "full" && distance !== "half" && distance !== "5k" && distance !== "10k")

  if (!useMileageFallback && distance === "full") {
    if (goalMinutes < 150)      { run = 7; rest = 0; quality = 3 }
    else if (goalMinutes < 165) { run = 7; rest = 0; quality = 2 }
    // buckets match spec rows — values may diverge in future tuning
    else if (goalMinutes < 190) { run = 6; rest = 1; quality = 2 }
    else if (goalMinutes < 225) { run = 6; rest = 1; quality = 2 }
    else if (goalMinutes < 270) { run = 5; rest = 2; quality = 1 }
    else                        { run = 4; rest = 3; quality = 1 }
  } else if (!useMileageFallback && distance === "half") {
    if (goalMinutes < 75)       { run = 7; rest = 0; quality = 3 }
    else if (goalMinutes < 82)  { run = 7; rest = 0; quality = 2 }
    // buckets match spec rows — values may diverge in future tuning
    else if (goalMinutes < 95)  { run = 6; rest = 1; quality = 2 }
    else if (goalMinutes < 112) { run = 6; rest = 1; quality = 2 }
    else if (goalMinutes < 135) { run = 5; rest = 2; quality = 1 }
    else                        { run = 5; rest = 2; quality = 1 }
  } else if (!useMileageFallback && (distance === "5k" || distance === "10k")) {
    const gm = goalMinutes as number
    // Use full marathon table as base
    if (gm < 150)      { run = 7; rest = 0; quality = 3 }
    else if (gm < 165) { run = 7; rest = 0; quality = 2 }
    else if (gm < 190) { run = 6; rest = 1; quality = 2 }
    else if (gm < 225) { run = 6; rest = 1; quality = 2 }
    else if (gm < 270) { run = 5; rest = 2; quality = 1 }
    else               { run = 5; rest = 2; quality = 1 }
    // 5k/10k modifier: +1 quality, cap run days at 6
    quality += 1
    if (run > 6) { run = 6; rest += 1 }
  } else {
    // Mileage fallback (ultra, no goal time, unknown distance)
    if      (weeklyMileageRange === "0-10")    { run = 3; rest = 4; quality = 0 }  // quality=0: beginners run easy only; constraints.maxQualitySessions overrides for first-timers via computeConstraints()
    else if (weeklyMileageRange === "10-25")   { run = 4; rest = 3; quality = 1 }
    else if (weeklyMileageRange === "25-40")   { run = 5; rest = 2; quality = 1 }
    else if (weeklyMileageRange === "40-60")   { run = 6; rest = 1; quality = 1 }
    else if (weeklyMileageRange === "60-80")   { run = 6; rest = 1; quality = 2 }
    else if (weeklyMileageRange === "80-plus") { run = 7; rest = 0; quality = 2 }
    else                                        { run = 5; rest = 2; quality = 1 }
  }


  // selectedDaysCount clamp — restDaysPerWeek is NOT adjusted
  run = Math.min(run, selectedDaysCount)
  // restDaysPerWeek is intentionally not adjusted: rest placement is the LLM's responsibility given the available day count

  return { runDaysPerWeek: run, restDaysPerWeek: rest, maxQualitySessions: quality }
}

/**
 * Derive Pfitzinger-based long run targets from race distance and peak weekly
 * volume. Used to inject hard constraints into the LLM prompt.
 *
 * peakWeeklyKm is the output of computeGoalPeakMileage (already called in
 * buildPrompt). When null (no goal time), falls back to the mid-range row for
 * each distance. recoveryRunMaxKm is NOT modified by training age.
 */
export function computeLongRunTargets(
  distance: string,
  peakWeeklyKm: { low: number; high: number } | null,
): { peakLongRunKm: number; recoveryRunMaxKm: number } {
  let peakLongRunKm: number
  let recoveryRunMaxKm: number

  const high = peakWeeklyKm?.high ?? null

  if (distance === "full") {
    if (high === null)    { peakLongRunKm = 35; recoveryRunMaxKm = 13 }
    else if (high < 65)  { peakLongRunKm = 29; recoveryRunMaxKm = 11 }
    else if (high < 90)  { peakLongRunKm = 35; recoveryRunMaxKm = 13 }
    // spec has two rows here (< 116 and >= 116) but both share the same targets —
    // the Pfitz 18/70 ceiling (38 km / 16 km) applies at all volumes above 90 km/week
    else                 { peakLongRunKm = 38; recoveryRunMaxKm = 16 }
  } else if (distance === "half") {
    if (high === null)    { peakLongRunKm = 22; recoveryRunMaxKm = 11 }
    else if (high < 50)  { peakLongRunKm = 19; recoveryRunMaxKm = 9  }
    else if (high < 75)  { peakLongRunKm = 22; recoveryRunMaxKm = 11 }
    else                 { peakLongRunKm = 26; recoveryRunMaxKm = 13 }
  } else if (distance === "5k" || distance === "10k") {
    if (high === null)    { peakLongRunKm = 13; recoveryRunMaxKm = 8  }
    else if (high < 45)  { peakLongRunKm = 11; recoveryRunMaxKm = 7  }
    else if (high < 65)  { peakLongRunKm = 13; recoveryRunMaxKm = 8  }
    else                 { peakLongRunKm = 16; recoveryRunMaxKm = 10 }
  } else if (distance === "ultra") {
    peakLongRunKm = 32; recoveryRunMaxKm = 14
  } else {
    // Unknown distance: mid-range full marathon defaults
    peakLongRunKm = 29; recoveryRunMaxKm = 11
  }


  return { peakLongRunKm, recoveryRunMaxKm }
}
