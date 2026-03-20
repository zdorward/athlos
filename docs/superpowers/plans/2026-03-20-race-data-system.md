# Race Data System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate race data to a per-country file structure, replace the slow AI-research skill with a RunSignUp API seed script, and add USA marathons and half marathons.

**Architecture:** Split `apps/web/data/races.ts` into `apps/web/data/races/{types,ca,us,index}.ts`. A root-level `scripts/seed-races.ts` fetches from the RunSignUp REST API and overwrites the country file on demand. All existing app import paths (`@/data/races`) continue to work unchanged via the barrel export.

**Tech Stack:** TypeScript, tsx (script runner), RunSignUp REST API (client_id + client_secret as api_key/api_secret), Node.js `fs` for file writing, `dotenv` for env loading in the script.

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Create | `apps/web/data/races/types.ts` | `Race` interface |
| Create | `apps/web/data/races/ca.ts` | 34 Canadian races (migrated) |
| Create | `apps/web/data/races/index.ts` | Barrel — exports `RACES` and `Race` |
| Delete | `apps/web/data/races.ts` | Replaced by the above |
| Modify | `apps/web/components/onboarding/steps/step-find-race.tsx` | `province` → `region`, add `country` to search |
| Modify | `apps/web/app/landing-page.tsx` | Same |
| Create | `scripts/seed-races.ts` | RunSignUp fetcher + file writer |
| Modify | `package.json` (root) | Add `tsx` dep + `seed-races` script |
| Modify | `~/.claude/skills/verify-races/SKILL.md` | Replace with redirect to seed script |

---

## Task 1: Types file

**Files:**
- Create: `apps/web/data/races/types.ts`

- [ ] **Create `apps/web/data/races/types.ts`**

```typescript
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
```

- [ ] **Commit**

```bash
git add apps/web/data/races/types.ts
git commit -m "feat: add Race types file for multi-country schema"
```

---

## Task 2: Migrate Canadian races

**Files:**
- Create: `apps/web/data/races/ca.ts`

All 34 existing races are migrated here. Changes from the old schema:
- `province` → `region`
- Add `country: "CA"`
- IDs normalized to `ca-{city-slug}-{distance}-{year}` format

- [ ] **Create `apps/web/data/races/ca.ts`**

