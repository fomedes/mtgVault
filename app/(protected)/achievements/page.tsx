import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db";
import { Achievement } from "@/lib/models/Achievement";
import { ACHIEVEMENT_DEFS, type AchievementTier } from "@/lib/game/achievements";
import type { AchievementId } from "@/lib/models/Achievement";

export const revalidate = 0;

const TIER_STYLES: Record<
  AchievementTier,
  { badge: string; card: string; icon: string; label: string }
> = {
  bronze: {
    badge: "bg-amber-700/20 text-amber-500 border-amber-700/40",
    card: "border-amber-700/30 bg-amber-700/10",
    icon: "bg-amber-700/20 text-amber-500",
    label: "Bronze",
  },
  silver: {
    badge: "bg-slate-400/20 text-slate-300 border-slate-400/40",
    card: "border-slate-400/30 bg-slate-400/10",
    icon: "bg-slate-400/20 text-slate-300",
    label: "Silver",
  },
  gold: {
    badge: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
    card: "border-yellow-500/30 bg-yellow-500/10",
    icon: "bg-yellow-500/20 text-yellow-400",
    label: "Gold",
  },
  platinum: {
    badge: "bg-purple-500/20 text-purple-400 border-purple-500/40",
    card: "border-purple-500/30 bg-purple-500/10",
    icon: "bg-purple-500/20 text-purple-400",
    label: "Platinum",
  },
};

export default async function AchievementsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  await connectToDatabase();
  const earned = await Achievement.find({ userId: user.uid }).lean();
  const earnedSet = new Set(earned.map((a) => a.achievementId));
  const earnedMap = new Map(earned.map((a) => [a.achievementId, a]));

  const unlocked = ACHIEVEMENT_DEFS.filter((d) => earnedSet.has(d.id));
  const locked = ACHIEVEMENT_DEFS.filter((d) => !earnedSet.has(d.id));

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Achievements</h1>
        <p className="text-muted-foreground text-sm">
          {unlocked.length} of {ACHIEVEMENT_DEFS.length} unlocked
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {(["bronze", "silver", "gold", "platinum"] as AchievementTier[]).map((tier) => {
            const count = ACHIEVEMENT_DEFS.filter((d) => d.tier === tier).length;
            const earned_count = unlocked.filter((d) => d.tier === tier).length;
            const s = TIER_STYLES[tier];
            return (
              <span
                key={tier}
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.badge}`}
              >
                {s.label}: {earned_count}/{count}
              </span>
            );
          })}
        </div>
      </header>

      {unlocked.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-emerald-400">
            Unlocked
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {unlocked.map((def) => {
              const record = earnedMap.get(def.id as AchievementId);
              const earnedDate = record?.earnedAt
                ? new Date(record.earnedAt as Date).toLocaleDateString()
                : "";
              const s = TIER_STYLES[def.tier];
              return (
                <div
                  key={def.id}
                  className={`flex items-start gap-4 rounded-lg border p-4 ${s.card}`}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl ${s.icon}`}
                    aria-hidden
                  >
                    ★
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{def.label}</p>
                      <span className={`rounded-full border px-1.5 py-0 text-[10px] font-medium ${s.badge}`}>
                        {s.label}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-xs">{def.description}</p>
                    <p className={`mt-1 text-xs ${s.icon.split(" ")[1]}`}>
                      +{def.reward} VC
                      {earnedDate ? (
                        <span className="text-muted-foreground ml-2">· {earnedDate}</span>
                      ) : null}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {locked.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Locked
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {locked.map((def) => {
              const s = TIER_STYLES[def.tier];
              return (
                <div
                  key={def.id}
                  className="flex items-start gap-4 rounded-lg border bg-muted/20 p-4 opacity-50"
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted/40 text-xl text-muted-foreground"
                    aria-hidden
                  >
                    ☆
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">
                        {def.hidden ? "???" : def.label}
                      </p>
                      <span className={`rounded-full border px-1.5 py-0 text-[10px] font-medium ${s.badge}`}>
                        {s.label}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {def.hidden ? "Complete a secret challenge to reveal this achievement" : def.description}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {def.hidden ? "??? VC on unlock" : `+${def.reward} VC on unlock`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </main>
  );
}
