import { connectToDatabase } from "@/lib/db";
import { Notification } from "@/lib/models/Notification";
import type { Server } from "socket.io";

/** Persist a draft invite notification and push it in real-time if the
 *  invitee is connected. */
export async function sendDraftInvite(
  io: Server,
  fromUid: string,
  fromDisplayName: string,
  targetUserId: string,
  sessionId: string,
  shortCode: string,
): Promise<void> {
  await connectToDatabase();

  await Notification.create({
    userId: targetUserId,
    type: "draft_invite",
    fromUid,
    fromDisplayName,
    sessionId,
    shortCode,
    read: false,
  });

  // Push to socket room named after the target user's uid (if connected).
  io.to(`user:${targetUserId}`).emit("notification:new", {
    type: "draft_invite",
    fromDisplayName,
    shortCode,
  });
}
