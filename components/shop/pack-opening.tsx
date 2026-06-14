"use client";

import { CardImage } from "@/components/cards/card-image";
import { usePackAnimations } from "@/lib/animations/pack";
import type { CardListItemDto } from "@/lib/api/card-dto";
import { cn } from "@/lib/utils";
import { XIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { createPortal } from "react-dom";

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
      <div className="relative">
        {/* Ambient glow */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-64 w-44 rounded-full bg-indigo-700/20 blur-3xl" />
        </div>

        {/* Float animation */}
        <motion.div
          animate={reduce ? {} : { y: [0, -7, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Hover / tap wrapper */}
          <motion.div
            onClick={onOpen}
            whileHover={reduce ? {} : { y: -4, scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="relative cursor-pointer select-none"
          >
            {/*
              PACK BODY — 488 × 296 px (h-122 w-74)
              ┌─ 0px   TOP CRIMP — heat seal ridges (40px) ─┐
              ├─ 40px  HEADER — card count + MTG logo (96px)─┤
              ├─ 136px ART WINDOW (240px) ──────────────────┤
              ├─ 376px SET NAME BANNER (36px) ──────────────┤
              ├─ 412px PACK TYPE / INFO (40px) ─────────────┤
              └─ 452px BOTTOM CRIMP — heat seal ridges (36px)┘
                 488px
            */}
            <div className="relative h-122 w-74 overflow-hidden rounded-xl shadow-[0_24px_64px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.06)]">

              {/* Base — dark navy, slightly warm centre */}
              <div className="absolute inset-0 bg-gradient-to-b from-[#0c111a] via-[#131c2e] to-[#0c111a]" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_50%_at_50%_55%,rgba(30,58,138,0.18),transparent_70%)]" />

              {/* Side depth — gives the pack a physical thickness feel */}
              <div className="pointer-events-none absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-black/60 to-transparent" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-black/60 to-transparent" />

              {/* ── TOP CRIMP (0–40px) ──────────────────────────── */}
              <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
                {[5, 9, 13, 17, 21, 26, 30, 34].map((y) => (
                  <div
                    key={y}
                    style={{ top: y }}
                    className="absolute inset-x-2.5 h-px bg-white/[0.07]"
                  />
                ))}
                {/* Bottom edge of crimp — bright line to simulate pressed seal */}
                <div className="absolute inset-x-0 bottom-0 h-px bg-white/10" />
              </div>

              {/* ── HEADER: card count + logo (40–136px) ─────────── */}
              <div className="absolute inset-x-0 top-10 flex h-32 flex-col justify-center px-5">
                <p className="self-start text-[12px] font-semibold tracking-[0.35em] text-white uppercase">
                  {cardCount} Cards
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/mtg_logo_old.webp"
                  alt="Magic: The Gathering"
                  draggable={false}
                  className="-mt-6 h-24 w-auto object-contain"
                />
              </div>

              {/* ── ART WINDOW (136–376px) ──────────────────────── */}
              <div className="absolute inset-x-1 top-34 h-[240px] overflow-hidden">
                {artUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={artUrl}
                    alt=""
                    draggable={false}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-700 via-purple-900 to-indigo-950">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_65%_55%_at_38%_35%,rgba(196,181,253,0.25),transparent_70%)]" />
                  </div>
                )}
                {/* Top vignette — art fades into header */}
                <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-black/55 to-transparent" />
                {/* Bottom vignette — art fades into set name */}
                <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/80 to-transparent" />
              </div>

              {/* ── SET NAME BANNER (376–412px) ─────────────────── */}
              <div className="absolute inset-x-0 top-[376px] flex h-[36px] items-center justify-center bg-black/65 backdrop-blur-[2px]">
                <span className="text-[14px] font-black tracking-[0.2em] text-white/90 uppercase drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)]">
                  {setCode}
                </span>
              </div>

              {/* ── PACK TYPE / INFO (412–452px) ────────────────── */}
              <div className="absolute inset-x-0 top-[412px] flex h-[40px] items-center justify-center bg-black/30">
                <div className="flex items-center gap-3">
                  <div className="h-px w-8 bg-white/15" />
                  <p className="text-[10px] font-bold tracking-[0.28em] text-white/40 uppercase">
                    Play Booster{packCount > 1 ? ` ×${packCount}` : ""}
                  </p>
                  <div className="h-px w-8 bg-white/15" />
                </div>
              </div>

              {/* ── BOTTOM CRIMP (452–488px) ────────────────────── */}
              <div className="absolute inset-x-0 bottom-0 h-9 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                {/* Top edge of crimp */}
                <div className="absolute inset-x-0 top-0 h-px bg-white/10" />
                {[6, 11, 16, 21, 26, 30].map((y) => (
                  <div
                    key={y}
                    style={{ top: y }}
                    className="absolute inset-x-2.5 h-px bg-white/[0.07]"
                  />
                ))}
              </div>

              {/* White foil shimmer sweep */}
              {!reduce && (
                <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-xl">
                  <motion.div
                    className="-skew-x-12 absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-white/16 to-transparent"
                    animate={{ x: [-64, 310] }}
                    transition={{
                      duration: 1.8,
                      repeat: Infinity,
                      repeatDelay: 3.2,
                      ease: "easeInOut",
                    }}
                  />
                </div>
              )}

              {/* Rainbow foil shimmer (offset, subtle) */}
              {!reduce && (
                <div className="pointer-events-none absolute inset-0 z-[19] overflow-hidden rounded-xl">
                  <motion.div
                    className="-skew-x-12 absolute inset-y-0 w-24"
                    style={{
                      background:
                        "linear-gradient(to right, transparent, rgba(255,100,100,0.04), rgba(255,220,80,0.04), rgba(100,210,100,0.04), rgba(80,150,255,0.05), rgba(190,110,255,0.04), transparent)",
                    }}
                    animate={{ x: [-96, 310] }}
                    transition={{
                      duration: 2.4,
                      repeat: Infinity,
                      repeatDelay: 2.8,
                      delay: 1.0,
                      ease: "easeInOut",
                    }}
                  />
                </div>
              )}

              {/* Outer ring */}
              <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/[0.09]" />
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
                  >
                    <motion.div
                      whileHover={{ scale: 1.12, zIndex: 10 }}
                      transition={{ type: "spring", stiffness: 350, damping: 22 }}
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
