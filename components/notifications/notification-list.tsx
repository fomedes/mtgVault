"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface NotificationItem {
  id: string;
  type: string;
  fromDisplayName: string;
  /** Present for draft_invite / draft_started; absent for friend notifications. */
  shortCode?: string | null;
  sessionId?: string | null;
  read: boolean;
  createdAt: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

function notificationLabel(n: NotificationItem): string {
  if (n.type === "draft_invite") {
    return `${n.fromDisplayName || "Someone"} invited you to draft`;
  }
  if (n.type === "draft_started") {
    return `Draft started — join now`;
  }
  if (n.type === "friend_request") {
    return `${n.fromDisplayName || "Someone"} sent you a friend request`;
  }
  if (n.type === "friend_accepted") {
    return `${n.fromDisplayName || "Someone"} accepted your friend request`;
  }
  return "Notification";
}

export function NotificationList({
  notifications,
}: {
  notifications: NotificationItem[];
}) {
  const router = useRouter();
  const [markingAll, setMarkingAll] = useState(false);

  async function markAllRead() {
    setMarkingAll(true);
    try {
      await fetch("/api/notifications", { method: "PATCH" });
      router.refresh();
    } finally {
      setMarkingAll(false);
    }
  }

  const hasUnread = notifications.some((n) => !n.read);

  if (notifications.length === 0) {
    return (
      <p className="text-muted-foreground py-12 text-center text-sm">No notifications yet.</p>
    );
  }

  return (
    <div className="space-y-4">
      {hasUnread ? (
        <div className="flex justify-end">
          <button
            onClick={markAllRead}
            disabled={markingAll}
            className="text-muted-foreground hover:text-foreground text-xs transition-colors disabled:opacity-50"
          >
            {markingAll ? "Marking…" : "Mark all as read"}
          </button>
        </div>
      ) : null}

      <ul className="space-y-1">
        {notifications.map((n) => (
          <li
            key={n.id}
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${
              n.read ? "opacity-60" : "border-violet-500/30 bg-violet-500/5"
            }`}
          >
            {!n.read ? (
              <span className="h-2 w-2 shrink-0 rounded-full bg-violet-400" aria-label="Unread" />
            ) : (
              <span className="h-2 w-2 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{notificationLabel(n)}</p>
              <p className="text-muted-foreground text-xs">
                {n.shortCode ? `Code: ${n.shortCode} · ` : ""}{timeAgo(n.createdAt)}
              </p>
            </div>
            {(n.type === "draft_invite" || n.type === "draft_started") && n.shortCode ? (
              <Link
                href={`/draft?code=${n.shortCode}`}
                className="shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Join
              </Link>
            ) : null}
            {n.type === "friend_request" || n.type === "friend_accepted" ? (
              <Link
                href="/friends"
                className="shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Friends
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
