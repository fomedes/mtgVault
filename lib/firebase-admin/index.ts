import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
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
