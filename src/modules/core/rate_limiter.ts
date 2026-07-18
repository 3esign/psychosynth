// Rate limiter.
//
// Backed by Upstash Redis (a distributed store) when configured, so the limit
// holds GLOBALLY across the ephemeral serverless instances Vercel spins up. When
// Upstash is not configured we fall back to a bounded in-memory token bucket —
// fine for local development, but per-instance and therefore NOT a real limit in
// production (each lambda gets its own bucket). Production deployments MUST set
// UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN; a loud warning is logged
// once at boot if they are missing.

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const LIMIT = 60;               // requests
const WINDOW = '60 s' as const; // per sliding minute

const isProduction = (process.env.VERCEL_ENV ?? process.env.NODE_ENV) === 'production';

// ---------------------------------------------------------------------------
// Distributed limiter (Upstash) — preferred
// ---------------------------------------------------------------------------
let distributed: Ratelimit | null = null;
const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

if (upstashUrl && upstashToken) {
  distributed = new Ratelimit({
    redis: new Redis({ url: upstashUrl, token: upstashToken }),
    limiter: Ratelimit.slidingWindow(LIMIT, WINDOW),
    prefix: 'psx:rl',
    analytics: false,
  });
} else if (isProduction) {
  // Degraded, not fatal: we still limit per-instance below, but this is not a
  // true global limit. Surface it loudly so it gets fixed in the deployment env.
  console.error(
    '[rate_limiter] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set in production — ' +
    'rate limiting is per-instance only and easily exceeded. Configure Upstash Redis.',
  );
}

// ---------------------------------------------------------------------------
// In-memory fallback — bounded token bucket (dev / degraded)
// ---------------------------------------------------------------------------
type TokenBucket = { tokens: number; lastRefill: number };
const buckets = new Map<string, TokenBucket>();
const REFILL_RATE = LIMIT / 60000; // tokens per ms
const MAX_BUCKETS = 10_000;        // hard cap to prevent unbounded memory growth

function memoryRateLimit(key: string): boolean {
  const now = Date.now();

  // Evict the oldest entries if the map grows past the cap (spoofed-key defence).
  if (buckets.size >= MAX_BUCKETS && !buckets.has(key)) {
    let oldestKey: string | null = null;
    let oldest = Infinity;
    for (const [k, b] of buckets) {
      if (b.lastRefill < oldest) { oldest = b.lastRefill; oldestKey = k; }
    }
    if (oldestKey) buckets.delete(oldestKey);
  }

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: LIMIT, lastRefill: now };
  } else {
    const elapsed = now - bucket.lastRefill;
    bucket.tokens = Math.min(LIMIT, bucket.tokens + elapsed * REFILL_RATE);
    bucket.lastRefill = now;
  }

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    buckets.set(key, bucket);
    return true;
  }
  buckets.set(key, bucket);
  return false;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// Returns true if the request is allowed, false if it should be rejected (429).
// `key` should be a trusted client identifier — use clientIp() to derive it.
export async function rateLimit(key: string): Promise<boolean> {
  if (distributed) {
    try {
      const { success } = await distributed.limit(key);
      return success;
    } catch (e) {
      // Transient store failure: degrade to the in-memory limiter rather than
      // taking the API down over a Redis blip.
      console.error('[rate_limiter] Upstash error, falling back to in-memory:', (e as any)?.message);
      return memoryRateLimit(key);
    }
  }
  return memoryRateLimit(key);
}

// Derive a trusted client IP for rate-limit keying.
//
// On Vercel, `x-real-ip` is set by the platform to the true client address and
// cannot be spoofed by the caller — prefer it. `x-forwarded-for` is only used as
// a fallback for non-Vercel/local environments, and only its first hop is taken
// (the client-controlled entries are appended after the trusted ones). Never key
// on the raw, full XFF string, which a caller can rotate freely.
export function clientIp(req: Request): string {
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return 'unknown';
}
