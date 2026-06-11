import { describe, expect, it } from "vitest";
import { checkRateLimit, type RateLimitBucket } from "@/lib/auth/rate-limit";

describe("checkRateLimit", () => {
  it("allows up to the limit and then blocks with Retry-After", () => {
    const store = new Map<string, RateLimitBucket>();
    const options = { limit: 3, windowMs: 60_000, now: 1_000_000, store };

    expect(checkRateLimit("k", options).allowed).toBe(true);
    expect(checkRateLimit("k", options).allowed).toBe(true);
    expect(checkRateLimit("k", options).allowed).toBe(true);

    const blocked = checkRateLimit("k", options);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(60);
  });

  it("resets after the window elapses", () => {
    const store = new Map<string, RateLimitBucket>();
    const base = { limit: 1, windowMs: 60_000, store };

    expect(checkRateLimit("k", { ...base, now: 0 }).allowed).toBe(true);
    expect(checkRateLimit("k", { ...base, now: 1 }).allowed).toBe(false);
    expect(checkRateLimit("k", { ...base, now: 60_001 }).allowed).toBe(true);
  });

  it("tracks keys independently", () => {
    const store = new Map<string, RateLimitBucket>();
    const options = { limit: 1, windowMs: 60_000, now: 0, store };

    expect(checkRateLimit("user-a", options).allowed).toBe(true);
    expect(checkRateLimit("user-b", options).allowed).toBe(true);
    expect(checkRateLimit("user-a", options).allowed).toBe(false);
  });
});
