# verify-races Skill Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a reusable `verify-races` Claude Code skill that verifies and corrects existing race data in `apps/web/data/races.ts`, and discovers missing Canadian races to add.

**Architecture:** A personal Claude Code skill at `~/.claude/skills/verify-races.md`. The skill contains all instructions for Claude to act as a race data maintenance agent: dispatching parallel web research, generating structured reports, gating all file changes behind user approval, and committing results. No TypeScript code is created — this is a process skill document.

**Tech Stack:** Claude Code skill (Markdown), `apps/web/data/races.ts`, WebSearch tool for research agents

---

## Chunk 1: Skill File

### Task 1: Create the personal skills directory and write the skill file

**Files:**
- Create: `~/.claude/skills/verify-races.md`

- [ ] **Step 1: Create the skills directory**

```bash
mkdir -p ~/.claude/skills
```

Expected: directory created (or already exists)

- [ ] **Step 2: Write the skill file**

Create `~/.claude/skills/verify-races.md` with the following content:

```markdown
---
name: verify-races
description: Use when maintaining race data in apps/web/data/races.ts — verifying existing races are correct, correcting stale data, or adding missing Canadian races. Invoke with /verify-races, /verify-races add, or /verify-races add [province].
---

# verify-races

Maintain the race data file at `apps/web/data/races.ts` for the Athlos project.

## How to Read Arguments

The user invokes this skill with optional arguments after `/verify-races`:

| Invocation | Mode |
|---|---|
| `/verify-races` (no args) | Mode 1: Verify & Correct |
| `/verify-races add` | Mode 2: Add missing Canadian races (all provinces) |
| `/verify-races add [province]` | Mode 2: Add missing races for that province only |
| `/verify-races add USA` (literal) | Mode 3: USA stub |
| unrecognized 2-letter code (e.g. `TX`, `ZZ`) | Mode 2 error: list valid province codes and exit |

Parse the args from the user's message. If the first arg is `add`, proceed to Mode 2 or 3. Otherwise, proceed to Mode 1.

---

## Mode 1: Verify & Correct

### Step 1 — Read the file

Read `apps/web/data/races.ts` and extract all entries from the `RACES` array. Note the full list of races (name, city, province, date, distance, id).

### Step 2 — Research each race in parallel

Dispatch one web research subagent per race. Each agent:
1. Searches for the race's **official website** (e.g. "BMO Vancouver Marathon 2026 official")
2. Falls back to RunGuides (runguides.com) if no official site found
3. Falls back to Running Canada or provincial running association listings
4. Extracts: official name, 2026 date, distances offered, city

Each agent returns one of four findings:
- **correct** — all fields match the source
- **needs update** — one or more fields differ; list what changed and the source URL
- **cancelled** — race is definitively cancelled for 2026 or permanently; note source
- **not found** — could not verify from any source; note the search failure reason

### Step 3 — Compile the correction report

Present a structured report grouped by status:

```
## Race Verification Report

### ⚠ Needs Update (N races)
| ID | Field | Current | Correct | Source |
|----|-------|---------|---------|--------|
| okanagan-full-2026 | name | Okanagan Marathon | Argus Kelowna Apple Marathon | runguides.com/... |
| okanagan-full-2026 | date | 2026-10-04 | 2026-09-26 | runguides.com/... |

### ✗ Cancelled (N races)
| ID | Note | Source |
|----|------|--------|
| example-full-2026 | Race cancelled indefinitely | racewebsite.com/... |

### ? Not Found (N races)
| ID | Note |
|----|------|
| example-half-2026 | Search returned no results |

