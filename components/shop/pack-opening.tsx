"use client";

import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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

const RARITY_ORDER: Record<string, number> = {
  mythic: 0,
  rare: 1,
  uncommon: 2,
  common: 3,
};

function PackVisual({
  cards,
  packCount,
  onOpen,
}: {
  cards: CardListItemDto[];
  packCount: number;
  onOpen: () => void;
}) {
  const reduce = useReducedMotion();

  // Use the rarest card's art crop as the pack face art
  const artCard = [...cards].sort(
    (a, b) => (RARITY_ORDER[a.rarity] ?? 4) - (RARITY_ORDER[b.rarity] ?? 4),
  )[0];
  const artUrl =
    artCard?.imageUris?.artCrop ?? artCard?.cardFaces[0]?.imageUris?.artCrop;
  const setCode = cards[0]?.set?.toUpperCase() ?? "MTG VAULT";
  const cardCount = cards.length;

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Glow behind pack */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-52 w-36 rounded-full bg-violet-600/25 blur-3xl" />
        </div>

        {/* Floating wrapper */}
        <motion.div
          animate={reduce ? {} : { y: [0, -7, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Click / hover wrapper */}
          <motion.div
            onClick={onOpen}
            whileHover={reduce ? {} : { y: -4, scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="relative cursor-pointer select-none"
          >
            {/* Pack body */}
            <div className="relative h-64 w-44 overflow-hidden rounded-xl shadow-2xl shadow-black/60">
              {/* Metallic base */}
              <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900" />

              {/* Art window */}
              <div className="absolute inset-x-2.5 top-7 h-[140px] overflow-hidden rounded-sm">
                {artUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={artUrl}
                    alt=""
                    draggable={false}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-purple-700 to-indigo-900">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_40%_40%,rgba(196,181,253,0.3),transparent_70%)]" />
                  </div>
                )}
                {/* Vignette at base of art to blend into banner */}
                <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-slate-900/80 to-transparent" />
              </div>

              {/* Top crimp */}
              <div className="absolute inset-x-0 top-0 z-10 flex h-7 flex-col items-center justify-center gap-1 bg-gradient-to-b from-black/70 to-transparent">
                <div className="flex gap-2">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-px w-7 rounded-full bg-white/15"
                    />
                  ))}
                </div>
                <div className="h-px w-32 rounded-full bg-white/8" />
              </div>

              {/* Set name banner */}
              <div className="absolute inset-x-0 top-[183px] flex h-6 items-center justify-center bg-black/55">
                <span className="text-[9px] font-bold tracking-[0.22em] text-white/75 uppercase">
                  {setCode}
                </span>
              </div>

              {/* Card count info */}
              <div className="absolute inset-x-2.5 top-[209px] bottom-7 flex flex-col items-center justify-center gap-1">
                <p className="text-[8px] font-medium text-white/40">
                  {packCount === 1
                    ? "1 Booster Pack"
                    : `${packCount} Booster Packs`}
                  {" · "}
                  {cardCount} Cards
                </p>
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-px w-8 rounded-full bg-white/10" />
                  ))}
                </div>
              </div>

              {/* Bottom crimp */}
              <div className="absolute inset-x-0 bottom-0 z-10 flex h-7 flex-col items-center justify-center gap-1 bg-gradient-to-t from-black/70 to-transparent">
                <div className="h-px w-32 rounded-full bg-white/8" />
                <div className="flex gap-2">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-px w-7 rounded-full bg-white/15"
                    />
                  ))}
                </div>
              </div>

              {/* Foil shimmer sweep */}
              {!reduce && (
                <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-xl">
                  <motion.div
                    className="-skew-x-12 absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-white/18 to-transparent"
                    animate={{ x: [-80, 256] }}
                    transition={{
                      duration: 1.6,
                      repeat: Infinity,
                      repeatDelay: 2.8,
                      ease: "easeInOut",
                    }}
                  />
                </div>
              )}

              {/* Edge ring */}
              <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10" />
            </div>
          </motion.div>
        </motion.div>
      </div>

      <div className="flex flex-col items-center gap-3">
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.96 }}
          onClick={onOpen}
          className="rounded-full bg-white px-8 py-3 text-sm font-bold text-black transition-colors hover:bg-white/90"
        >
          Open pack
        </motion.button>
        <p className="text-xs text-white/40">or swipe down to close</p>
      </div>
    </div>
  );
}

export function PackOpening({
  cards,
  packCount,
  onClose,
}: {
  cards: CardListItemDto[];
  packCount: number;
  onClose: () => void;
}) {
  const { cardReveal, packCardGrid } = usePackAnimations();
  const { packEnter } = usePackAnimations();
  const [revealed, setRevealed] = useState(false);

  const overlay = (
    <motion.div
      key="pack-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex flex-col bg-black/95"
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      onDragEnd={(_, info) => {
        if (info.offset.y > 80) onClose();
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-sm font-semibold text-white">
          {packCount === 1 ? "Booster pack" : `${packCount} Booster packs`}
          {" · "}
          {cards.length} cards
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close pack opening"
          className="rounded-full p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <XIcon className="size-5" />
        </button>
      </div>

      {/* Pack graphic / card reveal */}
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
            <PackVisual
              cards={cards}
              packCount={packCount}
              onOpen={() => setRevealed(true)}
            />
          </motion.div>
        ) : (
          <motion.div key="cards" className="flex-1 overflow-y-auto px-3 pb-8">
            <motion.div
              variants={packCardGrid}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-3 gap-2 pt-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8"
            >
              {cards.map((card, i) => {
                const image = card.imageUris ?? card.cardFaces[0]?.imageUris;
                const face = card.cardFaces[0];
                const isRare = RARE_RARITIES.has(card.rarity);

                return (
                  <motion.div
                    key={`${card.scryfallId}-${i}`}
                    variants={cardReveal}
                    className={cn(
                      "relative overflow-hidden rounded-[4.75%/3.43%]",
                      isRare ? (RARITY_GLOW_CLASS[card.rarity] ?? "") : "",
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

  // Portal to document.body escapes the z-10 stacking context on #main-content,
  // ensuring the overlay and its close button render above the sticky nav (z-40).
  return createPortal(overlay, document.body);
}
