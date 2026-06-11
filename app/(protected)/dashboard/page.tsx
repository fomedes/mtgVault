import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { getCollectionStats } from "@/lib/game/collection";
import { getCurrentUser } from "@/lib/auth/session";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const { uniqueCards, totalCards } = await getCollectionStats(user.uid);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome, {user.displayName || user.email}
          </h1>
          <p className="text-muted-foreground text-sm">
            {user.role === "admin" ? "Admin" : "Drafter"} ·{" "}
            <span className="text-foreground font-semibold">{user.vaultCoins} Vault Coins</span>
          </p>
        </div>
        <SignOutButton />
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Unique cards", value: uniqueCards },
          { label: "Total cards", value: totalCards },
          { label: "Vault Coins", value: user.vaultCoins },
        ].map((stat) => (
          <div key={stat.label} className="bg-card rounded-lg border p-6">
            <p className="text-muted-foreground text-sm">{stat.label}</p>
            <p className="text-3xl font-bold">{stat.value}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/shop"
          className="bg-card hover:bg-muted/60 focus-visible:ring-ring/50 block rounded-lg border p-6 transition-colors outline-none focus-visible:ring-3"
        >
          <p className="font-semibold">Shop →</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Spend Vault Coins to open booster packs and add cards to your collection.
          </p>
        </Link>
        <Link
          href="/collection"
          className="bg-card hover:bg-muted/60 focus-visible:ring-ring/50 block rounded-lg border p-6 transition-colors outline-none focus-visible:ring-3"
        >
          <p className="font-semibold">My Collection →</p>
          <p className="text-muted-foreground mt-1 text-sm">
            View your cards, filter by set or colour, and export your list.
          </p>
        </Link>
        <Link
          href="/cards"
          className="bg-card hover:bg-muted/60 focus-visible:ring-ring/50 block rounded-lg border p-6 transition-colors outline-none focus-visible:ring-3"
        >
          <p className="font-semibold">Browse cards →</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Explore the curated sets — filters, search, rulings and all.
          </p>
        </Link>
        {user.role === "admin" ? (
          <Link
            href="/admin"
            className="bg-card hover:bg-muted/60 focus-visible:ring-ring/50 block rounded-lg border p-6 transition-colors outline-none focus-visible:ring-3"
          >
            <p className="font-semibold">Admin →</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Manage users, allowlist, sets, and pack prices.
            </p>
          </Link>
        ) : null}
      </section>
    </main>
  );
}
