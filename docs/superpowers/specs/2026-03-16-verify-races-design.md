# verify-races Skill Design

## Overview

A reusable Claude Code skill (`verify-races`) that maintains the race data file at `apps/web/data/races.ts`. It operates in two modes: verifying and correcting existing race data, and discovering and adding missing races. Canada is Phase 1; USA is Phase 2 (stubbed).

## Modes

### Mode 1 — Verify & Correct (default)

Invoked with `/verify-races`.

1. Read all races from `apps/web/data/races.ts`
2. Dispatch web research agents in parallel — one per race — searching for the race's official website and RunGuides page
3. Verify: name, date, distances offered, city, province
4. Produce a structured correction report with one of four statuses per race:
   - `✓ correct` — data matches source
   - `⚠ needs update` — list what changed and the source URL
   - `✗ cancelled` — race has been definitively cancelled; entry should be removed
   - `? not found` — couldn't verify; entry is left unchanged, flagged for manual check
5. Present report to user for approval (see Review Gate)
6. On approval, apply corrections to `races.ts` and commit

**Distance scope:** Mode 1 verifies all races currently in the file regardless of distance, including any existing 5K entries.

If a research agent fails (network error, no results), mark that race `? not found` and surface a note that the search failed.

### Mode 2 — Add Missing Races (Canada)

Invoked with `/verify-races add` or `/verify-races add [province]`.

- If no province specified: search all Canadian provinces
- If province specified (e.g. `add BC`, `add ON`): scope to that province only
- Province codes are matched case-insensitively against the canonical list: `AB BC MB NB NL NS NT NU ON PE QC SK YT`
- If an unrecognized code is provided (including US state codes), output an error listing valid Canadian province codes and exit
- For each candidate race found: assign a provisional ID (see ID generation rules), include name, city, province, date, distances, source URL
- Present additions report to user for approval (see Review Gate)
- On approval, append approved races to `races.ts` and commit

**"Major" race criteria (all must be true):**
- Registration-required road running event (not virtual-only)
- Has run at least 2 consecutive years
- Offers at least one distance of 10K, half marathon, full marathon, or ultra
- No new 5K-only events; 5K distances may be added only if the same race also offers 10K or longer

**Deduplication:** A candidate race is a duplicate of an existing entry if, after normalizing both names (lowercase, punctuation stripped, distance-indicator words removed — e.g. "marathon", "half marathon", "half", "10k", "5k", "full"), the normalized names match AND the distance matches AND the race year matches. If ambiguous, surface it to the user rather than silently skipping.

**Ultra distances:** Do not actively search for new ultra events in Mode 2. If an ultra is already in the file, Mode 1 will verify it normally.

**Search failure:** If a province search returns no results or errors, surface a note to the user and continue with other provinces.

### Mode 3 — Add Missing Races (USA) — Stubbed

Invoked with the literal string `/verify-races add USA` only. Any other unrecognized two-letter code (including US state codes like `TX`) falls through to Mode 2's error handler, which outputs the valid province code list and exits.

Output: "USA race support is coming in a future update." and exit.

## Data File

`apps/web/data/races.ts` imports `Distance` from `@/components/onboarding/types`. When modifying the file (adding or removing entries), the agent must preserve this import exactly and must not alter it.

```typescript
// existing import — do not change
import type { Distance } from "@/components/onboarding/types"

interface Race {
  id: string         // see ID generation rules below
  name: string       // Official race name
  city: string
  province: string   // 2-letter province code
  date: string       // ISO date: "YYYY-MM-DD"
  distance: Distance // "5k" | "10k" | "half" | "full" | "ultra"
}
```

**ID generation rules:**
- Default format: `{slugified-city}-{distance}-{year}` where year is the calendar year of the race date
- Slugify: lowercase, spaces → hyphens, strip all non-alphanumeric characters except hyphens
- If two races in the same city share the same distance and year, prefix with a disambiguating slug from the race name (e.g. `scotiabank-toronto-full-2026`)
- Examples: `toronto-full-2026`, `victoria-half-2026`, `scotiabank-toronto-full-2026`
- Assign provisional IDs to Mode 2 candidates before presenting the additions report so users have stable references for the skip command

Multi-distance races get one entry per distance with the same date.

## Review Gate

The skill never modifies `races.ts` without explicit user approval.

**Approval interaction:**
After presenting the report, the agent asks:
> "Reply `all` to apply all changes, or `skip [id1] [id2] ...` to exclude specific entries (e.g. `skip okanagan-full-2026`). Anything else aborts."

- `all` or `yes` or `y` — apply all proposed changes
- `skip [id ...]` — exclude those entries, apply the rest
- Anything else — re-prompt once with: "Didn't catch that. Reply `all` to apply, `skip [ids]` to exclude some, or `cancel` to abort." If the second response is still unrecognized, abort with no changes made.

## Commit Behavior

- Commit on the current branch (do not create a new branch or open a PR)
- Commit message format: `data: update races.ts — {brief summary}` (e.g. `data: update races.ts — correct 3 dates, remove 1 cancelled race`)
- If a pre-commit hook fails, surface the failure to the user and stop — do not retry or bypass the hook

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
/verify-races add USA          # Not yet implemented (stub)
```

## Annual Maintenance

Run `/verify-races` at the start of each year to catch date changes, renamed races, and cancelled events before athletes start selecting goal races.

## Out of Scope

- Triathlon or obstacle race events
- New 5K-only events (Mode 2 only; existing 5K entries are verified in Mode 1)
- New ultra events (Mode 2 only; existing ultras are verified in Mode 1)
- Virtual-only races
- USA races (Phase 2)
