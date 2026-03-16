# Generate Plan Rate Limiting Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add IP-based rate limiting (5 requests/IP/24h) to `POST /api/generate-plan`, skipped in development, using Upstash Redis.

**Architecture:** A `getRatelimit()` factory function in `lib/rate-limit.ts` creates an Upstash `Ratelimit` instance on demand. The route handler calls it at the top of `POST`, wrapped in try/catch to fail open on errors. IP is extracted from Vercel headers with a priority fallback chain.

**Tech Stack:** `@upstash/ratelimit`, `@upstash/redis`, Next.js App Router API route

---

## Chunk 1: Install packages and create rate-limit module

### Task 1: Install Upstash packages

**Files:**
- Modify: `apps/web/package.json` (via pnpm)

- [ ] **Step 1: Install packages**

Run from the repo root:

```bash
pnpm add --filter web @upstash/ratelimit @upstash/redis
```

Expected: both packages appear in `apps/web/package.json` under `dependencies`.

- [ ] **Step 2: Verify lockfile updated**

```bash
git diff --stat
```

Expected: `apps/web/package.json` and `pnpm-lock.yaml` are modified.

---

### Task 2: Create `lib/rate-limit.ts`

**Files:**
- Create: `apps/web/lib/rate-limit.ts`

- [ ] **Step 1: Create the file**

Create `apps/web/lib/rate-limit.ts` with this exact content:

```ts
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

// Returns a new Ratelimit instance on each call.
// Factory (not singleton) so initialization errors are thrown at call time,
// inside the route handler's try/catch, rather than at module load time.
export function getRatelimit() {
  return new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(5, "24 h"),
    // analytics disabled: saves a Redis write per request
    analytics: false,
  })
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors. If `@upstash/ratelimit` or `@upstash/redis` types are missing, verify the packages installed correctly in Task 1.

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml apps/web/lib/rate-limit.ts
git commit -m "feat: add getRatelimit factory for Upstash rate limiting"
```

---

## Chunk 2: Add rate limit check to the route handler

### Task 3: Modify `route.ts`

**Files:**
- Modify: `apps/web/app/api/generate-plan/route.ts`

The current file (read it before editing):

```ts
import { type NextRequest } from "next/server"
import { getProvider, type PlanGenerationInput } from "@workspace/ai"

export async function POST(req: NextRequest) {
  let input: PlanGenerationInput
  try {
    input = (await req.json()) as PlanGenerationInput
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }
  // ... rest of handler
```

- [ ] **Step 1: Add the import**

At the top of `apps/web/app/api/generate-plan/route.ts`, add the import for `getRatelimit`:

```ts
import { getRatelimit } from "@/lib/rate-limit"
```

Place it after the existing imports.

- [ ] **Step 2: Add the rate limit block**

Insert the following block at the very top of the `POST` function body, before the `let input: PlanGenerationInput` declaration:

```ts
  // Rate limiting — skipped in development
  if (process.env.NODE_ENV === "production") {
    const ip =
      req.ip ??
      req.headers.get("x-real-ip") ??
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "anonymous"

    try {
      const { success, reset } = await getRatelimit().limit(ip)
      if (!success) {
        return new Response(JSON.stringify({ error: "Too many requests" }), {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)),
          },
        })
      }
    } catch {
      // Upstash unavailable or env vars missing — fail open
    }
  }
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: Run lint**

```bash
pnpm lint
```

Expected: no errors. Fix any lint issues before committing.

- [ ] **Step 5: Verify the 429 response is well-formed (temporary bypass test)**

The `NODE_ENV` guard prevents testing the rate limit in dev. Temporarily bypass it to verify the 429 fires correctly before committing.

In `route.ts`, comment out the production guard so the rate limit always runs:

```ts
// if (process.env.NODE_ENV === "production") {   <-- comment this out temporarily
```

Also comment out the closing `}` for that block.

Add the Upstash env vars to `apps/web/.env.local` (get these from the Upstash dashboard — see Chunk 3 Task 4 Step 1 for setup):

```
UPSTASH_REDIS_REST_URL=<your REST URL>
UPSTASH_REDIS_REST_TOKEN=<your REST token>
```

Start the dev server and fire the endpoint 6 times (limit is 5):

```bash
for i in {1..6}; do
  curl -s -o /dev/null -w "Request $i: HTTP %{http_code}\n" \
    -X POST http://localhost:3000/api/generate-plan \
    -H "Content-Type: application/json" \
    -d '{"goal":"race","selectedDays":["mon","wed","fri"],"longRunDay":"sun","race":{"name":"Test","date":"2026-10-01","distance":"full","city":"Boston"},"units":"km","weeklyMileageRange":"40-60"}'
