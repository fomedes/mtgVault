"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PackGrid } from "@/components/draft/pack-grid";
import { PickedTray } from "@/components/draft/picked-tray";
import { buttonVariants } from "@/components/ui/button";
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
    return <SoloDraftComplete session={session} cardCache={cardCache} />;
  }

  const DIFFICULTY_LABEL: Record<string, string> = { easy: "Easy", medium: "Medium", hard: "Hard" };

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
      {/* Pack + status */}
      <div className="flex-1 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">
              Round {session.round + 1} of {session.numPacks} · Pick {session.pickInRound + 1} of 15
            </p>
            <p className="text-muted-foreground text-xs">
              {session.currentPack.length} cards in pack ·{" "}
              {picking
                ? "Bots are picking…"
                : session.needsPick
                  ? "Your pick"
                  : "Waiting…"}
            </p>
          </div>
          <span className="text-muted-foreground text-xs rounded-md border px-2 py-0.5">
            {DIFFICULTY_LABEL[session.difficulty] ?? session.difficulty}
          </span>
        </div>

        <PackGrid
          cardIds={session.currentPack}
          cardCache={cardCache}
          onPick={handlePick}
          disabled={picking || !session.needsPick}
        />
      </div>

      {/* Picks tray */}
      <aside className="lg:w-56 shrink-0">
        <PickedTray cardIds={session.picks} cardCache={cardCache} />
      </aside>
    </div>
  );
}

function SoloDraftComplete({
  session,
  cardCache,
}: {
  session: SoloDraftView;
  cardCache: Map<string, CardListItemDto>;
}) {
  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <p className="text-2xl font-bold">Draft complete!</p>
        <p className="text-muted-foreground text-sm">
          Phantom solo draft — cards are not added to your collection.
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">
          Your picks ({session.picks.length})
        </p>
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10">
          {session.picks.map((id, i) => {
            const card = cardCache.get(id);
            const image = card?.imageUris ?? card?.cardFaces[0]?.imageUris;
            return (
              <div key={`${id}-${i}`} className="w-full">
                {image?.small ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={image.small}
                    alt={card?.name ?? ""}
                    className="w-full rounded-[4.75%/3.43%]"
                  />
                ) : (
                  <div className="aspect-[63/88] rounded-[4.75%/3.43%] bg-muted flex items-center justify-center text-[10px] text-muted-foreground p-1 text-center">
                    {card?.name ?? ""}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-3">
        <Link href="/solo-draft" className={buttonVariants()}>
          New draft
        </Link>
        <Link href="/history" className={buttonVariants({ variant: "outline" })}>
          Draft history
        </Link>
      </div>
    </div>
  );
}
