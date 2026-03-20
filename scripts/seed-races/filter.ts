import type { Race } from "./types"

const STOP_WORDS = new Set([
  "marathon", "half", "race", "run", "running", "the", "and", "of", "at", "in", "a",
])

/**
 * When an event offers both distances, RunSignUp returns the same compound name
 * for each entry (e.g. "X Marathon & Half Marathon"). Strip the irrelevant half
 * so the name matches the entry's actual distance.
 */
function normalizeName(name: string, distance: "full" | "half"): string {
  if (distance === "half") {
    // "X Marathon & Half Marathon" → "X Half Marathon"
    return name
      .replace(/\bMarathon\s*[&and]+\s*Half Marathon\b/gi, "Half Marathon")
      .replace(/\bFull\s*[&and]+\s*Half Marathon\b/gi, "Half Marathon")
      .replace(/\bMarathon\s*[&and]+\s*Half\b/gi, "Half Marathon")
      .trim()
  } else {
    // "X Marathon & Half Marathon" → "X Marathon"
    return name
      .replace(/\s*[&and]+\s*Half Marathon\b/gi, "")
      .replace(/\s*[&and]+\s*Half\b/gi, "")
      .replace(/\bFull\s*[&and]+\s*Half Marathon\b/gi, "Marathon")
      .trim()
  }
}

/** Returns true if the race should be excluded from the output. */
function shouldExclude(race: Race): boolean {
  const name = race.name.toLowerCase()
  const city = race.city.toLowerCase()

  // Multi-distance fun runs — marathon/half is a minor option, not the main event
  if (name.includes("5k") || name.includes("10k")) return true
  // Trail races
  if (name.includes("trail")) return true
  // Relay races
  if (name.includes("relay")) return true
  // Virtual / anywhere events
  if (name.includes("virtual")) return true
  if (city === "virtual" || city === "anywhere") return true
  // Training groups and programs
  if (name.includes("training group") || name.includes("training program")) return true
  // Triathlons
  if (name.includes("triathlon") || name.includes(" tri ")) return true
  // Challenge fundraisers that aren't marathons
  if (name.includes("challenge") && !name.includes("marathon") && !name.includes("half")) return true
  // Test / fake entries
  if (name.includes("fake") || name.includes("test only") || name.includes("rs test")) return true
  // Far-future / bogus dates (> 2 years out)
  const raceYear = parseInt(race.date.split("-")[0]!, 10)
  if (raceYear > new Date().getFullYear() + 2) return true

  return false
}

/** Deduplicates by normalized name + distance + year. */
function deduplicate(races: Race[]): Race[] {
  const seen = new Set<string>()
  return races.filter((race) => {
    const normName = race.name.toLowerCase().replace(/[^a-z0-9]/g, "")
    const year = race.date.split("-")[0]!
    const key = `${normName}|${race.distance}|${year}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Ensures every race has a unique ID, adding name slug + counter when needed. */
function assignUniqueIds(races: Race[]): void {
  const idCounts = new Map<string, number>()
  for (const race of races) {
    idCounts.set(race.id, (idCounts.get(race.id) ?? 0) + 1)
  }

  const usedIds = new Set(
    races.filter((r) => (idCounts.get(r.id) ?? 0) === 1).map((r) => r.id),
  )

  for (const race of races) {
    if ((idCounts.get(race.id) ?? 0) <= 1) continue

    const citySlug = race.city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    const year = race.date.split("-")[0]!
    const nameSlug = race.name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => !STOP_WORDS.has(w))
      .slice(0, 3)
      .join("-")

    let candidate = `us-${nameSlug}-${citySlug}-${race.distance}-${year}`
    let counter = 2
    while (usedIds.has(candidate)) {
      candidate = `us-${nameSlug}-${citySlug}-${race.distance}-${year}-${counter}`
      counter++
    }

    race.id = candidate
    usedIds.add(candidate)
  }
}

export function filterAndFinalize(races: Race[]): Race[] {
  const deduped = deduplicate(races)
  const filtered = deduped.filter((r) => !shouldExclude(r))
  for (const race of filtered) {
    race.name = normalizeName(race.name, race.distance)
  }
  filtered.sort((a, b) => a.date.localeCompare(b.date))
  assignUniqueIds(filtered)
  return filtered
}
