import type { Distance } from "@/components/onboarding/types"

export interface Race {
  id: string       // "{country}-{city-slug}-{distance}-{year}", e.g. "us-boston-full-2026"
  name: string
  city: string
  region: string   // province (CA), state abbreviation (US), etc.
  country: string  // ISO 3166-1 alpha-2: "CA" | "US" | etc.
  date: string     // ISO 8601, YYYY-MM-DD
  distance: Distance
  url?: string
}
