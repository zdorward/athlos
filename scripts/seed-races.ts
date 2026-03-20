import { fetchDistance, US_STATES } from "./seed-races/runsignup"
import { filterAndFinalize } from "./seed-races/filter"
import { writeRaceFile } from "./seed-races/write"
import type { Race } from "./seed-races/types"

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

async function seedUSA(): Promise<void> {
  console.log("Fetching USA races from RunSignUp (50 states, full + half)...")

  const raw: Race[] = []

  for (const state of US_STATES) {
    process.stdout.write(`  ${state}...`)
    const [full, half] = await Promise.all([
      fetchDistance(state, "full", 25, 27),
      fetchDistance(state, "half", 12, 14),
    ])
    raw.push(...full, ...half)
    console.log(` ${full.length} full, ${half.length} half`)
  }

  const races = filterAndFinalize(raw)
  console.log(`\nTotal: ${races.length} races (filtered from ${raw.length} raw)`)
  writeRaceFile("us", "US_RACES", races)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
