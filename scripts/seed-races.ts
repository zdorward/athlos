import * as fs from "fs"
import * as path from "path"

async function main() {
  const country = process.argv[2]?.toLowerCase()

  if (!country) {
    console.error("Usage: pnpm seed-races [country]")
    console.error("  Example: pnpm seed-races us")
    process.exit(1)
  }

  const fetchers: Record<string, () => Promise<void>> = {
    us: seedUSA,
  }

  const fetcher = fetchers[country]
  if (!fetcher) {
    console.error(`No fetcher for country: ${country}`)
    console.error(`Available: ${Object.keys(fetchers).join(", ")}`)
    process.exit(1)
  }

  await fetcher()
}

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
]

interface RunSignUpEvent {
  distance: string
  distance_units: string
}

interface RunSignUpRace {
  race: {
    name: string
    next_date: string
    url: string
    address: {
      city: string
      state: string
    }
    events?: { event: RunSignUpEvent }[]
  }
}

interface Race {
  id: string
  name: string
  city: string
  region: string
  country: string
  date: string
  distance: "half" | "full"
  url?: string
}

function writeRaceFile(country: string, exportName: string, races: Race[]): void {
  const outPath = path.resolve(__dirname, `../apps/web/data/races/${country}.ts`)

  const lines = [
    `import type { Race } from "./types"`,
    ``,
    `export const ${exportName}: Race[] = [`,
    ...races.map((r) => {
      const fields = [
        `    id: ${JSON.stringify(r.id)},`,
        `    name: ${JSON.stringify(r.name)},`,
        `    city: ${JSON.stringify(r.city)},`,
        `    region: ${JSON.stringify(r.region)},`,
        `    country: ${JSON.stringify(r.country)},`,
        `    date: ${JSON.stringify(r.date)},`,
        `    distance: ${JSON.stringify(r.distance)},`,
        ...(r.url ? [`    url: ${JSON.stringify(r.url)},`] : []),
      ]
      return `  {\n${fields.join("\n")}\n  },`
    }),
    `]`,
    ``,
  ]

  fs.writeFileSync(outPath, lines.join("\n"), "utf8")
  console.log(`\nWrote ${races.length} races to ${outPath}`)
}

async function fetchDistance(
  state: string,
  distanceLabel: "full" | "half",
  minMi: number,
  maxMi: number,
): Promise<Race[]> {
  const params = new URLSearchParams({
    format: "json",
    state,
    min_distance: String(minMi),
    max_distance: String(maxMi),
    distance_units: "M",
    events: "T",
    results_per_page: "500",
    sort: "date ASC",
    start_date: new Date().toISOString().split("T")[0]!,
  })

  const url = `https://runsignup.com/Rest/races?${params}`
  const res = await fetch(url)

  if (!res.ok) {
    console.warn(`  ${state} ${distanceLabel}: HTTP ${res.status} — skipping`)
    return []
  }

  const json = await res.json() as { races?: RunSignUpRace[] }
  if (!json.races) return []

  const races: Race[] = []
  for (const item of json.races) {
    const r = item.race
    if (!r.next_date || !r.address?.city || !r.address?.state) continue

    // next_date is "MM/DD/YYYY HH:MM:SS" or "MM/DD/YYYY" — convert to YYYY-MM-DD
    const rawDate = r.next_date.split(" ")[0]!
    const [mm, dd, yyyy] = rawDate.split("/")
    const date = `${yyyy}-${mm!.padStart(2, "0")}-${dd!.padStart(2, "0")}`
    const citySlug = r.address.city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    const year = yyyy!
    const id = `us-${citySlug}-${distanceLabel}-${year}`

    races.push({
      id,
      name: r.name,
      city: r.address.city,
      region: r.address.state,
      country: "US",
      date,
      distance: distanceLabel,
      url: r.url ?? undefined,
    })
  }

  return races
}

async function seedUSA(): Promise<void> {
  console.log("Fetching USA races from RunSignUp (50 states, full + half)...")

  const allRaces: Race[] = []
  const seen = new Set<string>()

  // One state at a time = 2 concurrent requests (full + half), respecting RunSignUp's limit
  for (const state of US_STATES) {
    process.stdout.write(`  ${state}...`)

    const [fullRaces, halfRaces] = await Promise.all([
      fetchDistance(state, "full", 25, 27),
      fetchDistance(state, "half", 12, 14),
    ])

    for (const race of [...fullRaces, ...halfRaces]) {
      const normName = race.name.toLowerCase().replace(/[^a-z0-9]/g, "")
      const year = race.date.split("-")[0]!
      const dedupKey = `${normName}|${race.distance}|${year}`
      if (seen.has(dedupKey)) continue
      seen.add(dedupKey)
      allRaces.push(race)
    }

    console.log(` ${fullRaces.length} full, ${halfRaces.length} half`)
  }

  // Fix duplicate IDs by adding name slug, then counter if still colliding
  const assignUniqueId = (races: Race[]) => {
    const idCounts = new Map<string, number>()
    for (const race of races) {
      idCounts.set(race.id, (idCounts.get(race.id) ?? 0) + 1)
    }

    const stopWords = new Set(["marathon", "half", "race", "run", "running", "the", "and", "of", "at", "in", "a"])
    const usedIds = new Set(races.filter((r) => (idCounts.get(r.id) ?? 0) === 1).map((r) => r.id))

    for (const race of races) {
      if ((idCounts.get(race.id) ?? 0) <= 1) continue

      const citySlug = race.city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
      const year = race.date.split("-")[0]!
      const nameSlug = race.name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .filter((w) => !stopWords.has(w))
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

  // Filter out non-road races and junk entries
  const currentYear = new Date().getFullYear()
  const filtered = allRaces.filter((race) => {
    const nameLower = race.name.toLowerCase()
    // Exclude trail races
    if (nameLower.includes("trail")) return false
    // Exclude relay races
    if (nameLower.includes("relay")) return false
    // Exclude virtual races
    if (nameLower.includes("virtual")) return false
    if (race.city.toLowerCase() === "virtual") return false
    // Exclude test/fake entries
    if (nameLower.includes("fake")) return false
    if (nameLower.includes("test only")) return false
    if (nameLower.includes("rs test")) return false
    // Exclude far-future/bogus dates (more than 2 years out)
    const raceYear = parseInt(race.date.split("-")[0]!, 10)
    if (raceYear > currentYear + 2) return false
    return true
  })

  // Sort by date ascending
  filtered.sort((a, b) => a.date.localeCompare(b.date))

  assignUniqueId(filtered)

  console.log(`\nTotal: ${filtered.length} USA races (filtered from ${allRaces.length} raw)`)
  writeRaceFile("us", "US_RACES", filtered)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
