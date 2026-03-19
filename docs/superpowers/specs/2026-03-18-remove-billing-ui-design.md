# Remove Billing UI from Settings

**Date:** 2026-03-18
**Status:** Approved

## Summary

Remove the Billing section from the Settings page UI. The Stripe backend routes remain intact for future use.

## Scope

**In scope:**
- Delete the `{/* Billing */}` `<section>` block from `apps/web/app/(app)/settings/page.tsx`
- Remove state variables only used for billing: `plan`, `loadingBilling`, `billingError`
- Remove the `useEffect` that fetches `/api/user` to determine plan status
- Remove `handleUpgrade()` and `handleManageBilling()` functions

**Out of scope:**
- `apps/web/app/api/stripe/checkout/route.ts` — untouched
- `apps/web/app/api/stripe/portal/route.ts` — untouched
- `apps/web/app/api/stripe/webhook/route.ts` — untouched
- `apps/web/app/api/user/route.ts` — untouched

## Result

The Settings page will contain two sections: Preferences and Account. All billing-specific state and logic is removed from the component, leaving no dead code.