```typescript
import type { Race } from "./types"

export const CA_RACES: Race[] = [
  // Ontario
  {
    id: "ca-toronto-full-2026",
    name: "TCS Toronto Waterfront Marathon",
    city: "Toronto",
    region: "ON",
    country: "CA",
    date: "2026-10-18",
    distance: "full",
    url: "https://www.torontowaterfrontmarathon.com/",
  },
  {
    id: "ca-toronto-half-2026",
    name: "TCS Toronto Waterfront Half Marathon",
    city: "Toronto",
    region: "ON",
    country: "CA",
    date: "2026-10-18",
    distance: "half",
    url: "https://www.torontowaterfrontmarathon.com/",
  },
  {
    id: "ca-ottawa-full-2026",
    name: "Tamarack Homes Ottawa International Marathon",
    city: "Ottawa",
    region: "ON",
    country: "CA",
    date: "2026-05-24",
    distance: "full",
    url: "https://www.runottawa.ca/",
  },
  {
    id: "ca-ottawa-half-2026",
    name: "Ottawa Half Marathon presented by Desjardins",
    city: "Ottawa",
    region: "ON",
    country: "CA",
    date: "2026-05-24",
    distance: "half",
    url: "https://www.runottawa.ca/",
  },
  {
    id: "ca-mississauga-full-2026",
    name: "Beneva Mississauga Marathon",
    city: "Mississauga",
    region: "ON",
    country: "CA",
    date: "2026-04-26",
    distance: "full",
    url: "https://www.mississaugamarathon.com/",
  },
  {
    id: "ca-mississauga-half-2026",
    name: "Electrolit Half Marathon",
    city: "Mississauga",
    region: "ON",
    country: "CA",
    date: "2026-04-26",
    distance: "half",
    url: "https://www.mississaugamarathon.com/",
  },
  {
    id: "ca-ottawa-army-half-2026",
    name: "Canada Army Run",
    city: "Ottawa",
    region: "ON",
    country: "CA",
    date: "2026-09-20",
    distance: "half",
    url: "https://armyrun.ca/",
  },
  {
    id: "ca-burlington-half-2026",
    name: "Chilly Half Marathon",
    city: "Burlington",
    region: "ON",
    country: "CA",
    date: "2026-03-01",
    distance: "half",
    url: "https://chillyhalfmarathon.ca/",
  },
  {
    id: "ca-toronto-goodlife-half-2026",
    name: "GoodLife Fitness Toronto Half Marathon",
    city: "Toronto",
    region: "ON",
    country: "CA",
    date: "2026-05-03",
    distance: "half",
    url: "https://www.torontomarathon.com/",
  },
  // British Columbia
  {
    id: "ca-vancouver-full-2026",
    name: "BMO Vancouver Marathon",
    city: "Vancouver",
    region: "BC",
    country: "CA",
    date: "2026-05-03",
    distance: "full",
    url: "https://bmovanmarathon.ca/",
  },
  {
    id: "ca-vancouver-half-2026",
    name: "BMO Vancouver Half Marathon",
    city: "Vancouver",
    region: "BC",
    country: "CA",
    date: "2026-05-03",
    distance: "half",
    url: "https://bmovanmarathon.ca/",
  },
  {
    id: "ca-victoria-full-2026",
    name: "Royal Victoria Marathon",
    city: "Victoria",
    region: "BC",
    country: "CA",
    date: "2026-10-11",
    distance: "full",
    url: "https://www.runvictoriamarathon.com/",
  },
  {
    id: "ca-victoria-half-2026",
    name: "Royal Victoria Outway Half Marathon",
    city: "Victoria",
    region: "BC",
    country: "CA",
    date: "2026-10-11",
    distance: "half",
    url: "https://www.runvictoriamarathon.com/",
  },
  {
    id: "ca-kelowna-full-2026",
    name: "Argus Apple Marathon",
    city: "Kelowna",
    region: "BC",
    country: "CA",
    date: "2026-09-27",
    distance: "full",
    url: "https://appleraceseries.com/",
  },
  {
    id: "ca-kelowna-half-2026",
    name: "Argus Apple Half Marathon",
    city: "Kelowna",
    region: "BC",
    country: "CA",
    date: "2026-09-27",
    distance: "half",
    url: "https://appleraceseries.com/",
  },
  // Alberta
  {
    id: "ca-calgary-full-2026",
    name: "Servus Calgary Marathon",
    city: "Calgary",
    region: "AB",
    country: "CA",
    date: "2026-05-24",
    distance: "full",
    url: "https://calgarymarathon.com/",
  },
  {
    id: "ca-calgary-half-2026",
    name: "Servus Calgary Half Marathon",
    city: "Calgary",
    region: "AB",
    country: "CA",
    date: "2026-05-24",
    distance: "half",
    url: "https://calgarymarathon.com/",
  },
  {
    id: "ca-edmonton-full-2026",
    name: "Servus Edmonton Marathon",
    city: "Edmonton",
    region: "AB",
    country: "CA",
    date: "2026-08-16",
    distance: "full",
    url: "https://www.edmontonmarathon.ca/",
  },
  {
    id: "ca-edmonton-half-2026",
    name: "Servus Edmonton Half Marathon",
    city: "Edmonton",
    region: "AB",
    country: "CA",
    date: "2026-08-16",
    distance: "half",
    url: "https://www.edmontonmarathon.ca/",
  },
  {
    id: "ca-banff-half-2026",
    name: "Banff Half Marathon",
    city: "Banff",
    region: "AB",
    country: "CA",
    date: "2026-06-15",
    distance: "half",
    url: "https://www.banffmarathon.com/",
  },
  // Quebec
  {
    id: "ca-montreal-full-2026",
    name: "Marathon Beneva de Montréal",
    city: "Montreal",
    region: "QC",
    country: "CA",
    date: "2026-10-11",
    distance: "full",
    url: "https://couronsmtl.com/en/marathon-beneva/home/",
  },
  {
    id: "ca-montreal-half-2026",
    name: "Marathon Beneva de Montréal",
    city: "Montreal",
    region: "QC",
    country: "CA",
    date: "2026-10-11",
    distance: "half",
    url: "https://couronsmtl.com/en/marathon-beneva/home/",
  },
  {
    id: "ca-quebec-city-full-2026",
    name: "Beneva Quebec City Marathon presented by Brunet",
    city: "Quebec City",
    region: "QC",
    country: "CA",
    date: "2026-10-04",
    distance: "full",
    url: "https://www.jecoursqc.com/en/beneva-quebec-city-marathon-presented-by-montellier/race-day/",
  },
  {
    id: "ca-quebec-city-half-2026",
    name: "21.1K Shop Santé presented by WKND 91.9",
    city: "Quebec City",
    region: "QC",
    country: "CA",
    date: "2026-10-04",
    distance: "half",
    url: "https://www.jecoursqc.com/en/beneva-quebec-city-marathon-presented-by-montellier/race-day/",
  },
  // Manitoba
  {
    id: "ca-winnipeg-full-2026",
    name: "Manitoba Marathon",
    city: "Winnipeg",
    region: "MB",
    country: "CA",
    date: "2026-06-21",
    distance: "full",
    url: "https://manitobamarathon.mb.ca/",
  },
  {
    id: "ca-winnipeg-half-2026",
    name: "Manitoba Half Marathon",
    city: "Winnipeg",
    region: "MB",
    country: "CA",
    date: "2026-06-21",
    distance: "half",
    url: "https://manitobamarathon.mb.ca/",
  },
  // Nova Scotia
  {
    id: "ca-halifax-full-2026",
    name: "Medavie Marathon",
    city: "Halifax",
    region: "NS",
    country: "CA",
    date: "2026-05-17",
    distance: "full",
    url: "https://bluenosemarathon.com/",
  },
  {
    id: "ca-halifax-half-2026",
    name: "Atlantic Chip Half Marathon",
    city: "Halifax",
    region: "NS",
    country: "CA",
    date: "2026-05-17",
    distance: "half",
    url: "https://bluenosemarathon.com/",
  },
  // Saskatchewan
  {
    id: "ca-regina-full-2026",
    name: "Queen City Marathon",
    city: "Regina",
    region: "SK",
    country: "CA",
    date: "2026-09-13",
    distance: "full",
    url: "https://runqcm.ca/",
  },
  {
    id: "ca-regina-half-2026",
    name: "Queen City Half Marathon",
    city: "Regina",
    region: "SK",
    country: "CA",
    date: "2026-09-13",
    distance: "half",
    url: "https://runqcm.ca/",
  },
]
```

