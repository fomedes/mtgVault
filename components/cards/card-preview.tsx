"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CardImage } from "@/components/cards/card-image";
import { cardZoom, cardZoomReduced } from "@/lib/animations/card";

const PREVIEW_WIDTH = 240;
const PREVIEW_HEIGHT = 336; // ~5:7 aspect
const OFFSET = 12;

function computePosition(anchor: DOMRect): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = anchor.right + OFFSET;
  if (left + PREVIEW_WIDTH > vw - 8) {
    left = anchor.left - PREVIEW_WIDTH - OFFSET;
  }
  if (left < 8) left = 8;
  let top = anchor.top + anchor.height / 2 - PREVIEW_HEIGHT / 2;
  top = Math.max(8, Math.min(top, vh - PREVIEW_HEIGHT - 8));
  return { top, left };
}

/**
 * Minimal card shape the preview portal needs. Both `CardListItemDto` and
 * `DeckCardDto` satisfy this — lets any card surface opt in without coupling
 * to a specific DTO.
 */
export interface Previewable {
  scryfallId: string;
  name: string;
  manaCost?: string;
  typeLine?: string;
  colorIdentity?: string[];
  imageUris?: { small?: string; normal?: string; large?: string };
  cardFaces?: {
    manaCost?: string;
    typeLine?: string;
    imageUris?: { small?: string; normal?: string; large?: string };
  }[];
}

/**
 * Portal-based card zoom preview (P9-02, extended in P10-05). Renders nothing
 * until a card is supplied. Viewport-aware positioning. Respects
 * `prefers-reduced-motion`.
 */
export function CardPreview({
  card,
  anchorRect,
}: {
  card: Previewable | null;
  anchorRect: DOMRect | null;
}) {
  const reduced = useReducedMotion();
  const variant = reduced ? cardZoomReduced : cardZoom;
  const [mounted, setMounted] = useState(false);
  const posRef = useRef<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  if (card && anchorRect) {
    posRef.current = computePosition(anchorRect);
  }

  const image = card
    ? (card.imageUris ?? card.cardFaces?.[0]?.imageUris)
    : null;
  const face = card?.cardFaces?.[0];

  const content = (
    <AnimatePresence>
      {card ? (
        <motion.div
          key={card.scryfallId}
          variants={variant}
          initial="hidden"
          animate="visible"
          exit="exit"
          role="tooltip"
          aria-label={`Preview: ${card.name}`}
          style={{
            position: "fixed",
            top: posRef.current.top,
            left: posRef.current.left,
            width: PREVIEW_WIDTH,
            zIndex: 9999,
            pointerEvents: "none",
          }}
        >
          <CardImage
            name={card.name}
            imageUrl={image?.large ?? image?.normal ?? image?.small}
            manaCost={card.manaCost || face?.manaCost}
            typeLine={card.typeLine || face?.typeLine}
            colorIdentity={card.colorIdentity}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}

export { cardZoom, cardZoomReduced };
