import { Suspense } from "react";
import { PlayPageClient } from "@/components/play/play-page-client";
import { getCurrentUser } from "@/lib/auth/session";
import { getDeckSummaries } from "@/lib/game/deck";

export default async function PlayPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const decks = await getDeckSummaries(user.uid);

  return (
    <main className="w-full flex-1 flex flex-col">
      <Suspense>
        <PlayPageClient
          myUid={user.uid}
          decks={decks.map((d) => ({ id: d.id, name: d.name, cardCount: d.cardCount, colors: d.colors }))}
        />
      </Suspense>
    </main>
  );
}