### ✓ Correct (N races)
[list of IDs that verified correctly]
```

### Step 4 — Review gate

After the report, ask:

> "Reply `all` to apply all changes, or `skip [id1] [id2] ...` to exclude specific entries. Anything else aborts."

- `all`, `yes`, or `y` → apply all proposed changes (updates + removals for cancelled)
- `skip [id ...]` → exclude those IDs, apply the rest
- Anything else → re-prompt once: "Didn't catch that. Reply `all` to apply, `skip [ids]` to exclude some, or `cancel` to abort." If still unrecognized, abort with no changes.

### Step 5 — Apply and commit

For each approved change:
- **needs update**: edit the affected fields in the entry in `races.ts`
- **cancelled**: remove the entry from the `RACES` array entirely

**CRITICAL:** Preserve the `import type { Distance } from "@/components/onboarding/types"` line exactly. Do not alter imports.

After editing, commit:
```
data: update races.ts — {brief summary, e.g. "correct 3 dates, remove 1 cancelled race"}
```

If a pre-commit hook fails, surface the error to the user and stop. Do not retry or bypass hooks.

---

## Mode 2: Add Missing Races (Canada)

### Step 1 — Parse province scope

If the user provided a province code (e.g. `add BC`):
- Match case-insensitively against: `AB BC MB NB NL NS NT NU ON PE QC SK YT`
- If not on this list, output: "Unrecognized province code. Valid codes: AB BC MB NB NL NS NT NU ON PE QC SK YT" and exit

If no province was specified, search all provinces.

### Step 2 — Research missing races

For each province in scope, search for major Canadian road running events **not already in `races.ts`**.

Search queries: "[Province] road running races 2026", "[Province] marathon half marathon 2026 calendar", RunGuides province listing.

**"Major" race criteria — all must be true:**
- Registration-required road running event (not virtual-only)
- Has run at least 2 consecutive years
- Offers at least one distance of 10K, half marathon, full marathon, or ultra
- No new 5K-only events; 5K distances may only be added if the race also offers 10K or longer

**Deduplication:** Before adding a candidate, normalize both the candidate name and all existing entry names: lowercase, strip punctuation, remove distance-indicator words ("marathon", "half marathon", "half", "10k", "5k", "full", "ultra"). If the normalized candidate name matches an existing entry's normalized name AND the distance matches AND the year matches, it's a duplicate — skip silently. If the match is ambiguous, surface it to the user.

**Do not** search for ultra-only events. Ultras already in the file are handled by Mode 1.

If a province search fails entirely, note the failure and continue.

### Step 3 — Assign provisional IDs

Before presenting the report, assign a provisional ID to each candidate:

**ID format:** `{slugified-city}-{distance}-{year}`
- Slugify: lowercase, spaces → hyphens, strip all non-alphanumeric except hyphens
- Year = calendar year of race date
- If two candidates in same city share same distance and year, prefix with disambiguating race name slug

Examples: `kelowna-half-2026`, `victoria-full-2026`, `scotiabank-toronto-full-2026`

### Step 4 — Compile the additions report

```
## Race Discovery Report — [Province(s)]

### Proposed Additions (N races)
| Provisional ID | Name | City | Province | Date | Distance | Source |
|---|---|---|---|---|---|---|
| kelowna-half-2026 | Argus Kelowna Apple Marathon | Kelowna | BC | 2026-09-27 | half | runguides.com/... |

### Skipped (duplicates)
[list any candidates that matched existing entries, with reason]

### Search failures
[list any provinces where the search returned no results]
```

### Step 5 — Review gate

Same as Mode 1: ask `all` / `skip [ids]` / anything else aborts (re-prompt once).

### Step 6 — Apply and commit

Append approved entries to the `RACES` array in `races.ts`, maintaining the existing grouping by province (insert under the correct province comment block).

**CRITICAL:** Preserve the `import type { Distance } from "@/components/onboarding/types"` line exactly.

Commit:
```
data: update races.ts — add N Canadian races ([province list])
```

If a pre-commit hook fails, surface the error and stop.

---

## Mode 3: USA Stub

Triggered only by the literal string `add USA`. Any other unrecognized two-letter code (e.g. `TX`) falls through to Mode 2's error handler (valid province codes list + exit).

Output:

> "USA race support is coming in a future update."

Then exit. Do nothing else.

---

## ID Generation Quick Reference

| Scenario | ID |
|---|---|
| Only one full marathon in a city | `{city}-full-{year}` |
| Only one half marathon in a city | `{city}-half-{year}` |
| Two full marathons in same city same year | `{race-slug}-{city}-full-{year}` |
| Multi-distance event | One entry per distance, same date, disambiguated IDs if needed |

---

## Research Source Priority

1. Official race website
2. RunGuides (runguides.com)
3. Running Canada / provincial running association calendars
```

