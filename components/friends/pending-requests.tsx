"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { useFriendsAnimations } from "@/lib/animations/friends";

export interface PendingFriendEntry {
  friendshipId: string;
  uid: string;
  displayName: string;
  photoURL: string;
  createdAt: string;
}

interface PendingRequestsProps {
  incoming: PendingFriendEntry[];
  outgoing: PendingFriendEntry[];
  onAccept: (friendshipId: string) => void;
  onDecline: (friendshipId: string) => void;
  onCancel: (friendshipId: string) => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 2) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function PendingRequests({
  incoming,
  outgoing,
  onAccept,
  onDecline,
  onCancel,
}: PendingRequestsProps) {
  const anim = useFriendsAnimations();
  const [busy, setBusy] = useState<string | null>(null);

  if (incoming.length === 0 && outgoing.length === 0) return null;

  async function act(id: string, action: "accept" | "decline") {
    setBusy(id);
    try {
      await fetch(`/api/friends/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (action === "accept") onAccept(id);
      else onDecline(id);
    } finally {
      setBusy(null);
    }
  }

  async function cancel(id: string) {
    setBusy(id);
    try {
      await fetch(`/api/friends/${id}`, {
        method: "DELETE",
      });
      onCancel(id);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {incoming.length > 0 && (
        <div className="bg-card rounded-lg border p-5 space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Incoming Requests ({incoming.length})
          </p>
          <motion.div
            variants={anim.container}
            initial="hidden"
            animate="visible"
            className="space-y-2"
          >
            <AnimatePresence>
              {incoming.map((r) => (
                <motion.div
                  key={r.friendshipId}
                  layout
                  variants={anim.row}
                  className="flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{r.displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      {timeAgo(r.createdAt)}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      disabled={busy === r.friendshipId}
                      onClick={() => act(r.friendshipId, "accept")}
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === r.friendshipId}
                      onClick={() => act(r.friendshipId, "decline")}
                    >
                      Decline
                    </Button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
      )}

      {outgoing.length > 0 && (
        <div className="bg-card rounded-lg border p-5 space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Sent Requests ({outgoing.length})
          </p>
          <motion.div
            variants={anim.container}
            initial="hidden"
            animate="visible"
            className="space-y-2"
          >
            <AnimatePresence>
              {outgoing.map((r) => (
                <motion.div
                  key={r.friendshipId}
                  layout
                  variants={anim.row}
                  className="flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{r.displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      {timeAgo(r.createdAt)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy === r.friendshipId}
                    onClick={() => cancel(r.friendshipId)}
                  >
                    Cancel
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </div>
  );
}
