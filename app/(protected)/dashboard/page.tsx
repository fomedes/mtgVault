import Link from "next/link";
import { DailyClaim } from "@/components/layout/daily-claim";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { InviteList } from "@/components/dashboard/invite-list";
import { OpenLobbies } from "@/components/dashboard/open-lobbies";
import { getCurrentUser } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/game/dashboard";

export const revalidate = 0;

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const { stats, feed, pendingInvites, openLobbies, recommendation } =
    await getDashboardData(user.uid, user.vaultCoins);

  const QUICK_LINKS = [
    {
      href: "/shop",
      label: "Shop",
      desc: "Spend Vault Coins to open booster packs and grow your collection.",
    },
    {
      href: "/collection",
      label: "My Collection",
      desc: "View your cards, filter by set or colour, and export your list.",
    },
    {
      href: "/draft",
      label: "Draft",
      desc: "Create or join a live booster draft with up to 8 players.",
    },
    {
      href: "/decks",
      label: "Decks",
      desc: "Build decks from your collection, the card database, or draft picks.",
    },
    {
      href: "/cards",
      label: "Browse cards",
      desc: "Explore the curated sets — filters, search, rulings and all.",
    },
    {
      href: "/achievements",
      label: "Achievements",
      desc: "See every milestone you've hit and what rewards await.",
    },
    ...(user.role === "admin"
      ? [{ href: "/admin", label: "Admin", desc: "Manage users, allowlist, sets, and pack prices." }]
      : []),
  ];

  const STATS = [
    { label: "Unique cards", value: stats.uniqueCards },
    { label: "Total cards", value: stats.totalCards },
    { label: "Drafts played", value: stats.draftsPlayed },
    { label: "Vault Coins", value: stats.vaultCoins },
  ];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10">
      {/* Header */}
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome back, {user.displayName || user.email}
        </h1>
        <p className="text-muted-foreground text-sm">
          {user.role === "admin" ? "Admin" : "Drafter"} ·{" "}
          <span className="text-foreground font-semibold">{stats.vaultCoins} Vault Coins</span>
        </p>
      </header>

      {/* Daily bonus toast */}
      <DailyClaim />

      {/* Stats */}
      <section aria-label="Statistics">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STATS.map((stat) => (
            <div key={stat.label} className="bg-card rounded-lg border p-5">
              <p className="text-muted-foreground text-xs">{stat.label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{stat.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Recommendation banner */}
      {recommendation ? (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <p className="text-sm">
            <span className="font-medium">Ready to draft?</span>{" "}
            <span className="text-muted-foreground">
              You can afford a <span className="text-foreground">{recommendation.setName}</span>{" "}
              booster for {recommendation.boosterPrice} VC.
            </span>
          </p>
          <Link
            href="/shop"
            className="shrink-0 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            Open Shop
          </Link>
        </div>
      ) : null}

      {/* Invites */}
      <InviteList invites={pendingInvites} />

      {/* Open lobbies */}
      <OpenLobbies lobbies={openLobbies} />

      {/* Activity feed + Quick links in two-column layout on large screens */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <h2 className="mb-3 text-base font-semibold">Recent Activity</h2>
          <div className="bg-card rounded-lg border">
            <ActivityFeed feed={feed} />
          </div>
        </section>

        <section className="lg:col-span-2">
          <h2 className="mb-3 text-base font-semibold">Quick Links</h2>
          <div className="grid grid-cols-1 gap-2">
            {QUICK_LINKS.map(({ href, label, desc }) => (
              <Link
                key={href}
                href={href}
                className="bg-card hover:bg-muted/60 focus-visible:ring-ring/50 block rounded-lg border px-4 py-3 transition-colors outline-none focus-visible:ring-2"
              >
                <p className="text-sm font-semibold">{label} →</p>
                <p className="text-muted-foreground mt-0.5 text-xs">{desc}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
