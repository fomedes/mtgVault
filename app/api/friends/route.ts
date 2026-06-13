import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guardApiRequest } from "@/lib/auth/api-guard";
import { connectToDatabase } from "@/lib/db";
import { Friendship, canonicalPair } from "@/lib/models/Friendship";
import { User } from "@/lib/models/User";

const RequestSchema = z.object({
  friendCode: z
    .string()
    .regex(/^\d{8}$/, "Friend code must be exactly 8 digits"),
});

/** GET /api/friends — list accepted friends + pending incoming/outgoing */
export async function GET() {
  const guard = await guardApiRequest("friends:list", {
    limit: 60,
    windowMs: 60_000,
  });
  if (!guard.ok) return guard.response;

  await connectToDatabase();

  const uid = guard.user.uid;

  const friendships = await Friendship.find({
    $or: [{ userA: uid }, { userB: uid }],
  }).lean();

  const friendUids: string[] = [];
  const pendingIncomingIds: string[] = [];
  const pendingOutgoingIds: string[] = [];
  const friendshipById = new Map<string, (typeof friendships)[0]>();

  for (const f of friendships) {
    const id = String(f._id);
    friendshipById.set(id, f);
    const otherUid = f.userA === uid ? f.userB : f.userA;

    if (f.status === "accepted") {
      friendUids.push(otherUid);
    } else if (f.status === "pending") {
      if (f.requesterUid === uid) {
        pendingOutgoingIds.push(id);
      } else {
        pendingIncomingIds.push(id);
      }
    }
  }

  // Collect all other uids we need to look up.
  const allOtherUids = new Set<string>();
  for (const f of friendships) {
    allOtherUids.add(f.userA === uid ? f.userB : f.userA);
  }

  const users = await User.find(
    { uid: { $in: Array.from(allOtherUids) } },
    { uid: 1, displayName: 1, photoURL: 1, lastLoginAt: 1 },
  ).lean();

  const userMap = new Map(users.map((u) => [u.uid, u]));

  const friends = friendUids.map((otherUid) => {
    const u = userMap.get(otherUid);
    const friendship = friendships.find(
      (f) =>
        f.status === "accepted" &&
        (f.userA === otherUid || f.userB === otherUid),
    );
    return {
      friendshipId: friendship ? String(friendship._id) : "",
      uid: otherUid,
      displayName: u?.displayName ?? "",
      photoURL: u?.photoURL ?? "",
      lastLoginAt: u?.lastLoginAt
        ? (u.lastLoginAt as Date).toISOString()
        : null,
    };
  });

  const pendingIncoming = pendingIncomingIds.map((id) => {
    const f = friendshipById.get(id)!;
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

  const pendingOutgoing = pendingOutgoingIds.map((id) => {
    const f = friendshipById.get(id)!;
    const otherUid = f.userA === uid ? f.userB : f.userA;
    const u = userMap.get(otherUid);
    return {
      friendshipId: id,
      uid: otherUid,
      displayName: u?.displayName ?? "",
      photoURL: u?.photoURL ?? "",
      createdAt: (f.createdAt as Date).toISOString(),
    };
  });

  return NextResponse.json({ friends, pendingIncoming, pendingOutgoing });
}

/**
 * POST /api/friends/request
 * body: { friendCode: string }
 * Anti-enumeration: always returns { ok: true } regardless of whether the
 * code exists, to prevent username fishing. Rate-limited: 5 req / 60 s.
 */
export async function POST(req: NextRequest) {
  const guard = await guardApiRequest("friends:request", {
    limit: 5,
    windowMs: 60_000,
  });
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    // Return generic ok to avoid leaking info even on validation error shape,
    // but 400 the format itself.
    return NextResponse.json(
      { error: "invalid_code_format" },
      { status: 400 },
    );
  }

  await connectToDatabase();

  const { friendCode } = parsed.data;
  const myUid = guard.user.uid;

  // Find the target user — but never reveal in the response whether they exist.
  const targetUser = await User.findOne(
    { friendCode },
    { uid: 1, displayName: 1 },
  ).lean();

  if (!targetUser || targetUser.uid === myUid) {
    // Silently succeed (anti-enumeration).
    return NextResponse.json({ ok: true });
  }

  const pair = canonicalPair(myUid, targetUser.uid);

  // Check for existing friendship/request.
  const existing = await Friendship.findOne(pair).lean();
  if (existing) {
    // Already friends or pending — silently succeed.
    return NextResponse.json({ ok: true });
  }

  const friendship = await Friendship.create({
    ...pair,
    requesterUid: myUid,
    status: "pending",
  });

  // Fire-and-forget socket notification (socket server is a separate process
  // in production; we can't call it directly from Next.js API routes).
  // The notification is persisted to DB so the target sees it on next load.
  const { Notification } = await import("@/lib/models/Notification");
  await Notification.create({
    userId: targetUser.uid,
    type: "friend_request",
    fromUid: myUid,
    fromDisplayName: guard.user.displayName ?? "",
    friendshipId: String(friendship._id),
    read: false,
  });

  return NextResponse.json({ ok: true });
}
