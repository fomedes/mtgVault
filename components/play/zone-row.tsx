"use client";

import { Button } from "@/components/ui/button";
import { BoardCard, type ResolvedCard } from "@/components/play/board-card";
import type { PublicSeatView } from "@/lib/game/play";

/**
 * A seat's library + public-zone cluster. Library/draw/mill/shuffle controls
 * appear only for the local seat (owner-only ops); public-zone top cards are
 * shown to everyone.
 */
export function ZoneRow({
  seat,
  isMe,
  resolve,
  onDraw,
  onMill,
  onShuffle,
}: {
  seat: PublicSeatView;
  isMe: boolean;
  resolve: (instanceId: string) => ResolvedCard;
  onDraw: () => void;
  onMill: () => void;
  onShuffle: () => void;
}) {
  return (
    <div className="border-border bg-card flex items-center gap-4 rounded-lg border p-3 text-sm">
      <ZonePile label="Library" count={seat.libraryCount} />
      <TopCardPile label="Graveyard" ids={seat.graveyard} resolve={resolve} />
      <TopCardPile label="Exile" ids={seat.exile} resolve={resolve} />
      {seat.command.length > 0 && <TopCardPile label="Command" ids={seat.command} resolve={resolve} />}
      <span className="text-muted-foreground">Hand: {seat.handCount}</span>

      {isMe && (
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="secondary" onClick={onDraw} disabled={seat.libraryCount === 0}>
            Draw
          </Button>
          <Button size="sm" variant="secondary" onClick={onMill} disabled={seat.libraryCount === 0}>
            Mill
          </Button>
          <Button size="sm" variant="ghost" onClick={onShuffle}>
            Shuffle
          </Button>
        </div>
      )}
    </div>
  );
}

function ZonePile({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="bg-muted border-border flex h-16 w-12 items-center justify-center rounded border text-xs font-semibold">
        {count}
      </div>
      <span className="text-muted-foreground text-[10px] uppercase">{label}</span>
    </div>
  );
}

function TopCardPile({
  label,
  ids,
  resolve,
}: {
  label: string;
  ids: string[];
  resolve: (instanceId: string) => ResolvedCard;
}) {
  const top = ids[ids.length - 1];
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="h-16 w-12">
        {top ? <BoardCard card={resolve(top)} /> : <div className="bg-muted border-border h-full w-full rounded border" />}
      </div>
      <span className="text-muted-foreground text-[10px] uppercase">
        {label} ({ids.length})
      </span>
    </div>
  );
}
