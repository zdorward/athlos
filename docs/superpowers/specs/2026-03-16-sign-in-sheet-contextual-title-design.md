# Sign-In Sheet Contextual Title Design

## Goal

Show "Save your plan" when the sign-in sheet is opened from the plan page, and "Sign in to Athlos" when opened from the landing page (or any other generic context).

## Problem

`SignInSheet` hardcodes the heading "Save your plan" regardless of where it is opened from. Users who click "Log in" on the landing page see a heading that implies they have a plan to save, which is confusing.

## Solution

Add an optional `title` prop to `SignInSheet`. Default to `"Save your plan"` so the plan page requires no change. Pass `title="Sign in to Athlos"` from the landing page call site.

## Architecture

**Files changed:**

- `apps/web/app/plan/sign-in-sheet.tsx` — add `title?: string` to `SignInSheetProps`; render `{title}` instead of the hardcoded string. Default: `"Save your plan"`.
- `apps/web/app/page.tsx` — pass `title="Sign in to Athlos"` to the `<SignInSheet>` already rendered there.

No logic changes. No new state. No routing dependency.

## Non-Goals

- Do not derive the title from `callbackURL` or any other prop.
- Do not add subtitle or description customisation (YAGNI).
