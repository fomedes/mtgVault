"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export interface PackInfo {
  setCode: string;
  setName: string;
  iconSvgUri: string;
  price: number;
  releasedAt: string | null;
}

export function PackCard({
  pack,
  balance,
  onBuy,
  buying,
}: {
  pack: PackInfo;
  balance: number;
  onBuy: () => void;
  buying: boolean;
}) {
  const canAfford = balance >= pack.price;

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="bg-card flex flex-col gap-4 rounded-xl border p-5"
    >
      <div className="flex items-center gap-3">
        {pack.iconSvgUri ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={pack.iconSvgUri}
            alt=""
            className="h-8 w-8 object-contain invert opacity-70"
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold uppercase">
            {pack.setCode}
          </span>
        )}
        <div>
          <p className="font-semibold leading-tight">{pack.setName}</p>
          <p className="text-muted-foreground text-xs uppercase tracking-wide">
            {pack.setCode}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-lg font-bold">{pack.price} VC</span>
        <button
          type="button"
          disabled={!canAfford || buying}
          onClick={onBuy}
          className={cn(
            "rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors",
            canAfford
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground cursor-not-allowed",
          )}
        >
          {buying ? "Opening…" : canAfford ? "Open pack" : "Need more VC"}
        </button>
      </div>
    </motion.div>
  );
}
