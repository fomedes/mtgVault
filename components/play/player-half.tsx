"use client";

import { SeatField } from "@/components/play/seat-field";
import { type ResolvedCard } from "@/components/play/board-card";
import type { BattlefieldZone, PlayerBoardView } from "@/lib/game/play";

interface PlayerHalfProps {
  board: PlayerBoardView;
  side: "top" | "bottom";
  /** Seat indices placed on this side (left→right). */
  seats: number[];
  mySeat: number;
  resolve: (instanceId: string) => ResolvedCard;
  onOpenMenu: (instanceId: string, x: number, y: number) => void;
  onReorder: (zone: BattlefieldZone, newOrder: string[]) => void;
  onPlayFromHand: (instanceId: string) => void;
  onPlayToZone: (instanceId: string, zone: BattlefieldZone) => void;
  onHandContext: (instanceId: string, x: number, y: number) => void;
  onDraw: () => void;
  onMill: () => void;
  onShuffle: () => void;
}

/**
 * One half of the stage. Seats split the width into equal columns; each seat
 * carries its own lanes, pods and hand (mine interactive, opponents' cardbacks).
 */
export function PlayerHalf({
  board,
  side,
  seats,
  mySeat,
  resolve,
  onOpenMenu,
  onReorder,
  onPlayFromHand,
  onPlayToZone,
  onHandContext,
  onDraw,
  onMill,
  onShuffle,
}: PlayerHalfProps) {
  return (
    <div className="flex h-full min-h-0 w-full">
      {seats.map((seat) => (
        <div key={seat} className="min-h-0 flex-1 px-3">
          <SeatField
            board={board}
            seat={seat}
            isMine={seat === mySeat}
            side={side}
            resolve={resolve}
            onOpenMenu={onOpenMenu}
            onReorder={seat === mySeat ? onReorder : undefined}
            onDraw={onDraw}
            onMill={onMill}
            onShuffle={onShuffle}
            onPlayFromHand={onPlayFromHand}
            onPlayToZone={onPlayToZone}
            onHandContext={onHandContext}
          />
        </div>
      ))}
    </div>
  );
}
