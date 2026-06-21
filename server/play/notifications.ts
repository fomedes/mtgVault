import { connectToDatabase } from "@/lib/db";
import { Notification } from "@/lib/models/Notification";
import type { Server } from "socket.io";

/** Persist a play (virtual-tabletop) invite and push it in real-time if the
 *  invitee is connected. Mirrors server/draft/notifications.ts. */
export async function sendPlayInvite(
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
    type: "play_invite",
    fromUid,
    fromDisplayName,
    sessionId,
    shortCode,
    read: false,
  });

  io.to(`user:${targetUserId}`).emit("notification:new", {
    type: "play_invite",
    fromDisplayName,
    shortCode,
  });
}
