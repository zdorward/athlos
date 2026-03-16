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
