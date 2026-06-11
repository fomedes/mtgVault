"use client";

import { motion } from "motion/react";
import { CardImage } from "@/components/cards/card-image";
import { useCardAnimations } from "@/lib/animations/card";
import type { CardListItemDto } from "@/lib/api/card-dto";
import { cn } from "@/lib/utils";

/** Tailwind needs complete literal class names, hence the string map. */
const RARITY_RING: Record<string, string> = {
  common: "hover:ring-rarity-common focus-visible:ring-rarity-common",
  uncommon: "hover:ring-rarity-uncommon focus-visible:ring-rarity-uncommon",
  rare: "hover:ring-rarity-rare focus-visible:ring-rarity-rare",
  mythic: "hover:ring-rarity-mythic focus-visible:ring-rarity-mythic",
  special: "hover:ring-rarity-mythic focus-visible:ring-rarity-mythic",
  bonus: "hover:ring-rarity-rare focus-visible:ring-rarity-rare",
};

/** DFCs keep their images on the faces; the grid shows the front face. */
export function frontImage(card: CardListItemDto) {
  return card.imageUris ?? card.cardFaces[0]?.imageUris;
}

export function CardTile({
  card,
  onClick,
}: {
  card: CardListItemDto;
  onClick?: () => void;
}) {
  const { cardHover } = useCardAnimations();
  const image = frontImage(card);
  const face = card.cardFaces[0];

  return (
    <motion.button
      type="button"
      variants={cardHover}
      initial="rest"
      whileHover="hover"
      whileTap="tap"
      onClick={onClick}
      aria-label={`${card.name}, ${card.rarity}`}
      className={cn(
        "relative cursor-pointer rounded-[4.75%/3.43%] ring-0 outline-none hover:ring-2 focus-visible:ring-2",
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
  );
}
