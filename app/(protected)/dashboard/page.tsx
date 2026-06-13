import { AchievementsProgress } from "@/components/dashboard/achievements-progress";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { FriendsActivity } from "@/components/dashboard/friends-activity";
import { InviteList } from "@/components/dashboard/invite-list";
import { OpenLobbies } from "@/components/dashboard/open-lobbies";
import { RecentDecks } from "@/components/dashboard/recent-decks";
import { ResumeDraft } from "@/components/dashboard/resume-draft";
import { DailyClaim } from "@/components/layout/daily-claim";
import { getCurrentUser } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/game/dashboard";
import Link from "next/link";

export const revalidate = 0;

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const { stats, widgets, feed, pendingInvites, openLobbies, recommendation } =
    await getDashboardData(user.uid, user.vaultCoins);

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
          <div className="bg-card rounded-lg border p-5">
            <p className="text-muted-foreground text-sm">Unique cards</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{stats.uniqueCards}</p>
          </div>
          <div className="bg-card rounded-lg border p-5">
            <p className="text-muted-foreground text-sm">Total cards</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{stats.totalCards}</p>
          </div>
          <div className="bg-card rounded-lg border p-5">
            <p className="text-muted-foreground text-sm">Drafts played <span className="text-[9px]">(Mult. / Phantom)</span></p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {stats.draftsMultiplayer}
              <span className="text-muted-foreground">/</span>
              {stats.draftsPhantom}
            </p>
          </div>
          <div className="bg-card rounded-lg border p-5">
            <p className="text-muted-foreground text-sm">Vault Coins</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{stats.vaultCoins}</p>
          </div>
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

      {/* Actionable: invites, resume, open lobbies */}
      <InviteList invites={pendingInvites} />
      <ResumeDraft drafts={widgets.inProgress} />
      <OpenLobbies lobbies={openLobbies} />

      {/* Activity feed + widget column */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <h2 className="mb-3 text-base font-semibold">Recent Activity</h2>
          <div className="bg-card rounded-lg border">
            <ActivityFeed feed={feed} />
          </div>
        </section>

        <div className="flex flex-col gap-4 lg:col-span-2">
          <RecentDecks decks={widgets.recentDecks} />
          <AchievementsProgress
            earned={widgets.achievements.earned}
            total={widgets.achievements.total}
          />
          <FriendsActivity />
        </div>
      </div>
    </main>
  );
}
