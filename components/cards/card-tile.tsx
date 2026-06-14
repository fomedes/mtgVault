"use client";

import { motion } from "motion/react";
import { CardImage } from "@/components/cards/card-image";
import { useCardAnimations } from "@/lib/animations/card";
import type { CardListItemDto } from "@/lib/api/card-dto";
import { cn } from "@/lib/utils";

const RARITY_RING: Record<string, string> = {
  common: "hover:ring-rarity-common focus-visible:ring-rarity-common",
  uncommon: "hover:ring-rarity-uncommon focus-visible:ring-rarity-uncommon",
  rare: "hover:ring-rarity-rare focus-visible:ring-rarity-rare",
  mythic: "hover:ring-rarity-mythic focus-visible:ring-rarity-mythic",
  special: "hover:ring-rarity-mythic focus-visible:ring-rarity-mythic",
  bonus: "hover:ring-rarity-rare focus-visible:ring-rarity-rare",
};

export function frontImage(card: CardListItemDto) {
  return card.imageUris ?? card.cardFaces[0]?.imageUris;
}

export function CardTile({
  card,
  onClick,
  ownedCount = 0,
}: {
  card: CardListItemDto;
  onClick?: () => void;
  ownedCount?: number;
}) {
  const { cardHover } = useCardAnimations();
  const image = frontImage(card);
  const face = card.cardFaces[0];
  const unowned = ownedCount === 0;

  return (
    <div className="relative">
      <motion.button
        type="button"
        variants={cardHover}
        initial="rest"
        whileHover="hover"
        whileTap="tap"
        onClick={onClick}
        aria-label={`${card.name}, ${card.rarity}`}
        className={cn(
          "relative w-full cursor-pointer rounded-[4.75%/3.43%] ring-0 outline-none hover:ring-2 focus-visible:ring-2",
          unowned ? "opacity-40 grayscale" : "",
          RARITY_RING[card.rarity] ?? RARITY_RING.common,
        )}
      >
        <CardImage
          name={card.name}
          imageUrl={image?.normal ?? image?.small}
          manaCost={card.manaCost || face?.manaCost}
          typeLine={card.typeLine || face?.typeLine}
          colorIdentity={card.colorIdentity}
        />
      </motion.button>

      {ownedCount > 0 && (
        <span
          className="pointer-events-none absolute right-1.5 bottom-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-black/70 px-1 text-[10px] font-bold text-white"
          aria-hidden
        >
          ×{ownedCount}
        </span>
      )}
    </div>
  );
}
