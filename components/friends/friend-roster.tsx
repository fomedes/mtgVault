"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useFriendsAnimations } from "@/lib/animations/friends";

export interface FriendEntry {
  friendshipId: string;
  uid: string;
  displayName: string;
  photoURL: string;
  lastLoginAt: string | null;
}

interface FriendRosterProps {
  friends: FriendEntry[];
  sessionId?: string | null;
  shortCode?: string | null;
  onRemove: (friendshipId: string) => void;
  onInvite?: (friendUid: string) => void;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 2) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function Avatar({
  displayName,
  photoURL,
}: {
  displayName: string;
  photoURL: string;
}) {
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return photoURL ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photoURL}
      alt={displayName}
      className="h-9 w-9 rounded-full object-cover"
    />
  ) : (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
      {initials || "?"}
    </div>
  );
}

function FriendRow({
  friend,
  inLobby,
  onRemove,
  onInvite,
}: {
  friend: FriendEntry;
  inLobby: boolean;
  onRemove: () => void;
  onInvite?: () => void;
}) {
  const anim = useFriendsAnimations();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function handleRemove() {
    if (!confirmRemove) {
      setConfirmRemove(true);
      return;
    }
    setRemoving(true);
    onRemove();
  }

  return (
    <motion.div
      layout
      variants={anim.row}
      className="flex items-center gap-3 rounded-lg border px-4 py-3"
    >
      <Avatar displayName={friend.displayName} photoURL={friend.photoURL} />

      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{friend.displayName}</p>
        <p className="text-xs text-muted-foreground">
          {timeAgo(friend.lastLoginAt)}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Link
          href={`/friends/${friend.uid}/collection`}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
        >
          Collection
        </Link>
        <Link
          href={`/friends/${friend.uid}/decks`}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
        >
          Decks
        </Link>

        {inLobby && onInvite && (
          <Button size="sm" variant="outline" onClick={onInvite}>
            Invite
          </Button>
        )}

        {confirmRemove ? (
          <>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleRemove}
              disabled={removing}
            >
              Confirm
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirmRemove(false)}
            >
              Cancel
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setConfirmRemove(true)}
            className="text-muted-foreground hover:text-destructive"
          >
            Remove
          </Button>
        )}
      </div>
    </motion.div>
  );
}

export function FriendRoster({
  friends,
  sessionId,
  shortCode,
  onRemove,
  onInvite,
}: FriendRosterProps) {
  const anim = useFriendsAnimations();
  const inLobby = !!(sessionId && shortCode);

  if (friends.length === 0) {
    return (
      <div className="bg-card rounded-lg border p-6 text-center">
        <p className="text-muted-foreground text-sm">
          No friends yet. Add friends using their 8-digit code.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold">
        Friends{" "}
        <span className="text-muted-foreground font-normal text-sm">
          ({friends.length})
        </span>
      </h2>
      <motion.div
        variants={anim.container}
        initial="hidden"
        animate="visible"
        className="space-y-2"
      >
        <AnimatePresence>
          {friends.map((f) => (
            <FriendRow
              key={f.friendshipId}
              friend={f}
              inLobby={inLobby}
              onRemove={() => onRemove(f.friendshipId)}
              onInvite={
                onInvite ? () => onInvite(f.uid) : undefined
              }
            />
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
