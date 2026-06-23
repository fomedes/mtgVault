"use client";

import { Reorder, motion } from "motion/react";
import { BoardCard, type ResolvedCard } from "@/components/play/board-card";
import type { BattlefieldCard, BattlefieldZone } from "@/lib/game/play";
import { usePlayAnimations } from "@/lib/animations/play";

interface ZoneStripProps {
  zone: BattlefieldZone;
  cards: BattlefieldCard[];
  resolve: (instanceId: string) => ResolvedCard;
  onReorder: (newOrder: string[]) => void;
  onOpenMenu: (instanceId: string, x: number, y: number) => void;
  isOpponent?: boolean;
}

const ZONE_LABELS: Record<BattlefieldZone, string> = {
  creatures: "Creatures",
  other: "Other",
  lands: "Lands",
};

const ZONE_ICON: Record<BattlefieldZone, string> = {
  creatures: "⚔️",
  other: "🔮",
  lands: "🌲",
};

export function ZoneStrip({
  zone,
  cards,
  resolve,
  onReorder,
  onOpenMenu,
  isOpponent,
}: ZoneStripProps) {
  const { tapRotate } = usePlayAnimations();

  const sortedCards = [...cards].sort((a, b) => a.order - b.order);

  return (
    <div className={`flex flex-col gap-2 ${isOpponent ? "scale-y-[-1]" : ""}`}>
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        <span>{ZONE_ICON[zone]}</span>
        <span>{ZONE_LABELS[zone]}</span>
        <span className="text-[10px]">({sortedCards.length})</span>
      </div>
      <Reorder.Group
        axis="x"
        values={sortedCards}
        onReorder={(newCards) => onReorder(newCards.map((c) => c.instanceId))}
        className="flex flex-wrap gap-2 min-h-24 p-2 rounded-lg border border-dashed border-border/50 bg-background/40"
      >
        {sortedCards.map((card) => {
          const resolved = resolve(card.instanceId);
          return (
            <Reorder.Item
              key={card.instanceId}
              value={card}
            >
              <motion.div
                variants={tapRotate}
                animate={card.tapped ? "tapped" : "untapped"}
                style={{ transformOrigin: "center center" }}
                className={`cursor-grab active:cursor-grabbing ${
                  isOpponent ? "scale-y-[-1]" : ""
                }`}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onOpenMenu(card.instanceId, e.clientX, e.clientY);
                }}
              >
                <BoardCard card={resolved} upsideDown={card.upsideDown} />
                {Object.entries(card.counters).length > 0 && (
                  <div className="absolute -bottom-1 -right-1 flex flex-wrap gap-0.5">
                    {Object.entries(card.counters).map(([k, v]) => (
                      <span
                        key={k}
                        className={`rounded bg-black/80 px-1 text-[10px] font-bold text-white ${
                          isOpponent ? "scale-y-[-1]" : ""
                        }`}
                        title={k}
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            </Reorder.Item>
          );
        })}
      </Reorder.Group>
    </div>
  );
}
