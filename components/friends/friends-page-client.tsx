"use client";

import { useState, useCallback } from "react";
import { useSocketConnection } from "@/hooks/use-socket";
import { useDraftStore } from "@/store/draft-store";
import { FriendCodeCard } from "@/components/friends/friend-code-card";
import { AddFriendForm } from "@/components/friends/add-friend-form";
import { FriendRoster, type FriendEntry } from "@/components/friends/friend-roster";
import {
  PendingRequests,
  type PendingFriendEntry,
} from "@/components/friends/pending-requests";

interface FriendsPageClientProps {
  friendCode: string;
  initialFriends: FriendEntry[];
  initialIncoming: PendingFriendEntry[];
  initialOutgoing: PendingFriendEntry[];
}

export function FriendsPageClient({
  friendCode,
  initialFriends,
  initialIncoming,
  initialOutgoing,
}: FriendsPageClientProps) {
  const [friends, setFriends] = useState<FriendEntry[]>(initialFriends);
  const [incoming, setIncoming] =
    useState<PendingFriendEntry[]>(initialIncoming);
  const [outgoing, setOutgoing] =
    useState<PendingFriendEntry[]>(initialOutgoing);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const socket = useSocketConnection();
  const { sessionId, shortCode } = useDraftStore();

  const handleRemove = useCallback(
    async (friendshipId: string) => {
      await fetch(`/api/friends/${friendshipId}`, { method: "DELETE" });
      setFriends((prev) => prev.filter((f) => f.friendshipId !== friendshipId));
    },
    [],
  );

  const handleAccept = useCallback((friendshipId: string) => {
    // Optimistic: move from incoming to friends list (without full data).
    setIncoming((prev) => prev.filter((r) => r.friendshipId !== friendshipId));
    // Refresh from server to get accurate friend data.
    void refreshFriends();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDecline = useCallback((friendshipId: string) => {
    setIncoming((prev) => prev.filter((r) => r.friendshipId !== friendshipId));
  }, []);

  const handleCancel = useCallback((friendshipId: string) => {
    setOutgoing((prev) => prev.filter((r) => r.friendshipId !== friendshipId));
  }, []);

  async function refreshFriends() {
    try {
      const res = await fetch("/api/friends");
      if (!res.ok) return;
      const data = (await res.json()) as {
        friends: FriendEntry[];
        pendingIncoming: PendingFriendEntry[];
        pendingOutgoing: PendingFriendEntry[];
      };
      setFriends(data.friends);
      setIncoming(data.pendingIncoming);
      setOutgoing(data.pendingOutgoing);
    } catch {
      // silent
    }
  }

  function handleInvite(friendUid: string) {
    if (!sessionId || !shortCode) return;
    setInviteError(null);
    socket.emit(
      "lobby:invite-friend",
      { sessionId, friendUid },
      (res: { ok: boolean; error?: string }) => {
        if (!res.ok) {
          setInviteError(res.error ?? "Could not send invite");
        }
      },
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      {/* Left column: your code + add form + pending */}
      <div className="space-y-4">
        <FriendCodeCard friendCode={friendCode} />
        <AddFriendForm onRequestSent={refreshFriends} />
        <PendingRequests
          incoming={incoming}
          outgoing={outgoing}
          onAccept={handleAccept}
          onDecline={handleDecline}
          onCancel={handleCancel}
        />
      </div>

      {/* Right column: friend roster */}
      <div className="space-y-4">
        {inviteError && (
          <p className="text-sm text-destructive">{inviteError}</p>
        )}
        <FriendRoster
          friends={friends}
          sessionId={sessionId}
          shortCode={shortCode}
          onRemove={handleRemove}
          onInvite={sessionId ? handleInvite : undefined}
        />
      </div>
    </div>
  );
}
