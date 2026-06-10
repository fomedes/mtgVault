import { cookies } from "next/headers";
import { evaluateAllowlist, normalizeEmail } from "@/lib/auth/allowlist";
import { connectToDatabase } from "@/lib/db";
import { getAdminAuth } from "@/lib/firebase-admin";
import { AllowlistEntry } from "@/lib/models/AllowlistEntry";
import { User, type UserDoc } from "@/lib/models/User";

export const SESSION_COOKIE_NAME = "mtgv_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 5; // 5 days

export class NotAllowlistedError extends Error {
  constructor(email?: string) {
    super(`Account is not on the allowlist${email ? `: ${email}` : ""}`);
    this.name = "NotAllowlistedError";
  }
}

export interface SessionResult {
  sessionCookie: string;
  maxAgeSeconds: number;
  user: UserDoc;
}

/**
 * Exchanges a fresh Firebase ID token for a session cookie. Enforces the
 * allowlist: unknown emails never get a cookie or a User upgrade.
 */
export async function createSession(idToken: string): Promise<SessionResult> {
  const adminAuth = getAdminAuth();
  const decoded = await adminAuth.verifyIdToken(idToken);
  const email = normalizeEmail(decoded.email ?? "");
  if (!email) throw new NotAllowlistedError();

  await connectToDatabase();
  const entry = await AllowlistEntry.findOne({ email }).lean();
  const decision = evaluateAllowlist(entry);
  if (!decision.allowed) throw new NotAllowlistedError(email);

  const user = await User.findOneAndUpdate(
    { uid: decoded.uid },
    {
      $set: {
        email,
        displayName: decoded.name ?? "",
        photoURL: decoded.picture ?? "",
        role: decision.role,
        isAllowlisted: true,
        lastLoginAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();

  const sessionCookie = await adminAuth.createSessionCookie(idToken, {
    expiresIn: SESSION_DURATION_MS,
  });

  return {
    sessionCookie,
    maxAgeSeconds: SESSION_DURATION_MS / 1000,
    user: user as UserDoc,
  };
}

/**
 * Resolves the current user from the session cookie, re-checking the
 * allowlist flag on every call. Returns null for any failure mode.
 */
export async function getCurrentUser(): Promise<UserDoc | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!session) return null;
  try {
    const decoded = await getAdminAuth().verifySessionCookie(session, true);
    await connectToDatabase();
    const user = await User.findOne({ uid: decoded.uid }).lean();
    if (!user?.isAllowlisted) return null;
    return user as UserDoc;
  } catch {
    return null;
  }
}
