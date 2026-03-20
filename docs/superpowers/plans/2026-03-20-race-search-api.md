# Race Search API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move race search server-side so the 400KB RACES array never reaches the client bundle, and the dropdown is fast and populated with Canadian races by default.

**Architecture:** A single Next.js API route (`GET /api/races`) serves race data server-side — returning CA_RACES sorted by date when no query is given, or up to 50 filtered matches from the full RACES array when a query is present. A `useRaceSearch` hook encapsulates fetch, debounce (200ms, query transitions only), AbortController cleanup, and loading state. Both consumer components (`step-find-race.tsx` and `landing-page.tsx`) drop their static RACES imports and use the hook instead.

**Tech Stack:** Next.js 16 App Router (Route Handlers), React 19 hooks, Vitest, plain `fetch`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/web/app/api/races/route.ts` | Create | GET handler — serves CA_RACES or filtered RACES |
| `apps/web/app/api/races/route.test.ts` | Create | Vitest tests for the route |
| `apps/web/hooks/use-race-search.ts` | Create | Hook — debounce, fetch, AbortController, loading state |
| `apps/web/components/onboarding/steps/step-find-race.tsx` | Modify | Remove RACES import, use hook, add loading indicator |
| `apps/web/app/landing-page.tsx` | Modify | Same as above |
| `apps/web/vitest.config.ts` | Modify | Add `hooks/**/*.test.ts` to include pattern |

---

## Task 1: API route — GET /api/races

**Files:**
- Create: `apps/web/app/api/races/route.ts`
- Create: `apps/web/app/api/races/route.test.ts`
- Modify: `apps/web/vitest.config.ts` (no test changes needed — route.test.ts is under `app/`)

### Context

The route returns `{ races: Race[] }`. When `q` is absent or empty it returns `CA_RACES` sorted by date ascending (explicit sort — do not rely on file order). When `q` is present it filters the full `RACES` array on `name`, `city`, `region`, `country` (case-insensitive `includes`), and returns the first 50 matches. No auth required.

Import paths:
- `import { CA_RACES } from "@/data/races/ca"`
- `import { RACES } from "@/data/races"`
- `import type { Race } from "@/data/races/types"`

---

- [ ] **Step 1: Write the failing tests**

Create `apps/web/app/api/races/route.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { GET } from "./route"
import { NextRequest } from "next/server"

function makeRequest(url: string): NextRequest {
  return new NextRequest(url)
}

