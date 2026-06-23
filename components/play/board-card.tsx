"use client";

import { CardImage } from "@/components/cards/card-image";
import { CardPlaceholder } from "@/components/cards/card-placeholder";
import type { CardListItemDto } from "@/lib/api/card-dto";
import { cn } from "@/lib/utils";

export interface ResolvedCard {
  /** null = hidden from this seat (face-down opponent / unknown). */
  dto: CardListItemDto | null;
  faceDown: boolean;
}

/** A single card face used across the battlefield, hand and zones. */
export function BoardCard({
  card,
  className,
  upsideDown,
}: {
  card: ResolvedCard;
  className?: string;
  upsideDown?: boolean;
}) {
  // Upside down shows cardback rotated 180°
  if (upsideDown) {
    return (
      <img
        src="/cardbacks/cardback.webp"
        alt="Card back (upside down)"
        className={cn(
          "aspect-5/7 w-full rounded-[4.75%/3.43%] ring-1 ring-black/15 dark:ring-white/12 rotate-180",
          className,
        )}
      />
    );
  }

  if (card.faceDown || !card.dto) {
    return (
      <div
        className={cn(
          "aspect-5/7 w-full rounded-[4.75%/3.43%] ring-1 ring-black/15 dark:ring-white/12",
          "bg-gradient-to-br from-indigo-900 via-slate-800 to-indigo-950",
          "flex items-center justify-center",
          className,
        )}
      >
        <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">MTG</span>
      </div>
    );
  }

  const face = card.dto.cardFaces[0];
  const imageUrl = card.dto.imageUris?.normal ?? face?.imageUris?.normal;
  return imageUrl ? (
    <CardImage
      name={card.dto.name}
      imageUrl={imageUrl}
      manaCost={card.dto.manaCost}
      typeLine={card.dto.typeLine}
      colorIdentity={card.dto.colorIdentity}
      className={className}
    />
  ) : (
    <CardPlaceholder
      name={card.dto.name}
      manaCost={card.dto.manaCost}
      typeLine={card.dto.typeLine}
      colorIdentity={card.dto.colorIdentity}
      className={className}
    />
  );
}