- [ ] **Step 3: Verify the file was created and is readable**

```bash
cat ~/.claude/skills/verify-races.md | head -5
```

Expected output starts with:
```
---
name: verify-races
description: Use when maintaining race data...
```

- [ ] **Step 4: Commit the plan**

```bash
cd /Users/zackdorward/dev/athlos
git add docs/superpowers/plans/2026-03-16-verify-races.md
git commit -m "docs: add verify-races implementation plan"
```

---

## Chunk 2: Manual Verification

### Task 2: Test Mode 1 — verify existing races

- [ ] **Step 1: Start a fresh Claude Code session in the Athlos project**

Open Claude Code in `/Users/zackdorward/dev/athlos`.

- [ ] **Step 2: Invoke the skill**

Type: `/verify-races`

Expected: Claude reads `apps/web/data/races.ts`, dispatches research agents for each race, and presents a structured correction report grouped by status (✓ correct / ⚠ needs update / ✗ cancelled / ? not found).

- [ ] **Step 3: Verify report structure**

The report must include:
- A section for each status category (even if empty)
- Source URLs for any ⚠ needs update entries
- A search failure reason in the note column for any ? not found entries
- The approval prompt at the end: "Reply `all` to apply all changes..."

- [ ] **Step 4: Test the "all" approval path**

When prompted for approval, type: `all`

Expected: Claude applies all proposed changes (updates + removals) and commits with a message matching `data: update races.ts — ...`

- [ ] **Step 5: Verify the commit**

```bash
git log --oneline -3
```

Expected: top commit matches format `data: update races.ts — ...`

- [ ] **Step 6: Test the skip flow**

In a new session, run `/verify-races` again. When the report appears:
- If there are ⚠ needs update or ✗ cancelled entries, type: `skip [one of those IDs]`
  - Expected: Claude applies all other changes, skips the specified ID, and commits
- If all races come back ✓ correct, type `all` and verify the skill outputs "No changes needed" or similar and does not commit

- [ ] **Step 7: Test Mode 1 abort flow**

In a new session, run `/verify-races`. When prompted, type something unrecognized (e.g. `sure`).

Expected: Claude re-prompts once. Type something unrecognized again. Expected: Claude aborts with no changes to `races.ts`.

### Task 3: Test Mode 2 — add missing BC races

- [ ] **Step 1: Invoke add mode for a single province**

Type: `/verify-races add BC`

Expected: Claude searches for major BC road races not already in `races.ts`, assigns provisional IDs, and presents an additions report with:
- A "Proposed Additions" table including columns: Provisional ID, Name, City, Province, Date, Distance, Source
- A "Skipped (duplicates)" section
- A "Search failures" section (may be empty)
- The approval prompt at the end

- [ ] **Step 2: Verify deduplication**

The report must NOT include races already in `races.ts` (e.g. BMO Vancouver Marathon, Royal Victoria Marathon, Okanagan Marathon should not appear as candidates).

- [ ] **Step 3: Test invalid province code**

Type: `/verify-races add ZZ`

Expected: Claude outputs the error message listing all valid province codes (`AB BC MB NB NL NS NT NU ON PE QC SK YT`) and exits without touching the file.

- [ ] **Step 4: Test unrecognized two-letter code gets province error (not USA stub)**

Type: `/verify-races add TX`

Expected: Claude outputs the province error listing valid codes (`AB BC MB NB NL NS NT NU ON PE QC SK YT`) and exits — same behavior as `ZZ` in Step 3. Does NOT output the USA stub message.

- [ ] **Step 5: Test explicit USA stub**

Type: `/verify-races add USA`

Expected: Claude outputs "USA race support is coming in a future update." and exits.

- [ ] **Step 6: Test abort flow**

Start `/verify-races add BC`, then when prompted for approval, type something unrecognized (e.g. `maybe`).

Expected: Claude re-prompts once. Type something unrecognized again. Expected: Claude aborts with no changes to `races.ts`.

- [ ] **Step 7: Test all-provinces mode**

Type: `/verify-races add`

Expected: Claude searches all 13 Canadian provinces, presents a combined additions report, and does not error out. Verify at least one province's results appear in the report.
