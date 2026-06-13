import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db";
import { Friendship, canonicalPair } from "@/lib/models/Friendship";
import { User } from "@/lib/models/User";
import { FriendCollectionBrowser } from "@/components/friends/friend-collection-browser";
import Link from "next/link";

export const revalidate = 0;

export default async function FriendCollectionPage({
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
            You need to be friends with this user to view their collection.
          </p>
          <Link href="/friends" className="mt-4 inline-block text-sm text-primary hover:underline">
            Back to Friends
          </Link>
        </div>
      </main>
    );
  }

  const friendUser = await User.findOne(
    { uid: friendUid },
    { displayName: 1 },
  ).lean();

  const friendName = friendUser?.displayName ?? "Friend";

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-10">
      <div className="mb-4">
        <Link
          href="/friends"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Friends
        </Link>
        <span className="mx-2 text-muted-foreground">/</span>
        <span className="text-sm">{friendName}</span>
      </div>
      <Suspense>
        <FriendCollectionBrowser friendUid={friendUid} friendName={friendName} />
      </Suspense>
    </main>
  );
}
