# verify-races Skill Design

## Overview

A reusable Claude Code skill (`verify-races`) that maintains the race data file at `apps/web/data/races.ts`. It operates in two modes: verifying and correcting existing race data, and discovering and adding missing races. Canada is Phase 1; USA is Phase 2 (stubbed).

## Modes

### Mode 1 — Verify & Correct (default)

Invoked with `/verify-races`.

1. Read all races from `apps/web/data/races.ts`
2. For each race, dispatch web research: search for the race's official website and/or RunGuides page
3. Verify: name, date, distances offered, city, province
4. Produce a structured correction report with one of three statuses per race:
   - `✓ correct` — data matches source
   - `⚠ needs update` — list what changed and the source URL
   - `? not found` — couldn't verify, flag for manual check
5. Present report to user for approval
6. On approval, apply all corrections to `races.ts` and commit

### Mode 2 — Add Missing Races (Canada)

Invoked with `/verify-races add` or `/verify-races add [province]`.

- If no province specified: search all Canadian provinces for major road races not already in the file
- If province specified (e.g. `add BC`, `add ON`): scope search to that province only
- For each candidate race found: include name, city, province, date, distances, source URL
- Present additions report to user for approval
- On approval, append approved races to `races.ts` and commit

### Mode 3 — Add Missing Races (USA) — Stubbed

Invoked with `/verify-races add USA` or `/verify-races add [state]`.

- Not yet implemented — skill should output a clear "USA support coming soon" message and exit

## Data File

`apps/web/data/races.ts` — array of `Race` objects:

```typescript
interface Race {
  id: string         // kebab-case: "race-name-distance-year"
  name: string       // Official race name
  city: string
  province: string   // 2-letter province/state code
  date: string       // ISO date: "YYYY-MM-DD"
  distance: Distance // "5k" | "10k" | "half" | "full" | "ultra"
}
```

Multi-distance races (e.g. a marathon weekend offering full + half) get one entry per distance with the same date.

## Review Gate

The skill never modifies `races.ts` without explicit user approval of a structured report. This applies to both modes. The user can approve all, approve selectively, or reject entirely.

## Research Sources (priority order)

1. Official race website
2. RunGuides (runguides.com)
3. Running Canada / provincial running associations

## Invocation Examples

```
/verify-races                  # Verify all existing races
/verify-races add              # Find missing Canadian races across all provinces
/verify-races add BC           # Find missing races in British Columbia only
/verify-races add ON           # Find missing races in Ontario only
/verify-races add USA          # Not yet implemented
```

## Annual Maintenance

This skill is designed to be run annually when race dates roll over to the new year. Running `/verify-races` at the start of each year catches date changes, renamed races, and cancelled events.

## Out of Scope

- Triathlon or obstacle race events (running road races only)
- Races under 5K distance
- Trail ultras (unless already in the file)
- USA races (Phase 2)
