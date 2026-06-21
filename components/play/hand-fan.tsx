"use client";

import { BoardCard, type ResolvedCard } from "@/components/play/board-card";

/** The local seat's private hand. Click a card to play it to the battlefield. */
export function HandFan({
  hand,
  resolve,
  onPlay,
  onContext,
}: {
  hand: string[];
  resolve: (instanceId: string) => ResolvedCard;
  onPlay: (instanceId: string) => void;
  onContext: (instanceId: string, x: number, y: number) => void;
}) {
  return (
    <div className="border-border bg-card flex items-end gap-2 overflow-x-auto rounded-lg border p-3">
      {hand.length === 0 && <p className="text-muted-foreground text-sm">Your hand is empty.</p>}
      {hand.map((id) => (
        <button
          key={id}
          onClick={() => onPlay(id)}
          onContextMenu={(e) => {
            e.preventDefault();
            onContext(id, e.clientX, e.clientY);
          }}
          title="Click to play to the battlefield"
          className="w-20 shrink-0 transition hover:-translate-y-1"
        >
          <BoardCard card={resolve(id)} />
        </button>
      ))}
    </div>
  );
}
