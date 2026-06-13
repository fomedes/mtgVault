import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db";
import { Friendship, canonicalPair } from "@/lib/models/Friendship";
import { User } from "@/lib/models/User";
import { Deck } from "@/lib/models/Deck";
import Link from "next/link";

export const revalidate = 0;

export default async function FriendDecksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { id: friendUid } = await params;

  await connectToDatabase();

  const pair = canonicalPair(user.uid, friendUid);
  const friendship = await Friendship.findOne({
    ...pair,
    status: "accepted",
  }).lean();

  if (!friendship) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-10">
        <div className="py-24 text-center">
          <p className="text-muted-foreground">
            You need to be friends with this user to view their decks.
          </p>
          <Link
            href="/friends"
            className="mt-4 inline-block text-sm text-primary hover:underline"
          >
            Back to Friends
          </Link>
        </div>
      </main>
    );
  }

  const [friendUser, decks] = await Promise.all([
    User.findOne({ uid: friendUid }, { displayName: 1 }).lean(),
    Deck.find({ userId: friendUid }, { name: 1, cards: 1, updatedAt: 1 })
      .sort({ updatedAt: -1 })
      .lean(),
  ]);

  const friendName = friendUser?.displayName ?? "Friend";

  const deckSummaries = decks.map((d) => ({
    id: String(d._id),
    name: d.name,
    cardCount: (d.cards ?? []).reduce((sum, c) => sum + (c.quantity ?? 0), 0),
    updatedAt: ((d.updatedAt as Date) ?? new Date()).toISOString(),
  }));

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-10 space-y-6">
      <div>
        <div className="mb-2">
          <Link
            href="/friends"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Friends
          </Link>
          <span className="mx-2 text-muted-foreground">/</span>
          <span className="text-sm">{friendName}</span>
        </div>
        <h1 className="text-2xl font-bold">{friendName}&rsquo;s Decks</h1>
        <p className="text-muted-foreground text-xs mt-1">Read-only view</p>
      </div>

      {deckSummaries.length === 0 ? (
        <div className="py-24 text-center">
          <p className="text-muted-foreground text-sm">
            {friendName} hasn&rsquo;t built any decks yet.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {deckSummaries.map((deck) => (
            <div
              key={deck.id}
              className="bg-card rounded-lg border p-4 space-y-1"
            >
              <p className="font-semibold truncate">{deck.name}</p>
              <p className="text-sm text-muted-foreground">
                {deck.cardCount} cards
              </p>
              <p className="text-xs text-muted-foreground">
                Updated {new Date(deck.updatedAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