- [ ] **Commit**

```bash
git add apps/web/data/races/ca.ts
git commit -m "feat: migrate Canadian races to new multi-country schema"
```

---

## Task 3: Barrel + delete old file

**Files:**
- Create: `apps/web/data/races/index.ts`
- Delete: `apps/web/data/races.ts`

Do these atomically — the old file and new barrel cannot coexist (Next.js will resolve `@/data/races` to the directory `index.ts` once the directory exists).

- [ ] **Create `apps/web/data/races/index.ts`**

```typescript
import type { Race } from "./types"
import { CA_RACES } from "./ca"

// US races added after running: pnpm seed-races us
// import { US_RACES } from "./us"

export const RACES: Race[] = [
  ...CA_RACES,
  // ...US_RACES,
]

export type { Race } from "./types"
```

Note: `US_RACES` is commented out until `us.ts` exists (Task 7). Uncomment after running the seed script.

- [ ] **Delete `apps/web/data/races.ts`**

```bash
git rm apps/web/data/races.ts
```

- [ ] **Verify typecheck still passes (imports resolve via the new barrel)**

```bash
pnpm typecheck
```

Expected: no errors. If you see `Cannot find module '@/data/races'`, the `data/races/` directory structure isn't right — check that `index.ts` exists at `apps/web/data/races/index.ts`.

- [ ] **Commit**

```bash
git add apps/web/data/races/index.ts apps/web/data/races.ts
git commit -m "feat: add races barrel, delete old races.ts"
```

---

## Task 4: Update app consumers

**Files:**
- Modify: `apps/web/components/onboarding/steps/step-find-race.tsx`
- Modify: `apps/web/app/landing-page.tsx`

Two changes in each file — do them together:
1. `race.province` → `race.region` (search filter + display)
2. Add `r.country.toLowerCase().includes(q)` to the search filter

- [ ] **Update `step-find-race.tsx`**

At line 37, change the filter from:
```typescript
r.name.toLowerCase().includes(q) ||
r.city.toLowerCase().includes(q) ||
r.province.toLowerCase().includes(q)
```
to:
```typescript
r.name.toLowerCase().includes(q) ||
r.city.toLowerCase().includes(q) ||
r.region.toLowerCase().includes(q) ||
r.country.toLowerCase().includes(q)
```

At line 46, change:
```typescript
city: `${race.city}, ${race.province}`,
```
to:
```typescript
city: `${race.city}, ${race.region}`,
```

At line 103, change:
```typescript
{race.city}, {race.province} · {format(parseISO(race.date), "MMM d, yyyy")}
```
to:
```typescript
{race.city}, {race.region} · {format(parseISO(race.date), "MMM d, yyyy")}
```

- [ ] **Update `landing-page.tsx`**

Apply the same three changes (filter + display sites). Search for `race.province` — there are **three** occurrences: the filter (≈line 76), the `handleRaceSelect` city string (≈line 83), and the `DropdownRaceRow` display (≈line 746). All three must be updated or typecheck will fail.

