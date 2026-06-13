"use client";

import Link from "next/link";
import type { FriendActivity } from "@/lib/game/dashboard";

interface FriendsActivityProps {
  friends: FriendActivity[];
}

function timeAgo(iso: string | null): string {
  if (!iso) return "Never active";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 5) return "Active recently";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function FriendsActivity({ friends }: FriendsActivityProps) {
  return (
    <section className="bg-card rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Friends</h2>
        <Link
          href="/friends"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Manage
        </Link>
      </div>

      {friends.length === 0 ? (
        <div className="space-y-2">
          <p className="text-muted-foreground text-sm">No friends yet.</p>
          <Link
            href="/friends"
            className="inline-block text-sm text-primary hover:underline"
          >
            Add friends by code
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {friends.map((f) => (
            <li key={f.uid} className="flex items-center gap-2">
              {f.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={f.photoURL}
                  alt={f.displayName}
                  className="h-7 w-7 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
                  {(f.displayName[0] ?? "?").toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{f.displayName}</p>
                <p className="text-xs text-muted-foreground">
                  {timeAgo(f.lastLoginAt)}
                </p>
              </div>
              <Link
                href={`/friends/${f.uid}/collection`}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                Collection
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
