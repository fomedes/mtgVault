import { PracticeHistory } from "@/components/solo-draft/practice-history";
import { SoloDraftSetup } from "@/components/solo-draft/solo-draft-setup";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db";
import { CardSet } from "@/lib/models/CardSet";
import { listSoloDrafts } from "@/lib/game/solo-draft";

export const revalidate = 0;

export default async function SoloDraftPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  await connectToDatabase();
  const [sets, history] = await Promise.all([
    CardSet.find(
      { enabled: true, cardsSyncedAt: { $exists: true } },
      { code: 1, name: 1 },
    )
      .sort({ releasedAt: -1 })
      .lean(),
    listSoloDrafts(user.uid),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 px-4 py-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Solo Draft</h1>
        <p className="text-muted-foreground text-sm">
          Practice booster draft against 7 bots. Phantom — picks stay private and are not added to
          your collection.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">New draft</h2>
        <SoloDraftSetup availableSets={sets.map((s) => ({ code: s.code, name: s.name }))} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Practice history</h2>
        <PracticeHistory sessions={history} />
      </section>
    </main>
  );
}
