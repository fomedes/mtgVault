"use client";

import { CardPreviewProvider } from "@/components/cards/card-preview-provider";
import { PackGrid } from "@/components/draft/pack-grid";
import { PickedTray } from "@/components/draft/picked-tray";
import { PlayerRail } from "@/components/draft/player-rail";
import { PoolStats } from "@/components/draft/pool-stats";
import { TimerRing } from "@/components/draft/timer-ring";
import type { PlayerView } from "@/lib/game/draft";
import type { CardListItemDto } from "@/lib/api/card-dto";
import { cn } from "@/lib/utils";

interface DraftRoomViewProps {
  currentPack: string[];
  myPicks: string[];
  round: number;
  pickInRound: number;
  numPacks: number;
  needsPick: boolean;
  players?: PlayerView["players"]; // MP only
  mySeat?: number;                 // MP only
  timerExpiresAt?: number | null;  // MP only
  difficulty?: string;             // phantom only
  picking?: boolean;               // phantom loading flag
  cardCache: Map<string, CardListItemDto>;
  onPick: (cardId: string) => void;
}

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export function DraftRoomView({
  currentPack,
  myPicks,
  round,
  pickInRound,
  numPacks,
  needsPick,
  players,
  mySeat = -1,
  timerExpiresAt,
  difficulty,
  picking,
  cardCache,
  onPick,
}: DraftRoomViewProps) {
  const statusText = picking
    ? "Bots are picking…"
    : needsPick
      ? "Your pick"
      : "Waiting…";

  return (
    <CardPreviewProvider>
      <div className="space-y-4">
        {/* Header row */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-medium">
              Round {round + 1} of {numPacks} · Pick {pickInRound + 1} of 15
            </p>
            <p className="text-muted-foreground text-xs">
              {currentPack.length} cards in pack · {statusText}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {difficulty && (
              <span className="text-muted-foreground text-xs rounded-md border px-2 py-0.5">
                {DIFFICULTY_LABEL[difficulty] ?? difficulty}
              </span>
            )}
            {timerExpiresAt != null && (
              <TimerRing expiresAt={timerExpiresAt} totalMs={60_000} />
            )}
          </div>
        </div>

        {/* Main content row */}
        <div className="flex gap-6">
          {/* Pack grid — takes all available width */}
          <PackGrid
            cardIds={currentPack}
            cardCache={cardCache}
            onPick={onPick}
            disabled={!needsPick || (picking ?? false)}
          />

          {/* Sidebar: player rail (MP) + stats (when picks exist) */}
          <aside
            className={cn(
              "hidden lg:block shrink-0 space-y-4",
              players ? "w-56" : "w-48",
            )}
          >
            {players && players.length > 0 && (
              <PlayerRail players={players} mySeat={mySeat} />
            )}
            {myPicks.length > 0 && (
              <div className="space-y-2">
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                  Pool Stats
                </p>
                <PoolStats cardIds={myPicks} cardCache={cardCache} variant="compact" />
              </div>
            )}
          </aside>
        </div>

        {/* Mobile: collapsible pool stats */}
        {myPicks.length > 0 && (
          <details className="lg:hidden">
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
              Pool Stats ({myPicks.length} cards)
            </summary>
            <div className="pt-2">
              <PoolStats cardIds={myPicks} cardCache={cardCache} variant="compact" />
            </div>
          </details>
        )}

        {/* Picks tray — full width at bottom */}
        <PickedTray
          cardIds={myPicks}
          cardCache={cardCache}
          className="pt-2 border-t border-border/50"
        />
      </div>
    </CardPreviewProvider>
  );
}
