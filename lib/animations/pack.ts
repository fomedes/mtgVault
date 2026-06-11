"use client";

import { useReducedMotion, type Variants } from "motion/react";

/** Pack graphic enters from top and settles. */
export const packEnter: Variants = {
  hidden: { y: -80, opacity: 0, scale: 0.85 },
  visible: {
    y: 0,
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 260, damping: 22 },
  },
  exit: { y: 80, opacity: 0, scale: 0.8, transition: { duration: 0.25 } },
};

/** Per-card reveal: starts face-down (scale 0) and flips up. */
export const cardReveal: Variants = {
  hidden: { scale: 0, rotateY: 90, opacity: 0 },
  visible: {
    scale: 1,
    rotateY: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 300, damping: 24 },
  },
};

const cardRevealReduced: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.1 } },
};

/** Glow pulse for rare / mythic cards after they reveal. */
export const rarityGlow: Variants = {
  idle: { boxShadow: "0 0 0px 0px rgba(251,191,36,0)" },
  glow: {
    boxShadow: [
      "0 0 0px 0px rgba(251,191,36,0)",
      "0 0 24px 8px rgba(251,191,36,0.7)",
      "0 0 12px 4px rgba(251,191,36,0.35)",
    ],
    transition: { duration: 1.2, ease: "easeOut" },
  },
};

const rarityGlowReduced: Variants = {
  idle: {},
  glow: {},
};

/** Stagger container for the card grid inside the opening overlay. */
export const packCardGrid: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06, delayChildren: 0.3 },
  },
};

const packCardGridReduced: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0 } },
};

export function usePackAnimations() {
  const reduced = useReducedMotion();
  return {
    packEnter: reduced
      ? ({ hidden: { opacity: 0 }, visible: { opacity: 1 } } as Variants)
      : packEnter,
    cardReveal: reduced ? cardRevealReduced : cardReveal,
    rarityGlow: reduced ? rarityGlowReduced : rarityGlow,
    packCardGrid: reduced ? packCardGridReduced : packCardGrid,
  };
}
