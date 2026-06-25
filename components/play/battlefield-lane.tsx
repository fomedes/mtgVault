"use client";

import { Reorder, motion } from "motion/react";
import { Swords } from "lucide-react";
import { useElementSize } from "@/hooks/use-element-size";
import { computeLaneOverlap } from "@/lib/play/lane-layout";
import { BoardCard, type ResolvedCard } from "@/components/play/board-card";
import { usePlayAnimations } from "@/lib/animations/play";
import { ARROW_START_EVENT, type ArrowStartDetail } from "@/lib/play/arrow";
import type { BattlefieldCard, BattlefieldZone } from "@/lib/game/play";

export type LaneAnchor = "start" | "center" | "end";

interface BattlefieldLaneProps {
  zone: BattlefieldZone;
  cards: BattlefieldCard[];
  resolve: (instanceId: string) => ResolvedCard;
  onOpenMenu: (instanceId: string, x: number, y: number) => void;
  /** Local seat's lane → drag-to-reorder enabled; opponents render upright + static. */
  isMine: boolean;
  /** Horizontal fill direction; the mirror anchors opponents to the opposite edge. */
  anchor: LaneAnchor;
  onReorder?: (newOrder: string[]) => void;
}

const JUSTIFY: Record<LaneAnchor, string> = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
};

/**
 * One zone row for one seat. Cards are sized from the lane HEIGHT (so they scale
 * to the viewport) and overlap to fit the lane WIDTH — the row never scrolls.
 * No borders/labels: position conveys the zone.
 */
export function BattlefieldLane({
  zone,
  cards,
  resolve,
  onOpenMenu,
  isMine,
  anchor,
  onReorder,
}: BattlefieldLaneProps) {
  const { ref, width, height } = useElementSize<HTMLDivElement>();
  const sorted = [...cards].sort((a, b) => a.order - b.order);
  const { cardWidth, overlapMargin } = computeLaneOverlap({
    count: sorted.length,
    laneWidth: width,
    laneHeight: height,
  });

  const slotStyle = (i: number) => ({
    width: cardWidth || undefined,
    marginLeft: i === 0 ? 0 : overlapMargin,
  });

  // Opponent lanes: upright, static, no reorder.
  if (!isMine) {
    return (
      <div
        ref={ref}
        className={`relative flex h-full w-full items-center ${JUSTIFY[anchor]}`}
      >
        {sorted.map((card, i) => (
          <div
            key={card.instanceId}
            className="shrink-0"
            style={slotStyle(i)}
            data-zone={zone}
          >
            <LaneCard
              card={card}
              resolve={resolve}
              onOpenMenu={onOpenMenu}
              isMine={isMine}
            />
          </div>
        ))}
      </div>
    );
  }

  // Local lanes: drag-to-reorder within the row + drop target for hand plays.
  return (
    <div
      ref={ref}
      data-lane-drop="true"
      data-zone={zone}
      className={`relative flex h-full w-full items-center ${JUSTIFY[anchor]}`}
    >
      <Reorder.Group
        as="div"
        axis="x"
        values={sorted}
        onReorder={(next) => onReorder?.(next.map((c) => c.instanceId))}
        className={`flex h-full items-center ${JUSTIFY[anchor]}`}
        style={{ width: "100%" }}
      >
        {sorted.map((card, i) => (
          <Reorder.Item
            key={card.instanceId}
            value={card}
            as="div"
            className="shrink-0 cursor-grab active:cursor-grabbing"
            style={slotStyle(i)}
            data-zone={zone}
          >
            <LaneCard
              card={card}
              resolve={resolve}
              onOpenMenu={onOpenMenu}
              isMine={isMine}
            />
          </Reorder.Item>
        ))}
      </Reorder.Group>
    </div>
  );
}

/** A single permanent: tap rotation, hover lift, counter badges, attack handle. */
function LaneCard({
  card,
  resolve,
  onOpenMenu,
  isMine,
}: {
  card: BattlefieldCard;
  resolve: (instanceId: string) => ResolvedCard;
  onOpenMenu: (instanceId: string, x: number, y: number) => void;
  isMine: boolean;
}) {
  const { tapRotate } = usePlayAnimations();
  const counters = Object.entries(card.counters);

  return (
    <motion.div
      variants={tapRotate}
      animate={card.tapped ? "tapped" : "untapped"}
      style={{ transformOrigin: "center center" }}
      data-card-id={card.instanceId}
      className="group relative transition-transform duration-150 hover:z-30 hover:-translate-y-[8%] hover:scale-[1.05] motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100"
      onContextMenu={(e) => {
        e.preventDefault();
        onOpenMenu(card.instanceId, e.clientX, e.clientY);
      }}
    >
      <BoardCard card={resolve(card.instanceId)} upsideDown={card.upsideDown} />
      {isMine && (
        <button
          type="button"
          aria-label="Drag to target"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const detail: ArrowStartDetail = {
              sourceId: card.instanceId,
              x: e.clientX,
              y: e.clientY,
            };
            window.dispatchEvent(
              new CustomEvent(ARROW_START_EVENT, { detail }),
            );
          }}
          className="absolute -top-1 left-1/2 z-20 -translate-x-1/2 -translate-y-full rounded-full bg-red-600/90 p-1 text-white opacity-0 shadow transition-opacity group-hover:opacity-100"
        >
          <Swords className="size-3" />
        </button>
      )}
      {counters.length > 0 && (
        <div className="absolute right-0 bottom-0 flex flex-wrap justify-end gap-0.5 p-[3%]">
          {counters.map(([key, value]) => (
            <span
              key={key}
              title={key}
              className="rounded bg-black/80 px-1 text-[0.6rem] leading-tight font-bold text-white tabular-nums ring-1 ring-white/20"
            >
              {value}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}