- [ ] **Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors. `province` does not exist on `Race` anymore — any remaining reference will be a type error.

- [ ] **Commit**

```bash
git add apps/web/components/onboarding/steps/step-find-race.tsx apps/web/app/landing-page.tsx
git commit -m "feat: rename province to region, add country to race search filter"
```

---

## Task 5: Seed script setup

**Files:**
- Modify: `package.json` (root)
- Create: `scripts/seed-races.ts` (scaffold only — no fetching yet)

- [ ] **Install tsx as a root devDependency**

```bash
pnpm add -D tsx -w
```

Expected: `tsx` appears in root `package.json` devDependencies and `pnpm-lock.yaml` is updated.

- [ ] **Add `seed-races` script to root `package.json`**

In the `"scripts"` block:
```json
"seed-races": "tsx scripts/seed-races.ts"
```

- [ ] **Create `scripts/seed-races.ts` scaffold**

```typescript
import * as fs from "fs"
import * as path from "path"
import * as dotenv from "dotenv"

// Load credentials from apps/web/.env.local
dotenv.config({ path: path.resolve(__dirname, "../apps/web/.env.local") })

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

async function seedUSA(): Promise<void> {
  console.log("Fetching USA races from RunSignUp...")
  // TODO: implement in Task 6
  console.log("Not yet implemented")
}
```

- [ ] **Install dotenv**

```bash
pnpm add -D dotenv -w
```

- [ ] **Verify the scaffold runs**

```bash
pnpm seed-races us
```

Expected output:
```
Fetching USA races from RunSignUp...
Not yet implemented
```

- [ ] **Commit**

```bash
git add scripts/seed-races.ts package.json pnpm-lock.yaml
git commit -m "feat: add seed-races script scaffold with tsx runner"
```

---

## Task 6: RunSignUp USA fetcher

**Files:**
- Modify: `scripts/seed-races.ts`

The RunSignUp REST API base URL is `https://runsignup.com/Rest`. Credentials (`RUNSIGNUP_CLIENT_ID` / `RUNSIGNUP_CLIENT_SECRET`) are passed as `api_key` and `api_secret` query params.

Distance filtering uses miles:
- Full marathon: `min_distance=25&max_distance=27&distance_units=M`
- Half marathon: `min_distance=12&max_distance=14&distance_units=M`

The API limits to 2 concurrent requests — fetch states sequentially in batches of 2.

- [ ] **Replace `seedUSA` with the full implementation**

```typescript
const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
]

interface RunSignUpEvent {
  name: string
  distance: string
  distance_units: string
  start_time: string
}

interface RunSignUpRace {
  race: {
    race_id: number
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

async function seedUSA(): Promise<void> {
  const apiKey = process.env.RUNSIGNUP_CLIENT_ID
  const apiSecret = process.env.RUNSIGNUP_CLIENT_SECRET

  if (!apiKey || !apiSecret) {
    console.error("Missing RUNSIGNUP_CLIENT_ID or RUNSIGNUP_CLIENT_SECRET in apps/web/.env.local")
    process.exit(1)
  }

  console.log("Fetching USA races from RunSignUp (50 states × 2 distances)...")

  const results: Race[] = []
  const seen = new Set<string>() // dedup key: normalized-name|distance|year

  async function fetchDistance(
    state: string,
    distanceLabel: "full" | "half",
    minMi: number,
    maxMi: number,
  ): Promise<Race[]> {
    const params = new URLSearchParams({
      api_key: apiKey!,
      api_secret: apiSecret!,
      format: "json",
      state,
      min_distance: String(minMi),
      max_distance: String(maxMi),
      distance_units: "M",
      events: "T",
      results_per_page: "500",
      sort: "date ASC",
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

      const date = r.next_date.split(" ")[0]! // "2026-04-20 00:00:00" → "2026-04-20"
      const year = date.split("-")[0]!
      const normName = r.name.toLowerCase().replace(/[^a-z0-9]/g, "")
      const dedupKey = `${normName}|${distanceLabel}|${year}`

      if (seen.has(dedupKey)) continue
      seen.add(dedupKey)

      const citySlug = r.address.city.toLowerCase().replace(/[^a-z0-9]+/g, "-")
      const id = `us-${citySlug}-${distanceLabel}-${year}`

      races.push({
        id,
        name: r.name,
        city: r.address.city,
        region: r.address.state,
        country: "US",
        date,
        distance: distanceLabel,
        url: r.url ? `https://runsignup.com${r.url}` : undefined,
      })
    }

    return races
  }

  // Fetch one state at a time (2 requests per state: full + half) to respect
  // RunSignUp's limit of 2 concurrent API calls
  for (const state of US_STATES) {
    process.stdout.write(`  ${state}...`)

    const [fullRaces, halfRaces] = await Promise.all([
      fetchDistance(state, "full", 25, 27),
      fetchDistance(state, "half", 12, 14),
    ])

    results.push(...fullRaces, ...halfRaces)
    console.log(` done (${results.length} total so far)`)
  }

  // Sort by date
  results.sort((a, b) => a.date.localeCompare(b.date))

  console.log(`\nTotal: ${results.length} USA races`)
  writeRaceFile("us", "US_RACES", results)
}
```

- [ ] **Add the `Race` type import and `writeRaceFile` helper at the top of the script**

Add after the dotenv import:

```typescript
import type { Race } from "./apps/web/data/races/types"

