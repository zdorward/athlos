# Settings Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make settings discoverable by adding an Account tab to the mobile bottom nav and a Settings link to the desktop avatar dropdown, and remove the now-redundant footer links from the dashboard.

**Architecture:** Two files change. `app-nav.tsx` gets the Account tab added inline in the mobile `<nav>` (not via the shared `tabs` array, which also drives the desktop nav) and a Settings `DropdownMenuItem` added to the desktop dropdown. `dashboard-client.tsx` has three settings links removed.

**Tech Stack:** Next.js App Router, React, Lucide icons, Radix UI DropdownMenu (via `@workspace/ui`)

---

## File Map

| File | Change |
|------|--------|
| `apps/web/app/(app)/components/app-nav.tsx` | Add Account tab to mobile nav; add Settings to desktop dropdown |
| `apps/web/app/(app)/dashboard/dashboard-client.tsx` | Remove 3 settings links |

---

### Task 1: Add Account tab to mobile bottom nav

**Files:**
- Modify: `apps/web/app/(app)/components/app-nav.tsx`

The mobile `<nav>` currently iterates over `tabs` (Dashboard + Plan). Add the Account tab inline after the loop — do NOT add it to the `tabs` array, as that array also drives the desktop nav links.

- [ ] **Step 1: Add the Account tab link after the `tabs.map(...)` block in the mobile `<nav>`**

In `app-nav.tsx`, the mobile `<nav>` block runs from line 107–127. After the closing `})}` of the `tabs.map(...)`, add:

```tsx
{(() => {
  const active = pathname.startsWith("/settings")
  return (
    <Link
      href="/settings"
      className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
        active ? "text-foreground" : "text-muted-foreground"
      }`}
    >
      <User className={`h-5 w-5 ${active ? "stroke-[2.5]" : "stroke-[1.5]"}`} />
      Account
    </Link>
  )
})()}
```

Note: `User` is already imported from `lucide-react` (line 6). No new imports needed.

- [ ] **Step 2: Verify visually**

Run `pnpm dev` and open the app on a narrow viewport (or mobile). Confirm three tabs appear: Dashboard, Plan, Account. Confirm Account tab highlights when on `/settings`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/(app)/components/app-nav.tsx
git commit -m "feat: add Account tab to mobile bottom nav"
```

---

### Task 2: Add Settings link to desktop avatar dropdown

**Files:**
- Modify: `apps/web/app/(app)/components/app-nav.tsx`

The desktop dropdown (lines 91–102) currently has: label → separator → Sign out. Add a Settings item between the separator and Sign out, with its own separator above Sign out.

- [ ] **Step 1: Add Settings DropdownMenuItem above Sign out**

Replace the current dropdown content block:

```tsx
<DropdownMenuSeparator />
<DropdownMenuItem className="cursor-pointer" onClick={() => void handleSignOut()}>
  Sign out
</DropdownMenuItem>
```

With:

```tsx
<DropdownMenuSeparator />
<DropdownMenuItem asChild>
  <Link href="/settings">Settings</Link>
</DropdownMenuItem>
<DropdownMenuSeparator />
<DropdownMenuItem className="cursor-pointer" onClick={() => void handleSignOut()}>
  Sign out
</DropdownMenuItem>
```

`Link` is already imported from `next/link` (line 3). No new imports needed.

- [ ] **Step 2: Verify visually**

On desktop (md+ viewport), click the avatar. Confirm the dropdown shows: user info → Settings → Sign out. Click Settings and confirm it navigates to `/settings` without a full page reload (client-side navigation).

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/(app)/components/app-nav.tsx
git commit -m "feat: add Settings link to desktop avatar dropdown"
```

---

### Task 3: Remove redundant settings links from dashboard

**Files:**
- Modify: `apps/web/app/(app)/dashboard/dashboard-client.tsx`

Three separate `<Link href="/settings">` blocks exist and all need to be removed.

- [ ] **Step 1: Remove the settings link from the `plan === "error"` branch**

Around line 95–97, remove:

```tsx
<div className="pt-2">
  <Link href="/settings" className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors">Settings</Link>
</div>
```

- [ ] **Step 2: Remove the settings link from the `plan === "empty"` branch**

Around line 107–109, remove:

```tsx
<div className="pt-2">
  <Link href="/settings" className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors">Settings</Link>
</div>
```

- [ ] **Step 3: Remove the settings link from the main resolved-plan footer**

Around lines 239–246, remove:

```tsx
<div className="pt-4 text-center">
  <Link
    href="/settings"
    className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
  >
    Settings
  </Link>
</div>
```

- [ ] **Step 4: Check if `Link` is still used elsewhere in dashboard-client.tsx**

After removing the three links, grep for remaining `Link` usages to confirm the import is still needed. If no other `Link` usages remain, remove the `Link` import. (It is likely still used for "View full plan →" and "Create a Plan", so the import probably stays.)

- [ ] **Step 5: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/(app)/dashboard/dashboard-client.tsx
git commit -m "fix: remove redundant settings footer links from dashboard"
```

---

### Task 4: Push to develop and main

- [ ] **Step 1: Push develop**

```bash
git push origin develop
```

- [ ] **Step 2: Merge to main and push**

```bash
git checkout main && git merge develop && git push origin main && git checkout develop
```
