"use client";

import Link from "next/link";
import type { PendingInvite } from "@/lib/game/dashboard";

export function InviteList({ invites }: { invites: PendingInvite[] }) {
  if (invites.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 text-base font-semibold">Draft Invites</h2>
      <ul className="space-y-2">
        {invites.map((invite) => (
          <li
            key={invite.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-violet-500/30 bg-violet-500/10 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {invite.fromDisplayName || "Someone"} invited you to draft
              </p>
              <p className="text-muted-foreground text-xs">Code: {invite.shortCode}</p>
            </div>
            <Link
              href={`/draft?code=${invite.shortCode}`}
              className="shrink-0 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              Join
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
