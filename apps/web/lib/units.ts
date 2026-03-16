// apps/web/lib/units.ts

export function detectUnits(): "km" | "miles" {
  if (typeof navigator === "undefined") return "km"
  return navigator.language === "en-US" ? "miles" : "km"
}

export function formatRaceDistance(
  distance: "half" | "full",
  units: "km" | "miles",
): string {
  if (units === "miles") {
    const map: Record<string, string> = {
      "half": "13.1 mi",
      "full": "26.2 mi",
    }
    return map[distance] ?? distance
  }
  const map: Record<string, string> = {
    "half": "21.1 km",
    "full": "42.2 km",
  }
  return map[distance] ?? distance
}
