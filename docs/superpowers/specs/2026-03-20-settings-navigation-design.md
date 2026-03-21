# Settings Navigation Design

## Problem

Settings is only reachable via footer links buried in the dashboard. It is not discoverable on mobile, and the desktop avatar dropdown has no settings link.

## Solution

Add an Account tab to the mobile bottom nav and a Settings link to the desktop avatar dropdown. No changes to the settings page content or `/settings` route.

## Changes

### `app-nav.tsx`

**Mobile bottom bar:** Add a third tab — icon `User` (Lucide), label "Account", href `/settings`. Active state follows the same logic as Dashboard and Plan tabs (stroke width 2.5 active, 1.5 inactive; label color changes).

**Desktop avatar dropdown:** Add a "Settings" link (href `/settings`) above the existing Sign Out button, separated by a dropdown divider.

### `dashboard-client.tsx`

Remove all footer/inline links to `/settings`. They are redundant once settings is in the nav.

## Out of Scope

- Changes to the settings page content (units toggle, account info, sign out)
- Changes to the `/settings` route
- Any new settings options
