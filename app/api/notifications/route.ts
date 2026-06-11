import { NextResponse } from "next/server";
import { guardApiRequest } from "@/lib/auth/api-guard";
import { connectToDatabase } from "@/lib/db";
import { Notification } from "@/lib/models/Notification";

export async function GET() {
  const guard = await guardApiRequest("notifications");
  if (!guard.ok) return guard.response;

  await connectToDatabase();

  const notes = await Notification.find(
    { userId: guard.user.uid },
    { type: 1, fromDisplayName: 1, shortCode: 1, read: 1, createdAt: 1 },
  )
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  return NextResponse.json({ notifications: notes });
}

export async function PATCH() {
  const guard = await guardApiRequest("notifications-read");
  if (!guard.ok) return guard.response;

  await connectToDatabase();

  await Notification.updateMany(
    { userId: guard.user.uid, read: false },
    { $set: { read: true } },
  );

  return NextResponse.json({ ok: true });
}
