import { connectToDatabase } from "@/lib/db";
import { Notification } from "@/lib/models/Notification";
import type { Server } from "socket.io";

/**
 * Persist a friend-request notification and push it in real-time if the
 * target user is connected. Called when a friend request is sent.
 */
export async function sendFriendRequestNotification(
  io: Server,
  fromUid: string,
  fromDisplayName: string,
  targetUid: string,
  friendshipId: string,
): Promise<void> {
  await connectToDatabase();

  await Notification.create({
    userId: targetUid,
    type: "friend_request",
    fromUid,
    fromDisplayName,
    friendshipId,
    read: false,
  });

  io.to(`user:${targetUid}`).emit("notification:new", {
    type: "friend_request",
    fromDisplayName,
    friendshipId,
  });
}

/**
 * Persist a friend-accepted notification and push it in real-time if the
 * original requester is connected.
 */
export async function sendFriendAcceptedNotification(
  io: Server,
  fromUid: string,
  fromDisplayName: string,
  targetUid: string,
): Promise<void> {
  await connectToDatabase();

  await Notification.create({
    userId: targetUid,
    type: "friend_accepted",
    fromUid,
    fromDisplayName,
    read: false,
  });

  io.to(`user:${targetUid}`).emit("notification:new", {
    type: "friend_accepted",
    fromDisplayName,
  });
}
