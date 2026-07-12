// In-memory token bucket rate limiter for M1 milestone.
// Note: In production or serverless environments where instances are ephemeral,
// this should be upgraded to use a distributed store like Redis (e.g. Upstash).

type TokenBucket = {
  tokens: number;
  lastRefill: number;
};

const buckets = new Map<string, TokenBucket>();

const BUCKET_SIZE = 60; // Max 60 tokens
const REFILL_RATE = 60 / 60000; // 60 tokens per 60000ms (1 token per 1000ms)

export function rateLimit(ip: string): boolean {
  const now = Date.now();
  let bucket = buckets.get(ip);

  if (!bucket) {
    bucket = { tokens: BUCKET_SIZE, lastRefill: now };
  } else {
    const elapsed = now - bucket.lastRefill;
    bucket.tokens = Math.min(BUCKET_SIZE, bucket.tokens + elapsed * REFILL_RATE);
    bucket.lastRefill = now;
  }

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    buckets.set(ip, bucket);
    return true;
  }

  return false;
}
