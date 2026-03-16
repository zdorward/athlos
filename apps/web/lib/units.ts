// apps/web/lib/units.ts

export function detectUnits(): "km" | "miles" {
  if (typeof navigator === "undefined") return "km"
  return navigator.language === "en-US" ? "miles" : "km"
}

export function formatRaceDistance(
  distance: "5k" | "10k" | "half" | "full" | "ultra",
  units: "km" | "miles",
): string {
  if (units === "miles") {
    const map: Record<string, string> = {
      "5k": "3.1 mi",
      "10k": "6.2 mi",
      "half": "13.1 mi",
      "full": "26.2 mi",
      "ultra": "Ultra",
    }
    return map[distance] ?? distance
  }
  const map: Record<string, string> = {
    "5k": "5 km",
    "10k": "10 km",
    "half": "21.1 km",
    "full": "42.2 km",
    "ultra": "Ultra",
  }
  return map[distance] ?? distance
}
