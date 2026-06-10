import { SignOutButton } from "@/components/auth/sign-out-button";
import { getCurrentUser } from "@/lib/auth/session";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null; // layout already redirects

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome, {user.displayName || user.email}
          </h1>
          <p className="text-muted-foreground text-sm">
            {user.role === "admin" ? "Admin" : "Drafter"} · {user.vaultCoins}{" "}
            Vault Coins
          </p>
        </div>
        <SignOutButton />
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Cards collected", value: 0 },
          { label: "Drafts played", value: 0 },
          { label: "Vault Coins", value: user.vaultCoins },
        ].map((stat) => (
          <div key={stat.label} className="bg-card rounded-lg border p-6">
            <p className="text-muted-foreground text-sm">{stat.label}</p>
            <p className="text-3xl font-bold">{stat.value}</p>
          </div>
        ))}
      </section>

      <p className="text-muted-foreground text-sm">
        The card browser arrives in Phase 1. Hang tight, planeswalker.
      </p>
    </main>
  );
}
