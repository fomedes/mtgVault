export interface RateLimitBucket {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  limit?: number;
  windowMs?: number;
  now?: number;
  store?: Map<string, RateLimitBucket>;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * The bucket store is cached on globalThis so Next.js dev hot reloads keep
 * one store. Note: in-memory means per-instance on serverless — acceptable
 * for an invite-only group; it still stops runaway clients per instance.
 */
const globalForRateLimit = globalThis as unknown as {
  rateLimitStore?: Map<string, RateLimitBucket>;
};

function defaultStore(): Map<string, RateLimitBucket> {
  globalForRateLimit.rateLimitStore ??= new Map();
  return globalForRateLimit.rateLimitStore;
}

const MAX_STORE_SIZE = 5000;

/** Fixed-window counter per key (e.g. `${route}:${uid}`). */
export function checkRateLimit(
  key: string,
  options: RateLimitOptions = {},
): RateLimitResult {
  const {
    limit = 120,
    windowMs = 60_000,
    now = Date.now(),
    store = defaultStore(),
  } = options;

  if (store.size > MAX_STORE_SIZE) {
    for (const [k, bucket] of store) {
      if (bucket.resetAt <= now) store.delete(k);
    }
  }

  const existing = store.get(key);
  if (!existing || existing.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  existing.count++;
  if (existing.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((existing.resetAt - now) / 1000),
      ),
    };
  }
  return {
    allowed: true,
    remaining: limit - existing.count,
    retryAfterSeconds: 0,
  };
}
