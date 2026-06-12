import { getCurrentUser } from "@/lib/auth/session";
import { getDeckSummaries } from "@/lib/game/deck";
import { DeckList } from "@/components/decks/deck-list";

export const revalidate = 0;

export default async function DecksPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const decks = await getDeckSummaries(user.uid);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-10">
      <DeckList initialDecks={decks} />
    </main>
  );
}
