"use client";

import { motion } from "motion/react";
import { CardImage } from "@/components/cards/card-image";
import { useDraftAnimations } from "@/lib/animations/draft";
import type { CardListItemDto } from "@/lib/api/card-dto";
import { cn } from "@/lib/utils";

const RARITY_RING: Record<string, string> = {
  common: "hover:ring-rarity-common focus-visible:ring-rarity-common",
  uncommon: "hover:ring-rarity-uncommon focus-visible:ring-rarity-uncommon",
  rare: "hover:ring-rarity-rare focus-visible:ring-rarity-rare",
  mythic: "hover:ring-rarity-mythic focus-visible:ring-rarity-mythic",
};

export function PackGrid({
  cardIds,
  cardCache,
  onPick,
  disabled,
}: {
  cardIds: string[];
  cardCache: Map<string, CardListItemDto>;
  onPick: (cardId: string) => void;
  disabled: boolean;
}) {
  const { cardDraftHover, packGrid, packGridItem } = useDraftAnimations();

  return (
    <motion.div
      variants={packGrid}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5"
    >
      {cardIds.map((id, i) => {
        const card = cardCache.get(id);
        const image = card?.imageUris ?? card?.cardFaces[0]?.imageUris;
        const face = card?.cardFaces[0];

        return (
          <motion.div key={`${id}-${i}`} variants={packGridItem}>
            <motion.button
              type="button"
              variants={cardDraftHover}
              initial="rest"
              whileHover={disabled ? "rest" : "hover"}
              whileTap={disabled ? "rest" : "tap"}
              disabled={disabled}
              onClick={() => onPick(id)}
              aria-label={card ? `Pick ${card.name}` : "Pick card"}
              className={cn(
                "relative w-full cursor-pointer rounded-[4.75%/3.43%] ring-0 outline-none",
                disabled ? "cursor-not-allowed opacity-60" : "hover:ring-2 focus-visible:ring-2",
                card ? (RARITY_RING[card.rarity] ?? RARITY_RING.common) : "",
              )}
            >
              <CardImage
                name={card?.name ?? ""}
                imageUrl={image?.normal ?? image?.small}
                manaCost={card?.manaCost || face?.manaCost}
                typeLine={card?.typeLine || face?.typeLine}
                colorIdentity={card?.colorIdentity}
              />
            </motion.button>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
