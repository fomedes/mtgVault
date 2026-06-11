import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import {
  NotAllowlistedError,
  SESSION_COOKIE_NAME,
  createSession,
} from "@/lib/auth/session";

const bodySchema = z.object({ idToken: z.string().min(1) });

export async function POST(request: Request) {
  // Unauthenticated endpoint: brute-force protection keyed by client IP.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const rate = checkRateLimit(`login:${ip ?? "unknown"}`, {
    limit: 20,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    const response = NextResponse.json(
      { error: "rate_limited" },
      { status: 429 },
    );
    response.headers.set("Retry-After", String(rate.retryAfterSeconds));
    return response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    const { sessionCookie, maxAgeSeconds, user } = await createSession(
      parsed.data.idToken,
    );
    const response = NextResponse.json({
      user: {
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
    });
    response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: maxAgeSeconds,
    });
    return response;
  } catch (error) {
    if (error instanceof NotAllowlistedError) {
      return NextResponse.json({ error: "not_allowlisted" }, { status: 403 });
    }
    console.error("[auth/login] failed:", error);
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }
}
