import * as path from "path"
import * as dotenv from "dotenv"

// Load credentials from apps/web/.env.local
dotenv.config({ path: path.resolve(__dirname, "../apps/web/.env.local") })

async function main(): Promise<void> {
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
  console.log("Fetching USA races from RunSignUp...")
  // TODO: implement in Task 6
  console.log("Not yet implemented")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
