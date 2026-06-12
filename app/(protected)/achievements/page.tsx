import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db";
import { Achievement } from "@/lib/models/Achievement";
import { ACHIEVEMENT_DEFS } from "@/lib/game/achievements";
import type { AchievementId } from "@/lib/models/Achievement";

export const revalidate = 0;

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
      </header>

      {unlocked.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-emerald-400">
            Unlocked
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {unlocked.map((def) => {
              const record = earnedMap.get(def.id as AchievementId);
              const earnedDate = record?.earnedAt
                ? new Date(record.earnedAt as Date).toLocaleDateString()
                : "";
              return (
                <div
                  key={def.id}
                  className="flex items-start gap-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4"
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xl text-emerald-400"
                    aria-hidden
                  >
                    ★
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{def.label}</p>
                    <p className="text-muted-foreground text-xs">{def.description}</p>
                    <p className="mt-1 text-xs text-emerald-400">
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {locked.map((def) => (
              <div
                key={def.id}
                className="flex items-start gap-4 rounded-lg border bg-muted/20 p-4 opacity-60"
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted/40 text-xl text-muted-foreground"
                  aria-hidden
                >
                  ☆
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{def.label}</p>
                  <p className="text-muted-foreground text-xs">{def.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">+{def.reward} VC on unlock</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
