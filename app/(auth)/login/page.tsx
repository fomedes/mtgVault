"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithPopup, signOut } from "firebase/auth";
import { Button } from "@/components/ui/button";
import {
  createGoogleProvider,
  createMicrosoftProvider,
  getFirebaseAuth,
} from "@/lib/firebase/client";

type Status = "idle" | "signing-in" | "not-allowlisted" | "error";
type Provider = "google" | "microsoft";

export default function LoginPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [activeProvider, setActiveProvider] = useState<Provider | null>(null);

  async function handleSignIn(provider: Provider) {
    setStatus("signing-in");
    setActiveProvider(provider);
    const auth = getFirebaseAuth();
    const authProvider =
      provider === "google" ? createGoogleProvider() : createMicrosoftProvider();
    try {
      const credential = await signInWithPopup(auth, authProvider);
      const idToken = await credential.user.getIdToken();
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (response.ok) {
        router.push("/dashboard");
        router.refresh();
        return;
      }
      // No session was created; drop the client-side Firebase sign-in too.
      await signOut(auth);
      setStatus(response.status === 403 ? "not-allowlisted" : "error");
    } catch {
      setStatus("error");
    } finally {
      setActiveProvider(null);
    }
  }

  const signingIn = status === "signing-in";

  return (
    <main className="flex min-h-svh flex-1 flex-col items-center justify-center gap-8 px-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-4xl font-bold tracking-tight">MTG Vault</h1>
        <p className="text-muted-foreground max-w-sm text-sm">
          Private draft &amp; collection vault. Invite-only — sign in with an
          approved account.
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Button
          size="lg"
          onClick={() => handleSignIn("google")}
          disabled={signingIn}
        >
          {signingIn && activeProvider === "google"
            ? "Signing in…"
            : "Sign in with Google"}
        </Button>

        <Button
          size="lg"
          variant="outline"
          onClick={() => handleSignIn("microsoft")}
          disabled={signingIn}
        >
          {signingIn && activeProvider === "microsoft"
            ? "Signing in…"
            : "Sign in with Microsoft"}
        </Button>
      </div>

      {status === "not-allowlisted" && (
        <p className="text-destructive max-w-sm text-center text-sm">
          You&apos;re not on the list. Ask the vault keeper to add your account
          email, then try again.
        </p>
      )}
      {status === "error" && (
        <p className="text-destructive max-w-sm text-center text-sm">
          Sign-in failed. Check your connection and try again.
        </p>
      )}
    </main>
  );
}
