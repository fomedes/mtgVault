"use client";

import { useState } from "react";
import { CardPlaceholder } from "@/components/cards/card-placeholder";
import { cn } from "@/lib/utils";

/**
 * A card scan with the D6 placeholder fallback. Plain <img> on purpose:
 * Scryfall serves pre-sized CDN images, and routing thousands of unique
 * scans through next/image would burn the Vercel optimization quota for
 * zero gain (image strategy is re-audited in P5-05).
 */
export function CardImage({
  name,
  imageUrl,
  manaCost,
  typeLine,
  colorIdentity,
  className,
}: {
  name: string;
  imageUrl?: string;
  manaCost?: string;
  typeLine?: string;
  colorIdentity?: string[];
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!imageUrl || failed) {
    return (
      <CardPlaceholder
        name={name}
        manaCost={manaCost}
        typeLine={typeLine}
        colorIdentity={colorIdentity}
        className={className}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- see component docblock
    <img
      src={imageUrl}
      alt={name}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
      className={cn(
        "aspect-5/7 w-full rounded-[4.75%/3.43%] object-cover",
        className,
      )}
    />
  );
}