function writeRaceFile(country: string, exportName: string, races: Race[]): void {
  const outPath = path.resolve(__dirname, `apps/web/data/races/${country}.ts`)

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
```

- [ ] **Run the fetcher**

```bash
pnpm seed-races us
```

Expected: progress output per state batch, total count, and a new `apps/web/data/races/us.ts` file.

If you get a 401 or authentication error, RunSignUp may require OAuth2 token exchange instead of static key params. In that case, add a `getToken()` step:

```typescript
async function getToken(): Promise<string> {
  const res = await fetch("https://runsignup.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.RUNSIGNUP_CLIENT_ID!,
      client_secret: process.env.RUNSIGNUP_CLIENT_SECRET!,
    }),
  })
  const json = await res.json() as { access_token: string }
  return json.access_token
}
```

Then pass `Authorization: Bearer ${token}` as a header instead of api_key/api_secret params.

- [ ] **Commit the updated script**

```bash
git add scripts/seed-races.ts
git commit -m "feat: implement RunSignUp USA fetcher in seed script"
```

---

## Task 7: Wire up us.ts and verify

**Files:**
- Modify: `apps/web/data/races/index.ts`
- Create: `apps/web/data/races/us.ts` (generated)

- [ ] **Review the generated `us.ts`**

Open `apps/web/data/races/us.ts` and spot-check a handful of entries:
- Dates look like real 2026 dates (not garbage)
- Names are real race names (not API artifacts)
- IDs follow `us-{city}-{distance}-{year}` format
- Cities and states look correct

If the file is empty or has very few entries, check the API response — RunSignUp may have returned an error payload instead of races.

- [ ] **Uncomment US_RACES in `apps/web/data/races/index.ts`**

```typescript
import type { Race } from "./types"
import { CA_RACES } from "./ca"
import { US_RACES } from "./us"

export const RACES: Race[] = [
  ...CA_RACES,
  ...US_RACES,
]

export type { Race } from "./types"
```

- [ ] **Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors. If `us.ts` has malformed output (e.g. a `distance` value that isn't `"half" | "full"`), you'll see a type error — fix the fetcher's distance filtering logic.

- [ ] **Commit**

```bash
git add apps/web/data/races/index.ts apps/web/data/races/us.ts
git commit -m "feat: add USA races from RunSignUp, wire into RACES barrel"
```

---

## Task 8: Retire the verify-races skill

**Files:**
- Modify: `~/.claude/skills/verify-races/SKILL.md`

- [ ] **Replace `~/.claude/skills/verify-races/SKILL.md` with a redirect**

```markdown
---
name: verify-races
description: Deprecated — use pnpm seed-races to refresh race data from RunSignUp API.
---

# verify-races (deprecated)

This skill has been replaced by the seed script.

To refresh USA race data:
```bash
pnpm seed-races us
```

Review the diff, then commit:
```bash
git add apps/web/data/races/us.ts
git commit -m "data: refresh USA races from RunSignUp"
```

To add a new country, add a fetcher to `scripts/seed-races.ts` following the pattern of `seedUSA`.
```

- [ ] **Commit**

```bash
git add ~/.claude/skills/verify-races/SKILL.md
git commit -m "chore: retire verify-races skill, redirect to seed-races script"
```

---

## Verification Checklist

After all tasks are complete:

- [ ] `pnpm typecheck` — passes with zero errors
- [ ] `pnpm build` — builds successfully
- [ ] `apps/web/data/races.ts` — does not exist
- [ ] `apps/web/data/races/index.ts` — exports `RACES` and `Race`
- [ ] `apps/web/data/races/us.ts` — exists with >0 entries
- [ ] Search in onboarding accepts "MA", "Boston", "US", "United States" style queries
- [ ] `pnpm seed-races us` — reruns cleanly and overwrites `us.ts`
