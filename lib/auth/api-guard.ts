import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { getCurrentUser } from "@/lib/auth/session";
import type { UserDoc } from "@/lib/models/User";

export type ApiGuardResult =
  | { ok: true; user: UserDoc }
  | { ok: false; response: NextResponse };

/**
 * Standard gate for every protected API route: session cookie verified via
 * Admin SDK + allowlist re-checked (both inside getCurrentUser), then a
 * per-user rate limit scoped to the route key.
 */
export async function guardApiRequest(
  routeKey: string,
  options: { limit?: number; windowMs?: number } = {},
): Promise<ApiGuardResult> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }

  const rate = checkRateLimit(`${routeKey}:${user.uid}`, options);
  if (!rate.allowed) {
    const response = NextResponse.json(
      { error: "rate_limited" },
      { status: 429 },
    );
    response.headers.set("Retry-After", String(rate.retryAfterSeconds));
    return { ok: false, response };
  }

  return { ok: true, user };
}
