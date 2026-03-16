# Playwright Onboarding Smoke Test — Design

**Date:** 2026-03-15
**Status:** Approved

## Overview

Add Playwright E2E testing to the Athlos web app, starting with a single smoke test that verifies the onboarding flow launches correctly when a user selects a race from the landing page search.

## Goals

- Confirm Playwright is installed and wired up correctly in the monorepo
- Catch regressions in the most critical public entry point: race search → onboarding launch
- Keep it simple — one test, one browser, no auth required

## Setup

### Installation (run from `apps/web`)

```bash
pnpm add -D @playwright/test
pnpm exec playwright install chromium
```

Do NOT use `pnpm dlx create-playwright` — it is an interactive scaffolding tool that generates conflicting config files and a nested `package.json` incompatible with this monorepo structure.

### Config file: `apps/web/playwright.config.ts`

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:3000',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'pnpm dev',   // runs `next dev --turbopack` per the apps/web dev script
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

The `webServer.command` is run from `apps/web` (Playwright's working directory when the config is there). `reuseExistingServer` is `true` locally (reuses a running `pnpm dev`) and `false` in CI (starts fresh).

### TypeScript

Exclude `e2e/` from the root `apps/web/tsconfig.json` (so `pnpm typecheck` doesn't try to type-check test files with the Next.js config), and give it its own standalone config:

**`apps/web/tsconfig.json`** — add `"e2e"` to the `exclude` array:
```json
"exclude": ["node_modules", "e2e"]
```

**`apps/web/e2e/tsconfig.json`** — standalone config for Playwright:
```json
{
  "extends": "@workspace/typescript-config/base.json",
  "compilerOptions": {
    "types": ["@playwright/test"],
    "moduleResolution": "bundler"
  },
  "include": ["./**/*.ts"]
}
```

### Script

Add to `apps/web/package.json`:

```json
"test:e2e": "playwright test"
```

## The Test

**File:** `apps/web/e2e/onboarding.spec.ts`

**Scenario:** Searching for a race and selecting it launches the onboarding flow.

### Selectors

- **Search input:** `page.getByPlaceholder('Search races by name or city…')` — note the Unicode ellipsis character `…` (U+2026), not three periods.
- **First race result:** `page.getByRole('button').filter({ hasText: /toronto/i }).first()` — race rows are `div[role="button"]` elements rendered by `DropdownRaceRow`. Filtering by the search term scopes the query away from unrelated buttons on the page.
- **Onboarding nav assertion:** `page.getByRole('button', { name: 'Go back' })` and `page.getByRole('button', { name: 'Exit' })` — confirmed in `onboarding-flow.tsx`: both are rendered unconditionally once `OnboardingFlow` mounts (when `showExitConfirm` is false, which is the initial state).

### Waits and timing

The landing page calls `authClient.useSession()` which makes a network request on mount. While that request is pending, the page renders only a loading spinner — the search input is not in the DOM yet. However, **Playwright's built-in actionability checks** mean that `locator.click()` automatically waits for the element to be visible before acting. No explicit `waitFor` call is needed; calling `.click()` on the search input locator is sufficient.

The race list (`RACES`) is local data filtered client-side — once the input is visible, typing produces results synchronously with no network call. No network mocking needed.

### Steps

1. Navigate to `/`
2. Click the search input (`getByPlaceholder(...)`)
3. Type `"Toronto"`
4. Click the first race result button
5. Assert `getByRole('button', { name: 'Go back' })` is visible
6. Assert `getByRole('button', { name: 'Exit' })` is visible

## What This Does Not Test

- Individual onboarding step content or navigation
- Saving a plan (requires auth)
- Dashboard (requires auth)
- Mobile viewport (can be added later)

## CI Integration

Out of scope for this initial test. Wire up to CI in a follow-up once the test is stable locally.

## Future Tests

- Full happy-path walkthrough (search → select → complete all steps → final screen)
- Authenticated dashboard smoke test using Playwright `storageState`
