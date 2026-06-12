"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NotificationBell({ unreadCount }: { unreadCount: number }) {
  const pathname = usePathname();
  const isActive = pathname === "/notifications";

  return (
    <Link
      href="/notifications"
      aria-label={
        unreadCount > 0
          ? `Notifications — ${unreadCount} unread`
          : "Notifications"
      }
      className={cn(
        "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm transition-colors",
        isActive
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
      )}
    >
      <svg
        viewBox="0 0 20 20"
        fill="currentColor"
        className="h-4 w-4"
        aria-hidden
      >
        <path d="M10 2a6 6 0 0 0-6 6v3.586l-.707.707A1 1 0 0 0 4 14h12a1 1 0 0 0 .707-1.707L16 11.586V8a6 6 0 0 0-6-6Zm0 16a2 2 0 0 1-2-2h4a2 2 0 0 1-2 2Z" />
      </svg>
      {unreadCount > 0 ? (
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-violet-500 text-[10px] font-bold text-white"
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}
