import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import mongoose from "mongoose";

/**
 * Mints a real session cookie for a dedicated E2E test account: ensures the
 * Firebase user + allowlist entry exist, exchanges an Admin-minted custom
 * token for an ID token via the Identity Toolkit REST API, then runs it
 * through the app's own /api/auth/login.
 */

export const BASE_URL = "http://localhost:3000";
const E2E_UID = "e2e-card-browser-bot";
const E2E_EMAIL = "e2e-bot@mtgvault.test";

export function hasE2ECredentials(): boolean {
  return !!(
    process.env.MONGODB_URI &&
    process.env.FIREBASE_ADMIN_PROJECT_ID &&
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
    process.env.FIREBASE_ADMIN_PRIVATE_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  );
}

function getAdminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    }),
  });
}

async function ensureE2EUser(): Promise<string> {
  const auth = getAuth(getAdminApp());
  try {
    return (await auth.getUser(E2E_UID)).uid;
  } catch {
    try {
      return (
        await auth.createUser({
          uid: E2E_UID,
          email: E2E_EMAIL,
          emailVerified: true,
        })
      ).uid;
    } catch {
      // Email already taken by a previous run with a different uid.
      return (await auth.getUserByEmail(E2E_EMAIL)).uid;
    }
  }
}

async function ensureAllowlisted(): Promise<void> {
  const conn = await mongoose
    .createConnection(process.env.MONGODB_URI!, { dbName: "mtg-vault" })
    .asPromise();
  try {
    await conn
      .collection("allowlistentries")
      .updateOne(
        { email: E2E_EMAIL },
        { $set: { email: E2E_EMAIL, role: "user", addedBy: "e2e" } },
        { upsert: true },
      );
  } finally {
    await conn.close();
  }
}

export async function createE2ESessionCookie(): Promise<{
  name: string;
  value: string;
}> {
  const uid = await ensureE2EUser();
  await ensureAllowlisted();

  const customToken = await getAuth(getAdminApp()).createCustomToken(uid);
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!;
  const exchange = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  if (!exchange.ok) {
    throw new Error(`Custom token exchange failed: ${exchange.status}`);
  }
  const { idToken } = (await exchange.json()) as { idToken: string };

  const login = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!login.ok) {
    throw new Error(`/api/auth/login failed: ${login.status}`);
  }
  const setCookie = login.headers.get("set-cookie") ?? "";
  const match = /mtgv_session=([^;]+)/.exec(setCookie);
  if (!match) throw new Error("No session cookie in login response");
  return { name: "mtgv_session", value: match[1] };
}
