"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useReducedMotion } from "motion/react";
import { CardImage } from "@/components/cards/card-image";
import { cardZoom, cardZoomReduced } from "@/lib/animations/card";
import type { CardListItemDto } from "@/lib/api/card-dto";

const PREVIEW_WIDTH = 240;
const PREVIEW_HEIGHT = 336; // ~5:7 aspect
const OFFSET = 12; // gap from the anchor edge

function computePosition(anchor: DOMRect): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Prefer right of anchor; fall back to left if it would clip.
  let left = anchor.right + OFFSET;
  if (left + PREVIEW_WIDTH > vw - 8) {
    left = anchor.left - PREVIEW_WIDTH - OFFSET;
  }
  if (left < 8) left = 8;

  // Vertically centre on the anchor; clamp to viewport.
  let top = anchor.top + anchor.height / 2 - PREVIEW_HEIGHT / 2;
  top = Math.max(8, Math.min(top, vh - PREVIEW_HEIGHT - 8));

  return { top, left };
}

/**
 * Portal-based card zoom preview (P9-02). Renders nothing until a card is
 * supplied. Viewport-aware: prefers the right of the anchor, flips left when
 * there's no room. Respects `prefers-reduced-motion` (instant appear/hide).
 */
export function CardPreview({
  card,
  anchorRect,
}: {
  card: CardListItemDto | null;
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
    ? (card.imageUris ?? card.cardFaces[0]?.imageUris)
    : null;
  const face = card?.cardFaces[0];

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
          aria-label={card ? `Preview: ${card.name}` : undefined}
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

// Named re-export so consumers can import the reduced variant directly.
export { cardZoom, cardZoomReduced };
