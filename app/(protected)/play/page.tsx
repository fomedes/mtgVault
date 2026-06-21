import { Suspense } from "react";
import { PlayPageClient } from "@/components/play/play-page-client";
import { getCurrentUser } from "@/lib/auth/session";
import { getDeckSummaries } from "@/lib/game/deck";

export default async function PlayPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const decks = await getDeckSummaries(user.uid);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Play</h1>
        <p className="text-muted-foreground text-sm">
          Create a virtual tabletop or join with a code, import a deck, and play a manual game —
          the board syncs; the rules are up to you.
        </p>
      </header>
      <Suspense>
        <PlayPageClient
          myUid={user.uid}
          decks={decks.map((d) => ({ id: d.id, name: d.name, cardCount: d.cardCount, colors: d.colors }))}
        />
      </Suspense>
    </main>
  );
}