done
```

Expected: requests 1–5 return `HTTP 200`, request 6 returns `HTTP 429`.

Inspect the 429 response headers:

```bash
curl -v -X POST http://localhost:3000/api/generate-plan \
  -H "Content-Type: application/json" \
  -d '{"goal":"race","selectedDays":["mon","wed","fri"],"longRunDay":"sun","race":{"name":"Test","date":"2026-10-01","distance":"full","city":"Boston"},"units":"km","weeklyMileageRange":"40-60"}' \
  2>&1 | grep -E "HTTP|retry-after|content-type"
```

Verify:
- Status is `429`
- `content-type: application/json`
- `retry-after:` is a small integer (seconds, e.g. 1–86400) — **not** a large number like 86400000 (which would mean milliseconds were used instead of seconds, indicating a `reset` unit bug)

Inspect the body:

```bash
curl -s -X POST http://localhost:3000/api/generate-plan \
  -H "Content-Type: application/json" \
  -d '{"goal":"race","selectedDays":["mon","wed","fri"],"longRunDay":"sun","race":{"name":"Test","date":"2026-10-01","distance":"full","city":"Boston"},"units":"km","weeklyMileageRange":"40-60"}'
```

Expected body: `{"error":"Too many requests"}`

Once verified, **restore the `NODE_ENV` guard** (uncomment the lines). Also reset the Upstash rate limit key via the Upstash console (Data Browser → delete any keys starting with `@upstash/ratelimit`) or wait for the 24h window to reset.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/api/generate-plan/route.ts
git commit -m "feat: rate limit /api/generate-plan — 5 req/IP/24h, skipped in dev"
```

---

## Chunk 3: Upstash setup and environment variables

### Task 4: Create Upstash Redis database and configure env vars

This task is manual (Upstash dashboard + Vercel dashboard). No code changes.

- [ ] **Step 1: Create an Upstash Redis database**

1. Go to [console.upstash.com](https://console.upstash.com)
2. Create a new Redis database (free tier is sufficient)
3. Choose the region closest to your Vercel deployment region
4. Copy the **REST URL** and **REST Token** from the database dashboard

- [ ] **Step 2: Add env vars to Vercel**

In the Vercel project dashboard → Settings → Environment Variables, add:

```
UPSTASH_REDIS_REST_URL=<your REST URL>
UPSTASH_REDIS_REST_TOKEN=<your REST token>
```

Set scope to **Production** (and Preview if desired).

- [ ] **Step 3: Optionally add to `.env.local` for local Redis testing**

Only needed if you want to test the rate limiting logic locally (it is skipped in development by default, so this is optional):

```
UPSTASH_REDIS_REST_URL=<your REST URL>
UPSTASH_REDIS_REST_TOKEN=<your REST token>
```

Do not commit `.env.local` — it should already be in `.gitignore`.

- [ ] **Step 4: Redeploy and verify**

Deploy to Vercel (or let CI trigger a deploy). After deployment:

1. Go through the new user onboarding flow and generate a plan — confirm it works.
2. To verify the rate limiter is active (optional): check the Upstash console → database → Data Browser. After a plan generation from production, you should see rate limit keys appear. Keys are prefixed with `@upstash/ratelimit:` followed by the IP and algorithm metadata (exact format varies by library version — search for keys containing `@upstash/ratelimit`).

- [ ] **Step 5: Mark implementation complete**

Confirm all items in the final checklist below are checked off. No further commits are required for this feature.

---

## Final checklist

- [ ] `@upstash/ratelimit` and `@upstash/redis` in `apps/web/package.json`
- [ ] `apps/web/lib/rate-limit.ts` exports `getRatelimit` as a named export
- [ ] Rate limit block is the first thing in the `POST` handler body
- [ ] `NODE_ENV === "production"` guard is the outermost check
- [ ] IP priority order: `req.ip` → `x-real-ip` → first value of `x-forwarded-for` → `'anonymous'`
- [ ] `try/catch` around `getRatelimit().limit()` with no-op catch (fail open)
- [ ] 429 response has `Content-Type: application/json` and `Retry-After` header
- [ ] `Retry-After` value uses `Math.ceil((reset - Date.now()) / 1000)` (milliseconds → seconds)
- [ ] Typecheck and lint pass
- [ ] Upstash env vars set in Vercel dashboard
