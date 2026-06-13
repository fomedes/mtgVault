import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guardApiRequest } from "@/lib/auth/api-guard";
import { connectToDatabase } from "@/lib/db";
import { Friendship } from "@/lib/models/Friendship";

const ActionSchema = z.object({
  action: z.enum(["accept", "decline"]),
});

/**
 * POST /api/friends/[id]
 * body: { action: "accept" | "decline" }
 * - accept: set status to "accepted" — only the non-requester party can accept
 * - decline: delete the pending request — only the non-requester party can decline
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await guardApiRequest("friends:action", {
    limit: 30,
    windowMs: 60_000,
  });
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  const parsed = ActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  const { id } = await params;
  await connectToDatabase();

  const uid = guard.user.uid;
  const friendship = await Friendship.findById(id).lean();

  if (!friendship) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Only the non-requester can accept/decline the request.
  const isParty = friendship.userA === uid || friendship.userB === uid;
  const isRequester = friendship.requesterUid === uid;

  if (!isParty || isRequester || friendship.status !== "pending") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { action } = parsed.data;

  if (action === "accept") {
    await Friendship.updateOne({ _id: id }, { $set: { status: "accepted" } });

    // Notify the original requester that their request was accepted.
    const { Notification } = await import("@/lib/models/Notification");
    await Notification.create({
      userId: friendship.requesterUid,
      type: "friend_accepted",
      fromUid: uid,
      fromDisplayName: guard.user.displayName ?? "",
      friendshipId: id,
      read: false,
    });

    return NextResponse.json({ ok: true });
  }

  // decline — remove the request.
  await Friendship.deleteOne({ _id: id });
  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/friends/[id]
 * Remove an accepted friendship. Either party can remove.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await guardApiRequest("friends:remove", {
    limit: 20,
    windowMs: 60_000,
  });
  if (!guard.ok) return guard.response;

  const { id } = await params;
  await connectToDatabase();

  const uid = guard.user.uid;
  const friendship = await Friendship.findById(id).lean();

  if (!friendship) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (friendship.userA !== uid && friendship.userB !== uid) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await Friendship.deleteOne({ _id: id });
  return NextResponse.json({ ok: true });
}
