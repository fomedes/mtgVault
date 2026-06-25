"use client";

import { Button } from "@/components/ui/button";
import { BoardCard, type ResolvedCard } from "@/components/play/board-card";
import type { PublicSeatView } from "@/lib/game/play";

interface CornerPodsProps {
  seat: PublicSeatView;
  isMine: boolean;
  side: "top" | "bottom";
  resolve: (instanceId: string) => ResolvedCard;
  onDraw: () => void;
  onMill: () => void;
  onShuffle: () => void;
}

/**
 * Compact library / graveyard / exile / command piles docked to a seat's outer
 * corner (mirror: mine bottom-right, opponents top-left). Draw / mill / shuffle
 * appear only on the local seat's pods (owner-only ops).
 */
export function CornerPods({
  seat,
  isMine,
  side,
  resolve,
  onDraw,
  onMill,
  onShuffle,
}: CornerPodsProps) {
  const justify = side === "bottom" ? "justify-end" : "justify-start";
  return (
    <div
      data-seat-target={seat.seat}
      className={`flex h-full items-center gap-2 px-3 ${justify}`}
    >
      {isMine && (
        <div className="mr-1 flex flex-col gap-1">
          <Button
            size="xs"
            variant="secondary"
            onClick={onDraw}
            disabled={seat.libraryCount === 0}
          >
            Draw
          </Button>
          <div className="flex gap-1">
            <Button
              size="xs"
              variant="ghost"
              onClick={onMill}
              disabled={seat.libraryCount === 0}
            >
              Mill
            </Button>
            <Button size="xs" variant="ghost" onClick={onShuffle}>
              Shuffle
            </Button>
          </div>
        </div>
      )}
      <CountPile label="Library" count={seat.libraryCount} />
      <TopCardPile label="Grave" ids={seat.graveyard} resolve={resolve} />
      <TopCardPile label="Exile" ids={seat.exile} resolve={resolve} />
      {seat.command.length > 0 && (
        <TopCardPile label="Cmd" ids={seat.command} resolve={resolve} />
      )}
    </div>
  );
}

function CountPile({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-0.5">
      <div className="bg-muted/60 border-border flex aspect-5/7 h-[74%] items-center justify-center rounded-[6%] border text-xs font-semibold tabular-nums backdrop-blur-sm">
        {count}
      </div>
      <PodLabel>{label}</PodLabel>
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
    <div className="flex h-full flex-col items-center justify-center gap-0.5">
      <div className="aspect-5/7 h-[74%]">
        {top ? (
          <BoardCard card={resolve(top)} />
        ) : (
          <div className="border-border/60 h-full w-full rounded-[6%] border border-dashed" />
        )}
      </div>
      <PodLabel>
        {label} ({ids.length})
      </PodLabel>
    </div>
  );
}

function PodLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-muted-foreground text-[0.5rem] font-medium tracking-wide uppercase">
      {children}
    </span>
  );
}
