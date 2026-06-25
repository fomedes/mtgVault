"use client";

import {
  BattlefieldLane,
  type LaneAnchor,
} from "@/components/play/battlefield-lane";
import { CornerPods } from "@/components/play/corner-pods";
import { HandFan } from "@/components/play/hand-fan";
import { type ResolvedCard } from "@/components/play/board-card";
import type {
  BattlefieldCard,
  BattlefieldZone,
  PlayerBoardView,
} from "@/lib/game/play";
import { BATTLEFIELD_ZONES } from "@/lib/game/play";

/** Creatures get the most vertical room (the focal lane); lands the least. */
const LANE_GROW: Record<BattlefieldZone, number> = {
  creatures: 1.3,
  other: 1,
  lands: 1,
};

interface SeatFieldProps {
  board: PlayerBoardView;
  seat: number;
  isMine: boolean;
  side: "top" | "bottom";
  resolve: (instanceId: string) => ResolvedCard;
  onOpenMenu: (instanceId: string, x: number, y: number) => void;
  onReorder?: (zone: BattlefieldZone, newOrder: string[]) => void;
  onDraw: () => void;
  onMill: () => void;
  onShuffle: () => void;
  onPlayFromHand: (instanceId: string) => void;
  onPlayToZone: (instanceId: string, zone: BattlefieldZone) => void;
  onHandContext: (instanceId: string, x: number, y: number) => void;
}

/**
 * One seat's full territory: hand at the outer edge, a pod strip
 * (library/graveyard/exile) just inside it, then three battlefield lanes. For
 * both players creatures sit nearest the combat line and lands hug the outer
 * edge; the top side reverses the lane order (point-mirror) with upright cards.
 */
export function SeatField({
  board,
  seat,
  isMine,
  side,
  resolve,
  onOpenMenu,
  onReorder,
  onDraw,
  onMill,
  onShuffle,
  onPlayFromHand,
  onPlayToZone,
  onHandContext,
}: SeatFieldProps) {
  const seatView = board.seats.find((s) => s.seat === seat);

  const zones =
    side === "bottom"
      ? [...BATTLEFIELD_ZONES]
      : [...BATTLEFIELD_ZONES].slice().reverse();

  // Mirror horizontally: my cards fill from the left, opponents from the right.
  const anchor: LaneAnchor = side === "bottom" ? "start" : "end";

  const pods = seatView ? (
    <div className="shrink-0" style={{ height: "clamp(2.5rem, 8%, 5rem)" }}>
      <CornerPods
        seat={seatView}
        isMine={isMine}
        side={side}
        resolve={resolve}
        onDraw={onDraw}
        onMill={onMill}
        onShuffle={onShuffle}
      />
    </div>
  ) : null;

  const hand = (
    <div className="shrink-0" style={{ height: "clamp(5rem, 26%, 12rem)" }}>
      {isMine ? (
        <HandFan
          side={side}
          variant="face"
          hand={board.myHand}
          resolve={resolve}
          onPlay={onPlayFromHand}
          onPlayToZone={onPlayToZone}
          onContext={onHandContext}
        />
      ) : (
        <HandFan side={side} variant="back" count={seatView?.handCount ?? 0} />
      )}
    </div>
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      {side === "top" && hand}
      {side === "top" && pods}
      {zones.map((zone) => {
        const cardsInZone = board.battlefield.filter(
          (b: BattlefieldCard) =>
            b.zone === zone &&
            board.cards[b.instanceId]?.controllerSeat === seat,
        );
        return (
          <div
            key={zone}
            className="min-h-0 py-[0.4%]"
            style={{ flex: `${LANE_GROW[zone]} 1 0%` }}
          >
            <BattlefieldLane
              zone={zone}
              cards={cardsInZone}
              resolve={resolve}
              onOpenMenu={onOpenMenu}
              isMine={isMine}
              anchor={anchor}
              onReorder={
                onReorder ? (order) => onReorder(zone, order) : undefined
              }
            />
          </div>
        );
      })}
      {side === "bottom" && pods}
      {side === "bottom" && hand}
    </div>
  );
}
