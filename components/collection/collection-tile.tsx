"use client";

import { motion } from "motion/react";
import { CardImage } from "@/components/cards/card-image";
import { useCardPreviewContext } from "@/components/cards/card-preview-provider";
import { useCardAnimations } from "@/lib/animations/card";
import { useCollectionAnimations } from "@/lib/animations/collection";
import type { CollectionEntryDto } from "@/lib/api/collection-dto";
import { cn } from "@/lib/utils";

const RARITY_RING: Record<string, string> = {
  common: "hover:ring-rarity-common focus-visible:ring-rarity-common",
  uncommon: "hover:ring-rarity-uncommon focus-visible:ring-rarity-uncommon",
  rare: "hover:ring-rarity-rare focus-visible:ring-rarity-rare",
  mythic: "hover:ring-rarity-mythic focus-visible:ring-rarity-mythic",
  special: "hover:ring-rarity-mythic focus-visible:ring-rarity-mythic",
  bonus: "hover:ring-rarity-rare focus-visible:ring-rarity-rare",
};

export function CollectionTile({
  entry,
  onClick,
  animate = false,
}: {
  entry: CollectionEntryDto;
  onClick?: () => void;
  animate?: boolean;
}) {
  const { cardHover } = useCardAnimations();
  const { cardEnterCollection, collectionShine } = useCollectionAnimations();
  const { previewHandlers } = useCardPreviewContext();
  const { card } = entry;
  const image = card.imageUris ?? card.cardFaces[0]?.imageUris;
  const face = card.cardFaces[0];

  return (
    <motion.div
      variants={animate ? cardEnterCollection : undefined}
      initial={animate ? "hidden" : false}
      animate={animate ? "visible" : undefined}
      className="relative"
    >
      <motion.button
        type="button"
        variants={cardHover}
        initial="rest"
        whileHover="hover"
        whileTap="tap"
        onClick={onClick}
        {...previewHandlers(card)}
        aria-label={`${card.name}, ${card.rarity}, quantity ${entry.quantity}`}
        className={cn(
          "relative w-full cursor-pointer rounded-[4.75%/3.43%] ring-0 outline-none hover:ring-2 focus-visible:ring-2 overflow-hidden",
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

        {/* Shine sweep overlay */}
        {animate ? (
          <motion.span
            variants={collectionShine}
            className="pointer-events-none absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent"
            aria-hidden
          />
        ) : null}
      </motion.button>

      {/* Quantity badge */}
      {entry.quantity > 1 ? (
        <span
          className="pointer-events-none absolute right-1.5 bottom-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-black/70 px-1 text-[10px] font-bold text-white"
          aria-hidden
        >
          ×{entry.quantity}
        </span>
      ) : null}
    </motion.div>
  );
}
