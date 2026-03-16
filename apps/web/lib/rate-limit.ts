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
