# Playwright Onboarding Smoke Test Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install Playwright and add a single smoke test that verifies selecting a race on the landing page launches the onboarding flow.

**Architecture:** Playwright is installed as a dev dependency in `apps/web`. The config lives at `apps/web/playwright.config.ts` and tests in `apps/web/e2e/`. The `e2e/` directory has its own `tsconfig.json` so Playwright types don't bleed into the app's type-checking.

**Tech Stack:** `@playwright/test`, Next.js 16 / Turbopack, pnpm monorepo

---

## Chunk 1: Setup and smoke test

**Spec:** `docs/superpowers/specs/2026-03-15-playwright-onboarding-smoke-test-design.md`

**Files:**
- Modify: `apps/web/package.json` — add `@playwright/test` devDep + `test:e2e` script
- Create: `apps/web/playwright.config.ts` — Playwright config
- Modify: `apps/web/tsconfig.json` — add `"e2e"` to `exclude` array
- Create: `apps/web/e2e/tsconfig.json` — standalone TS config for Playwright
- Create: `apps/web/e2e/onboarding.spec.ts` — the test

---

- [ ] **Step 1: Install Playwright**

Run from `apps/web`:

```bash
cd apps/web && pnpm add -D @playwright/test && pnpm exec playwright install chromium
```

Expected: `@playwright/test` appears in `apps/web/package.json` devDependencies. Chromium browser is downloaded.

- [ ] **Step 2: Create `apps/web/playwright.config.ts`**

```ts
import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: "http://localhost:3000",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
})
```

- [ ] **Step 3: Exclude `e2e/` from the app's TypeScript config**

In `apps/web/tsconfig.json`, the current `exclude` array is:
```json
"exclude": ["node_modules"]
```

Change it to:
```json
"exclude": ["node_modules", "e2e"]
```

This prevents `pnpm typecheck` from trying to type-check Playwright test files with the Next.js TypeScript config.

- [ ] **Step 4: Create `apps/web/e2e/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "types": ["@playwright/test"]
  },
  "include": ["./**/*.ts"]
}
```

Note: self-contained config (no `extends`). `NodeNext`/`NodeNext` is correct here — it is compatible with `apps/web` being `"type": "module"` and with Node.js module resolution. Playwright transforms `.ts` files via its own esbuild pipeline, so this tsconfig is used for type checking only.

- [ ] **Step 5: Add `test:e2e` script to `apps/web/package.json`**

Add to the `scripts` block:
```json
"test:e2e": "playwright test"
```

- [ ] **Step 6: Write the smoke test**

Create `apps/web/e2e/onboarding.spec.ts`:

```ts
import { test, expect } from "@playwright/test"

test("selecting a race from search launches the onboarding flow", async ({ page }) => {
  await page.goto("/")

  // Type into the race search — .click() auto-waits for the input to be visible
  // (the page shows a spinner while the auth session check resolves)
  await page.getByPlaceholder("Search races by name or city…").click()
  await page.getByPlaceholder("Search races by name or city…").fill("Toronto")

  // Click the first Toronto race result (div[role="button"] elements)
  await page.getByRole("button").filter({ hasText: /toronto/i }).first().click()

  // Onboarding flow is now mounted — both nav buttons are always present on mount
  await expect(page.getByRole("button", { name: "Go back" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Exit" })).toBeVisible()
})
```

- [ ] **Step 7: Run the test**

Run from `apps/web` (start `pnpm dev` first if not running):

```bash
cd apps/web && pnpm test:e2e
```

Expected output:
```
Running 1 test using 1 worker

  ✓  [chromium] › onboarding.spec.ts:3:1 › selecting a race from search launches the onboarding flow

  1 passed
```

If the test fails:
- `Timeout waiting for element` on the search input → the session check is taking too long; increase `timeout` in the config or check the dev server is running
- `strict mode violation` on the button selector → the `/toronto/i` filter isn't scoping correctly; inspect the DOM to see what `div[role="button"]` elements are present

- [ ] **Step 8: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml apps/web/playwright.config.ts apps/web/tsconfig.json apps/web/e2e/tsconfig.json apps/web/e2e/onboarding.spec.ts
git commit -m "test: add Playwright and onboarding launch smoke test"
```
