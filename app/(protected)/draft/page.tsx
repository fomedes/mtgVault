import { Suspense } from "react";
import { DraftPageClient } from "@/components/draft/draft-page-client";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db";
import { CardSet } from "@/lib/models/CardSet";

export default async function DraftPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  await connectToDatabase();
  const sets = await CardSet.find(
    { enabled: true, cardsSyncedAt: { $exists: true } },
    { code: 1, name: 1 },
  )
    .sort({ releasedAt: -1 })
    .lean();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Draft</h1>
        <p className="text-muted-foreground text-sm">
          Create a lobby or join with a code to start a booster draft.
        </p>
      </header>
      <Suspense>
        <DraftPageClient
          myUid={user.uid}
          availableSets={sets.map((s) => ({ code: s.code, name: s.name }))}
        />
      </Suspense>
    </main>
  );
}
