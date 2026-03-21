# Settings Navigation Design

## Problem

Settings is only reachable via footer links buried in the dashboard. It is not discoverable on mobile, and the desktop avatar dropdown has no settings link.

## Solution

Add an Account tab to the mobile bottom nav and a Settings link to the desktop avatar dropdown. No changes to the settings page content or `/settings` route.

## Changes

### `app-nav.tsx`

**Mobile bottom bar:** Add a third tab — icon `User` (Lucide), label "Account", href `/settings`. Active state follows the same logic as Dashboard and Plan tabs (stroke width 2.5 active, 1.5 inactive; label color changes).

The Account tab must be added only to the mobile bottom bar section, not to the shared `tabs` array that also drives the desktop nav links. The desktop nav should not gain an "Account" text link — settings belongs only in the dropdown there.

**Desktop avatar dropdown:** Add a `DropdownMenuItem` using `asChild` with a Next.js `<Link href="/settings">` for client-side navigation, labeled "Settings". Place it above the existing Sign Out item, separated by a `<DropdownMenuSeparator />`.

### `dashboard-client.tsx`

Remove all links to `/settings`. There are three locations:
- Inside the `plan === "error"` render branch
- Inside the `plan === "empty"` render branch
- Inside the main resolved-plan render path (footer area)

## Out of Scope

- Changes to the settings page content (units toggle, account info, sign out)
- Changes to the `/settings` route
- Any new settings options
