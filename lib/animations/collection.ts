"use client";

import { useReducedMotion, type Variants } from "motion/react";

/** Scale-in pulse played when a card enters the collection view. */
export const cardEnterCollection: Variants = {
  hidden: { scale: 0.85, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { type: "spring", stiffness: 300, damping: 20 },
  },
};

const cardEnterCollectionReduced: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
};

/** Shine sweep overlay: translates from off-left to off-right. */
export const collectionShine: Variants = {
  hidden: { x: "-110%", skewX: -20 },
  visible: {
    x: "220%",
    skewX: -20,
    transition: { duration: 0.65, delay: 0.18, ease: "easeInOut" },
  },
};

const collectionShineReduced: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 0 },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.03, delayChildren: 0.05 } },
};

const staggerContainerReduced: Variants = {
  hidden: {},
  visible: {},
};

export function useCollectionAnimations() {
  const reduced = useReducedMotion();
  return {
    cardEnterCollection: reduced
      ? cardEnterCollectionReduced
      : cardEnterCollection,
    collectionShine: reduced ? collectionShineReduced : collectionShine,
    staggerContainer: reduced ? staggerContainerReduced : staggerContainer,
  };
}
