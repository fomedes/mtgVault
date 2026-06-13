import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db";
import { Friendship } from "@/lib/models/Friendship";
import { User } from "@/lib/models/User";
import { randomInt } from "node:crypto";
import { FriendsPageClient } from "@/components/friends/friends-page-client";
import type { FriendEntry } from "@/components/friends/friend-roster";
import type { PendingFriendEntry } from "@/components/friends/pending-requests";

export const revalidate = 0;

async function ensureFriendCode(uid: string): Promise<string> {
  const user = await User.findOne({ uid }, { friendCode: 1 }).lean();
  if (user?.friendCode) return user.friendCode;

  let code: string;
  let attempts = 0;
  do {
    code = randomInt(10_000_000, 100_000_000).toString();
    attempts++;
  } while (attempts < 20 && (await User.exists({ friendCode: code })));

  await User.updateOne({ uid }, { $set: { friendCode: code } });
  return code;
}

export default async function FriendsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  await connectToDatabase();

  const [friendCode, friendships] = await Promise.all([
    ensureFriendCode(user.uid),
    Friendship.find({
      $or: [{ userA: user.uid }, { userB: user.uid }],
    }).lean(),
  ]);

  const friendUids: string[] = [];
  const pendingIncomingIds: string[] = [];
  const pendingOutgoingIds: string[] = [];
  const friendshipMap = new Map(
    friendships.map((f) => [String(f._id), f]),
  );

  for (const f of friendships) {
    const id = String(f._id);
    if (f.status === "accepted") {
      friendUids.push(f.userA === user.uid ? f.userB : f.userA);
    } else if (f.status === "pending") {
      if (f.requesterUid === user.uid) pendingOutgoingIds.push(id);
      else pendingIncomingIds.push(id);
    }
  }

  const allOtherUids = new Set<string>();
  for (const f of friendships) {
    allOtherUids.add(f.userA === user.uid ? f.userB : f.userA);
  }

  const users =
    allOtherUids.size > 0
      ? await User.find(
          { uid: { $in: Array.from(allOtherUids) } },
          { uid: 1, displayName: 1, photoURL: 1, lastLoginAt: 1 },
        ).lean()
      : [];

  const userMap = new Map(users.map((u) => [u.uid, u]));

  const friends: FriendEntry[] = friendships
    .filter((f) => f.status === "accepted")
    .map((f) => {
      const otherUid = f.userA === user.uid ? f.userB : f.userA;
      const u = userMap.get(otherUid);
      return {
        friendshipId: String(f._id),
        uid: otherUid,
        displayName: u?.displayName ?? "",
        photoURL: u?.photoURL ?? "",
        lastLoginAt: u?.lastLoginAt
          ? (u.lastLoginAt as Date).toISOString()
          : null,
      };
    });

  const pendingIncoming: PendingFriendEntry[] = pendingIncomingIds
    .map((id) => {
      const f = friendshipMap.get(id)!;
      const otherUid = f.requesterUid;
      const u = userMap.get(otherUid);
      return {
        friendshipId: id,
        uid: otherUid,
        displayName: u?.displayName ?? "",
        photoURL: u?.photoURL ?? "",
        createdAt: (f.createdAt as Date).toISOString(),
      };
    });

  const pendingOutgoing: PendingFriendEntry[] = pendingOutgoingIds
    .map((id) => {
      const f = friendshipMap.get(id)!;
      const otherUid = f.userA === user.uid ? f.userB : f.userA;
      const u = userMap.get(otherUid);
      return {
        friendshipId: id,
        uid: otherUid,
        displayName: u?.displayName ?? "",
        photoURL: u?.photoURL ?? "",
        createdAt: (f.createdAt as Date).toISOString(),
      };
    });

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Friends</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Connect with other players, invite them to drafts, and view their
          collections.
        </p>
      </div>

      <FriendsPageClient
        friendCode={friendCode}
        initialFriends={friends}
        initialIncoming={pendingIncoming}
        initialOutgoing={pendingOutgoing}
      />
    </main>
  );
}
