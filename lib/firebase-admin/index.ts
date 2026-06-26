import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth, type DecodedIdToken } from "firebase-admin/auth";
import { getServerEnv } from "@/lib/env";

function getAdminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  const env = getServerEnv();
  return initializeApp({
    credential: cert({
      projectId: env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY,
    }),
  });
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

const GOOGLE_CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

/**
 * Fetch Google's token-signing cert endpoint directly and summarise the
 * response. Used as a boot-time self-test so a host that gets an HTML page back
 * (a blocked/shared IP "Sorry" page, a proxy/captive portal, or a redirect)
 * instead of the expected JSON is immediately visible in the logs.
 */
export async function probeGoogleCerts(): Promise<string> {
  try {
    const res = await fetch(GOOGLE_CERTS_URL, { redirect: "manual" });
    const body = await res.text();
    const snippet = body.slice(0, 200).replace(/\s+/g, " ").trim();
    const looksJson = (res.headers.get("content-type") ?? "").includes("json");
    return [
      looksJson && res.status === 200 ? "OK" : "BAD",
      `status=${res.status}`,
      `type=${res.headers.get("content-type") ?? "-"}`,
      `location=${res.headers.get("location") ?? "-"}`,
      `body="${snippet}"`,
    ].join(" ");
  } catch (err) {
    return `FETCH-THREW ${(err as Error)?.name}: ${(err as Error)?.message}`;
  }
}

/** A failure to FETCH Google's public signing keys (a transient infra/egress
 *  blip) rather than a genuinely bad token — these are worth retrying. */
function isTransientVerifyError(err: unknown): boolean {
  const msg = (err as Error)?.message ?? "";
  return /fetching public keys|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|network|<!DOCTYPE/i.test(
    msg,
  );
}

/**
 * Verify a Firebase ID token, retrying briefly when the Admin SDK can't fetch
 * Google's public certs (e.g. a cold-start network blip on the socket host that
 * returns an HTML error page). An invalid/expired token fails immediately — only
 * the key-fetch infra failures are retried, so a transient hiccup no longer
 * rejects the handshake (and every player) until the next lucky fetch.
 */
export async function verifyIdTokenResilient(
  token: string,
  attempts = 3,
): Promise<DecodedIdToken> {
  const auth = getAdminAuth();
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await auth.verifyIdToken(token);
    } catch (err) {
      lastErr = err;
      if (!isTransientVerifyError(err)) throw err;
      await new Promise((r) => setTimeout(r, 200 * (i + 1)));
    }
  }
  throw lastErr;
}
