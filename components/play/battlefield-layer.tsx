"use client";

import { useRef } from "react";
import { motion } from "motion/react";
import { BoardCard, type ResolvedCard } from "@/components/play/board-card";
import type { ContextMenuState } from "@/components/play/card-context-menu";
import { usePlayAnimations } from "@/lib/animations/play";
import type { BattlefieldCard } from "@/lib/game/play";

/**
 * Shared free 2D battlefield. Card positions are normalized [0,1] so they map
 * across differently-sized viewports. Dragging emits a normalized x/y via
 * onMove; tapping rotates 90° through the tapRotate variant.
 */
export function BattlefieldLayer({
  battlefield,
  resolve,
  onMove,
  onOpenMenu,
}: {
  battlefield: BattlefieldCard[];
  resolve: (instanceId: string) => ResolvedCard;
  onMove: (instanceId: string, x: number, y: number) => void;
  onOpenMenu: (menu: ContextMenuState) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { tapRotate, battlefieldDrag } = usePlayAnimations();

  function handleDragEnd(instanceId: string, clientX: number, clientY: number) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    onMove(instanceId, x, y);
  }

  return (
    <div
      ref={containerRef}
      className="border-border bg-muted/30 relative flex-1 w-full overflow-hidden rounded-lg border"
    >
      {battlefield.length === 0 && (
        <p className="text-muted-foreground absolute inset-0 flex items-center justify-center text-sm">
          Battlefield — drag cards here
        </p>
      )}
      {[...battlefield]
        .sort((a, b) => a.z - b.z)
        .map((bf) => {
          const card = resolve(bf.instanceId);
          return (
            <motion.div
              key={bf.instanceId}
              drag
              dragMomentum={false}
              variants={battlefieldDrag}
              initial="rest"
              whileDrag="drag"
              onDragEnd={(_e, info) => handleDragEnd(bf.instanceId, info.point.x, info.point.y)}
              onContextMenu={(e) => {
                e.preventDefault();
                onOpenMenu({
                  instanceId: bf.instanceId,
                  onBattlefield: true,
                  tapped: bf.tapped,
                  faceDown: bf.faceDown,
                  x: e.clientX,
                  y: e.clientY,
                });
              }}
              style={{ left: `${bf.x * 100}%`, top: `${bf.y * 100}%`, zIndex: bf.z }}
              className="absolute w-20 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none active:cursor-grabbing"
            >
              <motion.div variants={tapRotate} animate={bf.tapped ? "tapped" : "untapped"} className="origin-center">
                <BoardCard card={{ dto: card.dto, faceDown: bf.faceDown && !card.dto }} />
                {Object.entries(bf.counters).length > 0 && (
                  <div className="absolute -bottom-1 -right-1 flex flex-wrap gap-0.5">
                    {Object.entries(bf.counters).map(([k, v]) => (
                      <span
                        key={k}
                        className="rounded bg-black/80 px-1 text-[10px] font-bold text-white"
                        title={k}
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            </motion.div>
          );
        })}
    </div>
  );
}
