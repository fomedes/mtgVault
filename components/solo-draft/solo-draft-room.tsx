"use client";

import { useEffect, useRef, useState } from "react";
import { DraftRoomView } from "@/components/draft/draft-room-view";
import { DraftSummary } from "@/components/draft/draft-summary";
import type { CardListItemDto } from "@/lib/api/card-dto";
import type { SoloDraftView } from "@/lib/game/solo-draft";

interface Props {
  initial: SoloDraftView;
}

export function SoloDraftRoom({ initial }: Props) {
  const [session, setSession] = useState<SoloDraftView>(initial);
  const [cardCache, setCardCache] = useState<Map<string, CardListItemDto>>(new Map());
  const [picking, setPicking] = useState(false);
  const hasFetched = useRef(new Set<string>());

  // Fetch card info for cards not yet in cache.
  useEffect(() => {
    const needed = [...session.currentPack, ...session.picks].filter(
      (id) => !cardCache.has(id) && !hasFetched.current.has(id),
    );
    if (needed.length === 0) return;
    needed.forEach((id) => hasFetched.current.add(id));

    fetch(`/api/cards/batch?ids=${encodeURIComponent(needed.join(","))}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { cards: Record<string, CardListItemDto> } | null) => {
        if (!d?.cards) return;
        setCardCache((prev) => {
          const next = new Map(prev);
          for (const [id, card] of Object.entries(d.cards)) {
            next.set(id, card);
          }
          return next;
        });
      })
      .catch(() => undefined);
  }, [session.currentPack, session.picks, cardCache]);

  async function handlePick(cardId: string) {
    if (picking || session.status !== "drafting") return;
    setPicking(true);

    try {
      const res = await fetch(`/api/solo-draft/${session.sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId }),
      });

      if (!res.ok) return;
      const data = (await res.json()) as { session: SoloDraftView };
      setSession(data.session);
    } finally {
      setPicking(false);
    }
  }

  if (session.status === "complete") {
    return (
      <DraftSummary
        sessionId={session.sessionId}
        setCode={session.setCode}
        kind="phantom"
        difficulty={session.difficulty}
        cardIds={session.picks}
        cardCache={cardCache}
      />
    );
  }

  return (
    <DraftRoomView
      currentPack={session.currentPack}
      myPicks={session.picks}
      round={session.round}
      pickInRound={session.pickInRound}
      numPacks={session.numPacks}
      needsPick={session.needsPick}
      difficulty={session.difficulty}
      picking={picking}
      cardCache={cardCache}
      onPick={handlePick}
    />
  );
}
