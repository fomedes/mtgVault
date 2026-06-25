"use client";

import { PlayerHalf } from "@/components/play/player-half";
import { CombatLine } from "@/components/play/combat-line";
import { type ResolvedCard } from "@/components/play/board-card";
import { getSeatLayout } from "@/lib/game/seat-layout";
import type { BattlefieldZone, PlayerBoardView } from "@/lib/game/play";

interface PlayStageProps {
  board: PlayerBoardView;
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
 * The full-bleed battlefield: opponent half on top, my half on bottom, a glowing
 * combat line between. `grid-rows-[1fr_auto_1fr]` + `min-h-0` makes the halves
 * split the available height and never scroll. (Team/multi-seat split is
 * generalized in RW-8; for now my seat is bottom and everyone else shares the top.)
 */
export function PlayStage({
  board,
  resolve,
  onOpenMenu,
  onReorder,
  onPlayFromHand,
  onPlayToZone,
  onHandContext,
  onDraw,
  onMill,
  onShuffle,
}: PlayStageProps) {
  const mySeat = board.mySeat;
  const placements = getSeatLayout(
    mySeat,
    board.seats.map((s) => ({ seat: s.seat, teamId: s.teamId })),
    board.lifeMode,
  );
  const bottomSeats = placements
    .filter((p) => p.side === "bottom")
    .map((p) => p.seat);
  const topSeats = placements
    .filter((p) => p.side === "top")
    .map((p) => p.seat);

  const halfProps = {
    board,
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
  };

  return (
    <div className="playmat-vignette relative grid h-full min-h-0 w-full grid-rows-[1fr_auto_1fr] overflow-hidden">
      <div className="playmat-foe relative min-h-0 overflow-hidden">
        <PlayerHalf side="top" seats={topSeats} {...halfProps} />
      </div>

      <CombatLine />

      <div className="playmat-mine relative min-h-0 overflow-hidden">
        <PlayerHalf side="bottom" seats={bottomSeats} {...halfProps} />
      </div>
    </div>
  );
}
