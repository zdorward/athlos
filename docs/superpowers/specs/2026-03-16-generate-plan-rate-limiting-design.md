---
title: Generate Plan Rate Limiting
date: 2026-03-16
status: approved
---

## Problem

`/api/generate-plan` is a publicly accessible endpoint with no auth requirement — by design, so new users can experience the plan generation before signing up. However, the endpoint currently has no abuse protection, allowing a bad actor to trigger unlimited LLM calls.

## Decision

Keep the "generate first, auth to save" funnel intact (the streaming plan generation is the product's magic moment). Add IP-based rate limiting to `POST /api/generate-plan` as lightweight abuse protection.

Rate limiting is skipped entirely in development (`NODE_ENV !== 'production'`) so local testing is unaffected.

## Design

### Dependencies

Add to `apps/web`:
- `@upstash/ratelimit`
- `@upstash/redis`

### New file: `apps/web/lib/rate-limit.ts`

Exports a **factory function** (not a singleton) that creates a `Ratelimit` instance on demand. Deferring initialization to call time means errors from missing env vars or Redis unavailability are thrown inside the route handler where they can be caught, not at module load time where they would crash the entire route module.

```ts
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

export function getRatelimit() {
  return new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(5, "24 h"),
    analytics: false,
  })
}
```

Algorithm: sliding window, **5 requests per IP per 24 hours**.

### Modified: `apps/web/app/api/generate-plan/route.ts`

At the top of the `POST` handler, before any processing:

1. If `NODE_ENV !== 'production'`, skip the check entirely.
2. Extract the client IP using this priority order:
   - `request.ip` (set by Vercel's edge runtime — most reliable)
   - `x-real-ip` header
   - First value of `x-forwarded-for` header (`.split(',')[0]?.trim()` — the header may contain a comma-separated list of proxy hops)
   - Fall back to `'anonymous'`
3. Call `getRatelimit().limit(ip)` inside a try/catch. If the call throws (missing env vars, Upstash unavailable), fail open and allow the request through.
4. If `!success`, return a `429` response with body `{ "error": "Too many requests" }`, `Content-Type: application/json`, and a `Retry-After` header set to the seconds until the window resets: `Math.ceil((reset - Date.now()) / 1000)` where `reset` is the millisecond timestamp returned by `ratelimit.limit()`.

The `429` response body matches the existing error shape used elsewhere in this route (`{ error: "..." }`).

### Environment variables

Required in production (Vercel dashboard):

```
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Optionally add to `.env.local` for local Redis testing (not required — rate limiting is skipped in development).

## Rate limit parameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Window | 24 hours (sliding) | Resets naturally each day |
| Limit | 5 requests | Enough for a real user to try variations; deters bulk abuse |
| Algorithm | Sliding window | Fairer than fixed window; no burst at window boundary |

## Known limitations

- **Generic error UI on rate limit:** The existing `/plan` page sets `status("error")` on any non-ok response, including 429. This shows a generic error state with no indication the user hit a rate limit. This is a deliberate deferral — acceptable for now given zero current users. A follow-up can add 429-specific messaging to the plan page.
- **IP-based limits are bypassable** via VPN or mobile data rotation. This is accepted; the goal is deterrence, not elimination.

## What is not in scope

- Auth-gated plan generation (intentionally excluded — preserves the magic moment)
- Rate limiting other endpoints (not needed at this stage)
- Custom 429 UI on the plan page (deferred — see known limitations)
- Upstash analytics (unnecessary overhead for now)
