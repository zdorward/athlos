# Race Search API Design

**Date:** 2026-03-20
**Status:** Approved

## Problem

The RACES array (400KB) is imported directly in client components, adding significant JS to the client bundle and causing a noticeable delay when the race search dropdown opens — React renders all 1,465+ entries at once.

## Goal

Move race search server-side. Race data never reaches the client bundle. The dropdown is fast, shows Canadian races by default, and searches the full dataset as the user types.

---

## API Route

**File:** `apps/web/app/api/races/route.ts`

```
GET /api/races         → returns all CA_RACES sorted by date (default/popular)
GET /api/races?q=bos   → returns matching Race[] from full RACES, max 50
```

**Behaviour:**
- `q` absent or empty string → return `CA_RACES` explicitly sorted by date ascending (do not rely on data-file order)
- `q` present → filter full `RACES` array server-side (name, city, region, country — case-insensitive includes), return first 50 matches
- Response: `{ races: Race[] }`
- Error: `{ error: string }` with appropriate HTTP status

No auth required — race data is public.

---

## Hook

**File:** `apps/web/hooks/use-race-search.ts`

```typescript
useRaceSearch(query: string): { results: Race[]; loading: boolean }
```

- Instantiated at component mount — the initial fetch fires immediately, not deferred to dropdown open. This ensures results are ready before the user interacts with the dropdown.
- Debounces `query` by 200ms before fetching
- Fetches `/api/races` (no q) on mount and when query is cleared
- Fetches `/api/races?q={query}` when query is non-empty after debounce
- Uses an AbortController to cancel in-flight requests when a new query arrives before the previous one resolves
- Returns `{ results, loading }` — no error state surfaced to UI (empty results on failure is fine)
- Uses plain `fetch` (no new dependencies — consistent with rest of codebase)

---

## Consumer changes

**`apps/web/components/onboarding/steps/step-find-race.tsx`**
- Remove `import { RACES } from "@/data/races"`
- Replace client-side filter logic with `useRaceSearch(query)`
- Add subtle loading indicator in dropdown while `loading === true`
- `import type { Race }` remains (type-only, tree-shaken)
- **Intentional behaviour change:** previously showed all 1,495 races (CA + US) on empty query; now shows only CA_RACES (~30). This is correct — Canadian races are the relevant default for this user base.

**`apps/web/app/landing-page.tsx`**
- Same treatment as above — CA_RACES default applies here too

---

## Data flow

```
User opens dropdown
  → useRaceSearch("") fires immediately
  → fetch /api/races → CA_RACES (30 races)
  → dropdown shows Canadian races

User types "boston"
  → 200ms debounce
  → fetch /api/races?q=boston → up to 50 matches
  → dropdown updates

User clears input
  → fetch /api/races → CA_RACES again
```

---

## What's removed from the client bundle

- `import { RACES }` in `step-find-race.tsx` — gone
- `import { RACES }` in `landing-page.tsx` — gone
- `apps/web/data/races/us.ts` and `ca.ts` are no longer referenced by any client component

The `Race` type import (`import type { Race }`) remains in both files — type-only imports are erased at compile time and contribute zero bytes to the bundle.

---

## Out of scope

- Pagination (50 results is sufficient for a search dropdown)
- Caching / stale-while-revalidate (acceptable for this use case)
- Debounce configurability
