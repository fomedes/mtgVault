"use client";

import { useEffect } from "react";
import { DraftRoomView } from "@/components/draft/draft-room-view";
import { DraftSummary } from "@/components/draft/draft-summary";
import { useSocketConnection } from "@/hooks/use-socket";
import { useDraftStore } from "@/store/draft-store";

export function DraftRoom({ myUid }: { myUid: string }) {
  const socket = useSocketConnection();
  const {
    sessionId,
    setCode,
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

    fetch(`/api/cards/batch?ids=${encodeURIComponent(uncached.join(","))}`)
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
      <DraftSummary
        sessionId={sessionId ?? ""}
        setCode={setCode ?? ""}
        kind="multiplayer"
        cardIds={myPicks}
        cardCache={cardCache}
      />
    );
  }

  return (
    <DraftRoomView
      currentPack={currentPack}
      myPicks={myPicks}
      round={round}
      pickInRound={pickInRound}
      numPacks={3}
      needsPick={needsPick}
      players={players}
      mySeat={mySeat}
      timerExpiresAt={timerExpiresAt}
      cardCache={cardCache}
      onPick={handlePick}
    />
  );
}
