"use client";

import { cn } from "@/lib/utils";
import type { PlayerView } from "@/lib/game/draft";

export function PlayerRail({
  players,
  mySeat,
}: {
  players: PlayerView["players"];
  mySeat: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {players.map((p) => (
        <div
          key={p.uid}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
            p.seatIndex === mySeat && "border-primary/50 bg-primary/5",
          )}
        >
          <span
            className={cn(
              "size-2 rounded-full shrink-0",
              p.isConnected ? "bg-green-500" : "bg-red-500/60",
            )}
            aria-hidden
          />
          <span className="flex-1 truncate font-medium leading-tight">
            {p.displayName}
            {p.seatIndex === mySeat ? " (you)" : ""}
          </span>
          <span className="text-muted-foreground tabular-nums text-xs">
            {p.pickCount}
            {p.hasPicked ? " ✓" : ""}
          </span>
        </div>
      ))}
    </div>
  );
}
