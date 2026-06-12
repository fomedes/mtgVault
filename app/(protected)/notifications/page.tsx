import { getCurrentUser } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db";
import { Notification } from "@/lib/models/Notification";
import { NotificationList } from "@/components/notifications/notification-list";

export const revalidate = 0;

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  await connectToDatabase();
  const notes = await Notification.find(
    { userId: user.uid },
    { type: 1, fromDisplayName: 1, shortCode: 1, sessionId: 1, read: 1, createdAt: 1 },
  )
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  const notifications = notes.map((n) => ({
    id: String(n._id),
    type: n.type as string,
    fromDisplayName: n.fromDisplayName,
    shortCode: n.shortCode,
    sessionId: n.sessionId,
    read: n.read,
    createdAt: (n.createdAt as Date).toISOString(),
  }));

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          {unreadCount > 0 ? (
            <p className="text-muted-foreground text-sm">{unreadCount} unread</p>
          ) : (
            <p className="text-muted-foreground text-sm">All caught up</p>
          )}
        </div>
      </header>

      <NotificationList notifications={notifications} />
    </main>
  );
}
