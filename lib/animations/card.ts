"use client";

import { useReducedMotion, type Variants } from "motion/react";

/**
 * Card animation variants (P1-07). All consumers go through
 * useCardAnimations() so `prefers-reduced-motion` is honoured everywhere.
 */

export const cardHover: Variants = {
  rest: { y: 0, scale: 1 },
  hover: {
    y: -4,
    scale: 1.02,
    transition: { type: "spring", stiffness: 400, damping: 25 },
  },
  tap: { scale: 0.97 },
};

const cardHoverReduced: Variants = {
  rest: {},
  hover: {},
  tap: {},
};

/** Applied to the inner face wrapper of a DFC; parent needs `perspective`. */
export const cardFlip: Variants = {
  front: {
    rotateY: 0,
    transition: { type: "spring", stiffness: 260, damping: 26 },
  },
  back: {
    rotateY: 180,
    transition: { type: "spring", stiffness: 260, damping: 26 },
  },
};

const cardFlipReduced: Variants = {
  front: { rotateY: 0, transition: { duration: 0 } },
  back: { rotateY: 180, transition: { duration: 0 } },
};

export function useCardAnimations() {
  const reduced = useReducedMotion();
  return {
    cardHover: reduced ? cardHoverReduced : cardHover,
    cardFlip: reduced ? cardFlipReduced : cardFlip,
  };
}
