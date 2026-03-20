import type { Race, RunSignUpRace } from "./types"

export const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
]

function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase())
}

export async function fetchDistance(
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
    results_per_page: "500",
    sort: "date ASC",
    start_date: new Date().toISOString().split("T")[0]!,
  })

  const res = await fetch(`https://runsignup.com/Rest/races?${params}`)

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

    // next_date is "MM/DD/YYYY HH:MM:SS" — convert to YYYY-MM-DD
    const rawDate = r.next_date.split(" ")[0]!
    const [mm, dd, yyyy] = rawDate.split("/")
    const date = `${yyyy}-${mm!.padStart(2, "0")}-${dd!.padStart(2, "0")}`
    const citySlug = r.address.city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    const id = `us-${citySlug}-${distanceLabel}-${yyyy}`

    races.push({
      id,
      name: r.name,
      city: toTitleCase(r.address.city),
      region: r.address.state,
      country: "US",
      date,
      distance: distanceLabel,
      url: r.url ?? undefined,
    })
  }

  return races
}
