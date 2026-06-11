"use client";

import { useReducedMotion, type Variants } from "motion/react";

/** Card in the draft pack hovers up when focused. */
export const cardDraftHover: Variants = {
  rest: { y: 0, scale: 1, zIndex: 0 },
  hover: {
    y: -6,
    scale: 1.04,
    zIndex: 10,
    transition: { type: "spring", stiffness: 400, damping: 22 },
  },
  tap: { scale: 0.97 },
  picked: { scale: 0.88, opacity: 0.4, y: 0 },
};

/** Card flies into the picked-cards tray. */
export const cardPickFly: Variants = {
  initial: { scale: 1, opacity: 1 },
  fly: {
    scale: 0.5,
    opacity: 0,
    y: 80,
    transition: { duration: 0.35, ease: "easeIn" },
  },
};

/** Stagger container for the pack grid. */
export const packGrid: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.025 } },
};

export const packGridItem: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

export function useDraftAnimations() {
  const reduced = useReducedMotion();
  return {
    cardDraftHover: reduced
      ? ({ rest: {}, hover: {}, tap: {}, picked: { opacity: 0.4 } } as Variants)
      : cardDraftHover,
    packGrid: reduced ? ({} as Variants) : packGrid,
    packGridItem: reduced
      ? ({ hidden: { opacity: 0 }, visible: { opacity: 1 } } as Variants)
      : packGridItem,
  };
}
