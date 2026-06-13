"use client";

import { useReducedMotion, type Variants } from "motion/react";

/** Stagger container for friend list rows. */
export const friendListContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06 },
  },
};

/** Individual friend row fade-slide-in. */
export const friendRow: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 320, damping: 28 },
  },
};

const friendRowReduced: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0 } },
};

export const friendCodeReveal: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 260, damping: 24 },
  },
};

const friendCodeRevealReduced: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0 } },
};

export function useFriendsAnimations() {
  const reduced = useReducedMotion();
  return {
    container: friendListContainer,
    row: reduced ? friendRowReduced : friendRow,
    codeReveal: reduced ? friendCodeRevealReduced : friendCodeReveal,
  };
}
