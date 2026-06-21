"use client";

import { useReducedMotion, type Variants } from "motion/react";

/** Tap = rotate the card 90°; untap returns to upright. */
export const tapRotate: Variants = {
  untapped: { rotate: 0, transition: { type: "spring", stiffness: 500, damping: 30 } },
  tapped: { rotate: 90, transition: { type: "spring", stiffness: 500, damping: 30 } },
};

/** A card arriving in a zone (hand/graveyard/etc.). */
export const cardEnterZone: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 320, damping: 26 } },
};

/** Lift while dragging across the battlefield. */
export const battlefieldDrag: Variants = {
  rest: { scale: 1, boxShadow: "0 1px 2px rgba(0,0,0,0.2)" },
  drag: { scale: 1.05, boxShadow: "0 8px 24px rgba(0,0,0,0.35)" },
};

export function usePlayAnimations() {
  const reduced = useReducedMotion();
  return {
    tapRotate: reduced
      ? ({ untapped: { rotate: 0 }, tapped: { rotate: 90 } } as Variants)
      : tapRotate,
    cardEnterZone: reduced
      ? ({ hidden: { opacity: 0 }, visible: { opacity: 1 } } as Variants)
      : cardEnterZone,
    battlefieldDrag: reduced ? ({ rest: {}, drag: {} } as Variants) : battlefieldDrag,
    reduced: Boolean(reduced),
  };
}
