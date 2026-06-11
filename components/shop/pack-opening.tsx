"use client";

import { AnimatePresence, motion } from "motion/react";
import { XIcon } from "lucide-react";
import { useState } from "react";
import { CardImage } from "@/components/cards/card-image";
import { usePackAnimations } from "@/lib/animations/pack";
import type { CardListItemDto } from "@/lib/api/card-dto";
import { cn } from "@/lib/utils";

const RARE_RARITIES = new Set(["rare", "mythic"]);

const RARITY_GLOW_CLASS: Record<string, string> = {
  mythic:
    "ring-2 ring-rarity-mythic shadow-[0_0_20px_4px_theme(colors.rarity.mythic/0.6)]",
  rare: "ring-2 ring-rarity-rare shadow-[0_0_16px_4px_theme(colors.rarity.rare/0.5)]",
};

export function PackOpening({
  cards,
  packCount,
  onClose,
}: {
  cards: CardListItemDto[];
  packCount: number;
  onClose: () => void;
}) {
  const { packEnter, cardReveal, packCardGrid } = usePackAnimations();
  const [revealed, setRevealed] = useState(false);

  return (
    <motion.div
      key="pack-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-black/95"
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      onDragEnd={(_, info) => {
        if (info.offset.y > 80) onClose();
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-sm font-semibold text-white">
          {packCount === 1 ? "Booster pack" : `${packCount} Booster packs`} ·{" "}
          {cards.length} cards
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close pack opening"
          className="rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
        >
          <XIcon className="size-5" />
        </button>
      </div>

      {/* Pack graphic / CTA */}
      <AnimatePresence mode="wait">
        {!revealed ? (
          <motion.div
            key="cta"
            variants={packEnter}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex flex-1 flex-col items-center justify-center gap-6"
          >
            <div className="flex h-36 w-24 items-center justify-center rounded-xl border-2 border-white/20 bg-gradient-to-br from-violet-600 to-indigo-800 shadow-xl">
              <span className="text-4xl">✦</span>
            </div>
            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setRevealed(true)}
              className="rounded-full bg-white px-8 py-3 text-sm font-bold text-black hover:bg-white/90 transition-colors"
            >
              Open pack
            </motion.button>
            <p className="text-white/40 text-xs">or swipe down to close</p>
          </motion.div>
        ) : (
          <motion.div
            key="cards"
            className="flex-1 overflow-y-auto px-3 pb-8"
          >
            <motion.div
              variants={packCardGrid}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-3 gap-2 pt-2 sm:grid-cols-4 md:grid-cols-5"
            >
              {cards.map((card, i) => {
                const image =
                  card.imageUris ?? card.cardFaces[0]?.imageUris;
                const face = card.cardFaces[0];
                const isRare = RARE_RARITIES.has(card.rarity);

                return (
                  <motion.div
                    key={`${card.scryfallId}-${i}`}
                    variants={cardReveal}
                    className={cn(
                      "relative rounded-[4.75%/3.43%] overflow-hidden",
                      isRare ? RARITY_GLOW_CLASS[card.rarity] ?? "" : "",
                    )}
                  >
                    <CardImage
                      name={card.name}
                      imageUrl={image?.normal ?? image?.small}
                      manaCost={card.manaCost || face?.manaCost}
                      typeLine={card.typeLine || face?.typeLine}
                      colorIdentity={card.colorIdentity}
                    />
                  </motion.div>
                );
              })}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
