import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

// Returns a new Ratelimit instance on each call.
// Factory (not singleton) so initialization errors are thrown at call time,
// inside the route handler's try/catch, rather than at module load time.
// Tradeoff: ephemeralCache is disabled — every request hits Redis. This is
// acceptable because the in-memory cache only works on a singleton instance,
// which we can't use without risking module-load-time crashes.
export function getRatelimit() {
  return new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(5, "24 h"),
    // analytics disabled: saves a Redis write per request
    analytics: false,
    // ephemeralCache disabled: per-call factory means each instance gets a fresh
    // Map, so the cache never hits. Explicit false makes this intentional.
    ephemeralCache: false,
  })
}
