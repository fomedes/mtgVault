import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { getDeckDetail } from "@/lib/game/deck";
import { DeckBuilder } from "@/components/decks/deck-builder";

export const revalidate = 0;

export default async function DeckBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { id } = await params;
  const deck = await getDeckDetail(id, user.uid);
  if (!deck) notFound();

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8">
      <nav className="text-muted-foreground flex items-center gap-2 text-sm">
        <Link href="/decks" className="hover:text-foreground transition-colors">
          My Decks
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{deck.name}</span>
      </nav>
      <DeckBuilder initialDeck={deck} />
    </main>
  );
}
