"use client";

import { useState } from "react";
import Link from "next/link";
import { CardPreviewProvider } from "@/components/cards/card-preview-provider";
import { useCardPreviewContext } from "@/components/cards/card-preview-provider";
import { CardImage } from "@/components/cards/card-image";
import { PoolStats } from "@/components/draft/pool-stats";
import { Button, buttonVariants } from "@/components/ui/button";
import type { CardListItemDto } from "@/lib/api/card-dto";
import { cn } from "@/lib/utils";

interface DraftSummaryProps {
  sessionId: string;
  setCode: string;
  kind: "multiplayer" | "phantom";
  difficulty?: string;
  cardIds: string[];
  cardCache: Map<string, CardListItemDto>;
  onNewDraft?: () => void;
}

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

function PickGrid({
  cardIds,
  cardCache,
}: {
  cardIds: string[];
  cardCache: Map<string, CardListItemDto>;
}) {
  const { previewHandlers } = useCardPreviewContext();
  return (
    <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-8 md:grid-cols-10">
      {cardIds.map((id, i) => {
        const card = cardCache.get(id);
        const image = card?.imageUris ?? card?.cardFaces?.[0]?.imageUris;
        const handlers = card
          ? previewHandlers({
              scryfallId: card.scryfallId,
              name: card.name,
              manaCost: card.manaCost,
              typeLine: card.typeLine,
              colorIdentity: card.colorIdentity,
              imageUris: card.imageUris,
              cardFaces: card.cardFaces,
            })
          : {};
        return (
          <div key={`${id}-${i}`} className="w-full cursor-pointer" {...handlers}>
            <CardImage
              name={card?.name ?? ""}
              imageUrl={image?.small}
              colorIdentity={card?.colorIdentity}
            />
          </div>
        );
      })}
    </div>
  );
}

function DraftSummaryInner({
  sessionId,
  setCode,
  kind,
  difficulty,
  cardIds,
  cardCache,
}: DraftSummaryProps) {
  const [building, setBuilding] = useState(false);
  const [exportDone, setExportDone] = useState(false);

  async function handleBuildDeck() {
    setBuilding(true);
    try {
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const res = await fetch("/api/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Draft — ${setCode.toUpperCase()} (${dateStr})`,
          sourceDraftId: sessionId,
          cardIds,
        }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { deck?: { _id?: string; id?: string } };
      const deckId = data.deck?._id ?? data.deck?.id;
      if (deckId) {
        window.location.href = `/decks/${deckId}`;
      }
    } finally {
      setBuilding(false);
    }
  }

  function handleExport() {
    // Build a simple "1 Card Name" text list
    const nameCount: Record<string, number> = {};
    for (const id of cardIds) {
      const card = cardCache.get(id);
      const name = card?.name ?? id;
      nameCount[name] = (nameCount[name] ?? 0) + 1;
    }
    const lines = Object.entries(nameCount).map(([name, count]) => `${count} ${name}`);
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `draft-${setCode}-${sessionId.slice(-6)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setExportDone(true);
    setTimeout(() => setExportDone(false), 2000);
  }

  const kindLabel = kind === "phantom" ? "Phantom" : "Multiplayer";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">Draft Complete</h1>
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-semibold",
              kind === "phantom"
                ? "bg-purple-500/20 text-purple-300"
                : "bg-blue-500/20 text-blue-300",
            )}
          >
            {kindLabel}
          </span>
          {difficulty && (
            <span className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
              {DIFFICULTY_LABEL[difficulty] ?? difficulty}
            </span>
          )}
        </div>
        <p className="text-muted-foreground text-sm">
          {setCode.toUpperCase()} · {cardIds.length} cards picked
          {kind === "phantom" &&
            " · Phantom draft — cards are not added to your collection"}
        </p>
      </div>

      {/* Stats */}
      {cardIds.length > 0 && (
        <div className="rounded-lg border bg-card/50 p-4">
          <h2 className="text-sm font-semibold mb-3">Pool Analysis</h2>
          <PoolStats cardIds={cardIds} cardCache={cardCache} variant="expanded" />
        </div>
      )}

      {/* Pick pool grid */}
      {cardIds.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Your Picks ({cardIds.length})</h2>
          <PickGrid cardIds={cardIds} cardCache={cardCache} />
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3 pt-2">
        <Button onClick={handleBuildDeck} disabled={building}>
          {building ? "Creating…" : "Build a Deck"}
        </Button>
        <Button variant="outline" onClick={handleExport}>
          {exportDone ? "Exported!" : "Export"}
        </Button>
        <Link href="/history" className={buttonVariants({ variant: "ghost" })}>
          View History
        </Link>
        {kind === "phantom" ? (
          <Link href="/solo-draft" className={buttonVariants({ variant: "ghost" })}>
            New Draft
          </Link>
        ) : (
          <Link href="/draft" className={buttonVariants({ variant: "ghost" })}>
            Back to Lobby
          </Link>
        )}
      </div>
    </div>
  );
}

export function DraftSummary(props: DraftSummaryProps) {
  return (
    <CardPreviewProvider>
      <DraftSummaryInner {...props} />
    </CardPreviewProvider>
  );
}
