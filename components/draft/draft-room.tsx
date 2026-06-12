"use client";

import { useEffect } from "react";
import { PackGrid } from "@/components/draft/pack-grid";
import { PickedTray } from "@/components/draft/picked-tray";
import { PlayerRail } from "@/components/draft/player-rail";
import { TimerRing } from "@/components/draft/timer-ring";
import { useSocketConnection } from "@/hooks/use-socket";
import { useDraftStore } from "@/store/draft-store";

export function DraftRoom({ myUid }: { myUid: string }) {
  const socket = useSocketConnection();
  const {
    sessionId,
    currentPack,
    myPicks,
    round,
    pickInRound,
    needsPick,
    players,
    timerExpiresAt,
    cardCache,
    cacheCards,
    status,
  } = useDraftStore();

  const mySeat = players.findIndex((p) => p.uid === myUid);

  // Fetch card details for any IDs not yet in the cache.
  useEffect(() => {
    const uncached = [...currentPack, ...myPicks].filter((id) => !cardCache.has(id));
    if (uncached.length === 0) return;

    fetch(
      `/api/cards/batch?ids=${encodeURIComponent(uncached.join(","))}`,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { cards: Record<string, Parameters<typeof cacheCards>[0][string]> } | null) => {
        if (d?.cards) cacheCards(d.cards);
      })
      .catch(() => undefined);
  }, [currentPack, myPicks, cardCache, cacheCards]);

  function handlePick(cardId: string) {
    if (!sessionId || !needsPick) return;
    socket.emit("draft:pick", { sessionId, cardId }, () => undefined);
  }

  if (status === "complete") {
    return (
      <div className="py-20 text-center space-y-3">
        <p className="text-2xl font-bold">Draft complete!</p>
        <p className="text-muted-foreground text-sm">
          Your cards have been added to your collection. Check Draft History to view your picks.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
      {/* Pack + timer (main area) */}
      <div className="flex-1 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">
              Round {round + 1} · Pick {pickInRound + 1} of 15
            </p>
            <p className="text-muted-foreground text-xs">
              {currentPack.length} cards in pack ·{" "}
              {needsPick ? "Your pick" : "Waiting for others…"}
            </p>
          </div>
          <TimerRing
            expiresAt={timerExpiresAt}
            totalMs={useDraftStore.getState().timerExpiresAt ? 60_000 : 60_000}
          />
        </div>

        <PackGrid
          cardIds={currentPack}
          cardCache={cardCache}
          onPick={handlePick}
          disabled={!needsPick}
        />
      </div>

      {/* Sidebar: player rail + picks tray */}
      <aside className="lg:w-56 space-y-6 shrink-0">
        <PlayerRail players={players} mySeat={mySeat} />
        <PickedTray cardIds={myPicks} cardCache={cardCache} />
      </aside>
    </div>
  );
}
