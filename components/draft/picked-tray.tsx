"use client";

import { CardImage } from "@/components/cards/card-image";
import { useCardPreviewContext } from "@/components/cards/card-preview-provider";
import type { CardListItemDto } from "@/lib/api/card-dto";
import { cn } from "@/lib/utils";

export function PickedTray({
  cardIds,
  cardCache,
  className,
}: {
  cardIds: string[];
  cardCache: Map<string, CardListItemDto>;
  className?: string;
}) {
  const { previewHandlers } = useCardPreviewContext();

  if (cardIds.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-widest">
        Picks ({cardIds.length})
      </p>
      <div className="flex flex-wrap gap-1">
        {cardIds.map((id, i) => {
          const card = cardCache.get(id);
          const image = card?.imageUris ?? card?.cardFaces[0]?.imageUris;
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
            <div key={`${id}-${i}`} className="w-12 shrink-0 cursor-pointer" {...handlers}>
              <CardImage
                name={card?.name ?? ""}
                imageUrl={image?.small}
                colorIdentity={card?.colorIdentity}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
