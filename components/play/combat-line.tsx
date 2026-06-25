"use client";

/**
 * The luminous divider between the two halves — replaces the old "COMBAT LINE"
 * text label. Styling + the (reduced-motion-safe) shimmer live in globals.css.
 */
export function CombatLine() {
  return (
    <div className="relative h-[2px] w-full" aria-hidden>
      <div className="combat-line combat-line-shimmer absolute inset-0" />
    </div>
  );
}