describe("GET /api/races", () => {
  it("returns CA_RACES sorted by date when no query given", async () => {
    const res = await GET(makeRequest("http://localhost/api/races"))
    expect(res.status).toBe(200)
    const body = await res.json() as { races: Array<{ country: string; date: string }> }
    expect(Array.isArray(body.races)).toBe(true)
    expect(body.races.length).toBeGreaterThan(0)
    // All results should be Canadian
    for (const race of body.races) {
      expect(race.country).toBe("CA")
    }
    // Should be sorted by date ascending
    for (let i = 1; i < body.races.length; i++) {
      expect(body.races[i]!.date >= body.races[i - 1]!.date).toBe(true)
    }
  })

  it("returns CA_RACES when q is empty string", async () => {
    const res = await GET(makeRequest("http://localhost/api/races?q="))
    expect(res.status).toBe(200)
    const body = await res.json() as { races: Array<{ country: string }> }
    for (const race of body.races) {
      expect(race.country).toBe("CA")
    }
  })

  it("searches full dataset when q is provided", async () => {
    const res = await GET(makeRequest("http://localhost/api/races?q=boston"))
    expect(res.status).toBe(200)
    const body = await res.json() as { races: Array<{ name: string; city: string; region: string; country: string }> }
    expect(Array.isArray(body.races)).toBe(true)
    // Every result must match "boston" in at least one field
    for (const race of body.races) {
      const fields = [race.name, race.city, race.region, race.country].join(" ").toLowerCase()
      expect(fields.includes("boston")).toBe(true)
    }
  })

  it("caps search results at 50", async () => {
    // "marathon" matches most entries
    const res = await GET(makeRequest("http://localhost/api/races?q=marathon"))
    expect(res.status).toBe(200)
    const body = await res.json() as { races: unknown[] }
    expect(body.races.length).toBeLessThanOrEqual(50)
  })

  it("returns empty array for query with no matches", async () => {
    const res = await GET(makeRequest("http://localhost/api/races?q=xyzzznotarace999"))
    expect(res.status).toBe(200)
    const body = await res.json() as { races: unknown[] }
    expect(body.races).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd apps/web && pnpm test -- --reporter=verbose app/api/races/route.test.ts
```

Expected: `Cannot find module './route'`

- [ ] **Step 3: Implement the route**

Create `apps/web/app/api/races/route.ts`:

```typescript
import type { NextRequest } from "next/server"
import { CA_RACES } from "@/data/races/ca"
import { RACES } from "@/data/races"

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q")?.trim() ?? ""

    if (q === "") {
      const sorted = [...CA_RACES].sort((a, b) => a.date.localeCompare(b.date))
      return Response.json({ races: sorted })
    }

    const lower = q.toLowerCase()
    const matches = RACES.filter(
      (r) =>
        r.name.toLowerCase().includes(lower) ||
        r.city.toLowerCase().includes(lower) ||
        r.region.toLowerCase().includes(lower) ||
        r.country.toLowerCase().includes(lower),
    ).slice(0, 50)

    return Response.json({ races: matches })
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd apps/web && pnpm test -- --reporter=verbose app/api/races/route.test.ts
```

Expected: 5 tests passing

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/api/races/route.ts apps/web/app/api/races/route.test.ts
git commit -m "feat: add GET /api/races route with CA default and full-dataset search"
```

---

## Task 2: useRaceSearch hook

**Files:**
- Create: `apps/web/hooks/use-race-search.ts`

### Context

Hook signature: `useRaceSearch(query: string): { results: Race[]; loading: boolean }`

Behaviour:
- `loading` starts as `true` synchronously at effect invocation
- Mount fetch (empty query) fires immediately — no debounce
- Query transitions debounced 200ms
- AbortController created per effect run; aborted in cleanup (handles both new-query cancellation and unmount)
- `AbortError` silently ignored; all other errors produce empty `results`
- Uses plain `fetch`; no new dependencies

This is a React hook so it cannot be tested with Vitest directly without a renderer. We validate it through the consumer integration in Task 3 (manual smoke test in dev). Skip unit tests for this file — the route covers the data layer and the consumer covers the integration.

---

- [ ] **Step 1: Create the hook**

Create `apps/web/hooks/use-race-search.ts`:

```typescript
"use client"

import { useEffect, useState } from "react"
import type { Race } from "@/data/races/types"

export function useRaceSearch(query: string): { results: Race[]; loading: boolean } {
  const [results, setResults] = useState<Race[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false

    async function fetchRaces(q: string) {
      setLoading(true)
      try {
        const url = q ? `/api/races?q=${encodeURIComponent(q)}` : "/api/races"
        const res = await fetch(url, { signal: controller.signal })
        if (!res.ok) {
          if (!cancelled) setResults([])
          return
        }
        const data = (await res.json()) as { races: Race[] }
        if (!cancelled) setResults(data.races)
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return
        if (!cancelled) setResults([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    const trimmed = query.trim()

    if (trimmed === "") {
      // Mount/clear: fetch immediately, no debounce
      void fetchRaces("")
      return () => {
        cancelled = true
        controller.abort()
      }
    }

    // Non-empty query: debounce 200ms
    const timer = setTimeout(() => void fetchRaces(trimmed), 200)

    return () => {
      cancelled = true
      controller.abort()
      clearTimeout(timer)
    }
  }, [query])

  return { results, loading }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm typecheck
```

Expected: no errors in `apps/web/hooks/use-race-search.ts`

- [ ] **Step 3: Commit**

```bash
git add apps/web/hooks/use-race-search.ts
git commit -m "feat: add useRaceSearch hook with debounce and AbortController"
```

---

## Task 3: Update step-find-race.tsx

**Files:**
- Modify: `apps/web/components/onboarding/steps/step-find-race.tsx`

### Context

Current file imports `RACES` from `@/data/races` and filters client-side. Replace the import and filter logic with `useRaceSearch(query)`. Add a subtle loading indicator (spinner or dim text) inside the dropdown while `loading === true`. Keep `import type { Race }` (type-only, tree-shaken). Keep all existing close mechanics (`onBlur` after 150ms, `onMouseDown` for item selection).

The loading indicator should appear inside the dropdown list area — replace or augment the empty results message. A simple approach: while `loading` is true and there are no results yet, show a subtle "Loading…" line in the same style as the "No races found" message.

---

- [ ] **Step 1: Update the import and add hook**

In `apps/web/components/onboarding/steps/step-find-race.tsx`, make the following changes:

Replace:
```typescript
import { RACES, type Race } from "@/data/races"
```
With:
```typescript
import type { Race } from "@/data/races/types"
import { useRaceSearch } from "@/hooks/use-race-search"
```

Remove the `filtered` derived variable (lines 21–32):
```typescript
const filtered =
  query.trim() === ""
    ? RACES
    : RACES.filter((r) => {
        const q = query.toLowerCase()
        return (
          r.name.toLowerCase().includes(q) ||
          r.city.toLowerCase().includes(q) ||
          r.region.toLowerCase().includes(q) ||
          r.country.toLowerCase().includes(q)
        )
      })
```

Add the hook call after the `useState` declarations:
```typescript
const { results, loading } = useRaceSearch(query)
```

- [ ] **Step 2: Update dropdown body to use results and show loading state**

Replace the dropdown list content. Find:
```tsx
{filtered.length > 0 ? (
  filtered.map((race) => (
```
Replace with:
```tsx
{loading ? (
  <p className="px-4 py-3 text-sm text-muted-foreground">Loading…</p>
) : results.length > 0 ? (
  results.map((race) => (
```

Find the closing of that ternary (the "No races found" branch):
```tsx
) : (
  <p className="px-4 py-3 text-sm text-muted-foreground">
    No races found for &ldquo;{query}&rdquo;
  </p>
)}
```
This stays unchanged — just ensure it's the else branch of the `results.length > 0` check, not `filtered`.

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: no new errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/onboarding/steps/step-find-race.tsx
git commit -m "feat: replace client-side RACES filter with useRaceSearch in step-find-race"
```

---

## Task 4: Update landing-page.tsx

**Files:**
- Modify: `apps/web/app/landing-page.tsx`

### Context

Same treatment as `step-find-race.tsx`. The landing page uses a `document` mousedown listener (not `onBlur`) to close the dropdown — leave that untouched. The `filtered` variable lives inside `PageContent` (around lines 68–79). Replace it with `useRaceSearch`. The loading indicator goes in the same location as Task 3 — inside the dropdown list.

First read the full dropdown rendering section of the file to find the exact lines to change before editing.

---

- [ ] **Step 1: Read the dropdown section of landing-page.tsx**

Read `apps/web/app/landing-page.tsx` lines 1–10 (imports) and search for where `filtered` is used in the JSX to find the exact rendering code.

- [ ] **Step 2: Update imports**

Replace:
```typescript
import { RACES, type Race } from "@/data/races"
```
With:
```typescript
import type { Race } from "@/data/races/types"
import { useRaceSearch } from "@/hooks/use-race-search"
```

- [ ] **Step 3: Replace filtered variable with hook**

Remove the `filtered` derived variable (approximately lines 68–79):
```typescript
const filtered =
  query.trim() === ""
    ? RACES
    : RACES.filter((r) => {
        const q = query.toLowerCase()
        return (
          r.name.toLowerCase().includes(q) ||
          r.city.toLowerCase().includes(q) ||
          r.region.toLowerCase().includes(q) ||
          r.country.toLowerCase().includes(q)
        )
      })
```

Add the hook call after the existing `useState` declarations (keep all state declarations intact):
```typescript
const { results, loading } = useRaceSearch(query)
```

- [ ] **Step 4: Update dropdown JSX to use results with loading state**

Find the dropdown list rendering. It will reference `filtered` — replace every `filtered` with `results` and add the loading branch. The pattern will be similar to:

```tsx
{loading ? (
  <p className="px-4 py-3 text-sm text-muted-foreground">Loading…</p>
) : results.length > 0 ? (
  results.map((race) => (
    // existing race button JSX — unchanged
  ))
) : (
  // existing "no races found" JSX — unchanged
)}
```

- [ ] **Step 5: Typecheck**

```bash
pnpm typecheck
```

Expected: no new errors

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/landing-page.tsx
git commit -m "feat: replace client-side RACES filter with useRaceSearch in landing-page"
```

---

## Task 5: Verify bundle improvement and run all tests

**Files:** none (verification only)

---

- [ ] **Step 1: Run all web tests**

```bash
cd apps/web && pnpm test
```

Expected: all tests pass (including the 5 new route tests)

- [ ] **Step 2: Typecheck the whole repo**

```bash
pnpm typecheck
```

Expected: no errors

- [ ] **Step 3: Lint**

```bash
pnpm lint
```

Expected: no errors

- [ ] **Step 4: Build to confirm no client bundle regressions**

```bash
pnpm build
```

Expected: build succeeds. Check the output for `apps/web` — `data/races/us.ts` and `data/races/ca.ts` should no longer appear in client chunk analysis. The `First Load JS` for pages using the race dropdown should be meaningfully smaller than before (~400KB reduction).

- [ ] **Step 5: Smoke test in dev**

```bash
pnpm dev
```

Open `http://localhost:3000`. Click the race search bar on the landing page:
- Should show Canadian races immediately (or within ~200ms network round-trip)
- Typing "boston" should show US results after a 200ms pause
- Clearing the input should return to Canadian races
- Opening onboarding and reaching the "find your race" step should behave identically

- [ ] **Step 6: Final commit (skip if nothing to stage)**

If any incidental changes accumulated during verification, stage and commit them:

```bash
git add -p
git commit -m "chore: post-integration cleanup"
```

If `git status` shows nothing, skip this step entirely.
