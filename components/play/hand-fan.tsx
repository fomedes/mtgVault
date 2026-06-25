"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "motion/react";
import { useElementSize } from "@/hooks/use-element-size";
import { computeLaneOverlap } from "@/lib/play/lane-layout";
import { BoardCard, type ResolvedCard } from "@/components/play/board-card";
import { CardPreview } from "@/components/cards/card-preview";
import { useCardPreview } from "@/hooks/use-card-preview";
import type { BattlefieldZone } from "@/lib/game/play";

const DROP_ZONES: ReadonlySet<string> = new Set([
  "creatures",
  "other",
  "lands",
]);

/** Walk the elements under a point for a droppable lane; returns its zone. */
function findDropZone(x: number, y: number): BattlefieldZone | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const lane = (el as HTMLElement).closest?.("[data-lane-drop='true']");
    const zone = lane?.getAttribute("data-zone");
    if (zone && DROP_ZONES.has(zone)) return zone as BattlefieldZone;
  }
  return null;
}

interface HandFanProps {
  side: "top" | "bottom";
  /** Face = the local seat's real, interactive cards. Back = opponent cardbacks. */
  variant: "face" | "back";
  hand?: string[];
  count?: number;
  resolve?: (instanceId: string) => ResolvedCard;
  /** Click / tap to play to the type-default zone. */
  onPlay?: (instanceId: string) => void;
  /** Drag-drop onto a lane to play to that specific zone. */
  onPlayToZone?: (instanceId: string, zone: BattlefieldZone) => void;
  onContext?: (instanceId: string, x: number, y: number) => void;
}

/**
 * An edge-centered, overlapping arc fan. Cards size to the band height and
 * compress to fit its width (never scrolls). The local hand is interactive
 * (hover-zoom, click-to-play, drag-to-lane); opponent hands are count-driven
 * cardbacks. Cards stay upright on both sides — only the arc flips.
 */
export function HandFan({
  side,
  variant,
  hand = [],
  count = 0,
  resolve,
  onPlay,
  onPlayToZone,
  onContext,
}: HandFanProps) {
  const preview = useCardPreview();
  const { ref, width, height } = useElementSize<HTMLDivElement>();

  const ids = variant === "face" ? hand : [];
  const n = variant === "face" ? ids.length : count;
  const { cardWidth, step } = computeLaneOverlap({
    count: n,
    laneWidth: width,
    laneHeight: height * 0.94,
  });

  // Arc geometry (subtle; flips for the top side so the bow points outward).
  const spreadDeg = Math.min(3 * Math.max(n - 1, 0), 22);
  const bowPx = Math.min(height * 0.12, 26);
  const dir = side === "bottom" ? 1 : -1;
  const edge = side === "bottom" ? "bottom" : "top";

  function arc(i: number) {
    const mid = (n - 1) / 2;
    const t = n > 1 ? (i - mid) / mid : 0; // -1..1
    const left = width / 2 + (i - mid) * step;
    const angle = (n > 1 ? (i - mid) / (n - 1) : 0) * spreadDeg * dir;
    const bow = (1 - Math.cos(t * 1.2)) * bowPx * dir;
    return {
      left,
      transform: `translateX(-50%) translateY(${bow}px) rotate(${angle}deg)`,
    };
  }

  return (
    <div ref={ref} className="relative h-full w-full overflow-visible">
      {Array.from({ length: n }).map((_, i) => {
        const { left, transform } = arc(i);
        const slotStyle: React.CSSProperties = {
          position: "absolute",
          left,
          [edge]: 0,
          width: cardWidth || undefined,
          transform,
          transformOrigin: `${edge} center`,
        };

        if (variant === "back") {
          return (
            <div key={i} style={{ ...slotStyle, zIndex: i }}>
              <img
                src="/cardbacks/cardback.webp"
                alt="Card back"
                draggable={false}
                className="aspect-5/7 w-full rounded-[4.75%/3.43%] shadow-md ring-1 ring-black/30 dark:ring-white/12"
              />
            </div>
          );
        }

        const id = ids[i];
        const card = resolve?.(id) ?? { dto: null, faceDown: false };
        return (
          <div key={id} style={slotStyle} className="hover:z-50">
            <HandCard
              id={id}
              card={card}
              side={side}
              onPlay={onPlay}
              onPlayToZone={onPlayToZone}
              onContext={onContext}
              previewHandlers={
                card.dto ? preview.previewHandlers(card.dto) : undefined
              }
              onHidePreview={preview.hide}
            />
          </div>
        );
      })}

      {variant === "face" && (
        <CardPreview
          card={preview.state.card}
          anchorRect={preview.state.anchorRect}
        />
      )}
    </div>
  );
}

const DRAG_THRESHOLD_PX = 8;

interface DragGhost {
  x: number;
  y: number;
  w: number;
  h: number;
}

function HandCard({
  id,
  card,
  side,
  onPlay,
  onPlayToZone,
  onContext,
  previewHandlers,
  onHidePreview,
}: {
  id: string;
  card: ResolvedCard;
  side: "top" | "bottom";
  onPlay?: (instanceId: string) => void;
  onPlayToZone?: (instanceId: string, zone: BattlefieldZone) => void;
  onContext?: (instanceId: string, x: number, y: number) => void;
  previewHandlers?: {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => void;
    onMouseLeave: () => void;
    onTouchStart: (e: React.TouchEvent<HTMLElement>) => void;
    onTouchEnd: () => void;
    onTouchCancel: () => void;
  };
  onHidePreview: () => void;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);
  // The in-flight card rendered in a body-level portal so it is NOT clipped by
  // the battlefield halves' `overflow-hidden` when dragged up into a lane.
  const [ghost, setGhost] = useState<DragGhost | null>(null);
  const liftY = side === "bottom" ? "-14%" : "14%";
  const label = card.dto?.name ? `Play ${card.dto.name}` : "Play card";

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // Left mouse button / touch / pen only — let right-click open the menu.
    if (e.pointerType === "mouse" && e.button !== 0) return;
    ref.current?.setPointerCapture(e.pointerId);
    startRef.current = { x: e.clientX, y: e.clientY };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const start = startRef.current;
    if (!start) return;
    if (!draggingRef.current) {
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < DRAG_THRESHOLD_PX)
        return;
      draggingRef.current = true;
      onHidePreview();
      const rect = ref.current?.getBoundingClientRect();
      setGhost({
        x: e.clientX,
        y: e.clientY,
        w: rect?.width ?? 0,
        h: rect?.height ?? 0,
      });
    } else {
      setGhost((g) => (g ? { ...g, x: e.clientX, y: e.clientY } : g));
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const wasDragging = draggingRef.current;
    draggingRef.current = false;
    startRef.current = null;
    setGhost(null);
    ref.current?.releasePointerCapture?.(e.pointerId);
    if (wasDragging) {
      const zone = findDropZone(e.clientX, e.clientY);
      if (zone) onPlayToZone?.(id, zone);
    } else {
      onPlay?.(id); // a tap/click with no drag plays to the default lane
    }
  }

  return (
    <>
      <motion.div
        ref={ref}
        whileHover={reduced || ghost ? undefined : { y: liftY, scale: 1.12 }}
        role="button"
        tabIndex={0}
        aria-label={label}
        style={{ touchAction: "none", opacity: ghost ? 0.4 : 1 }}
        className="focus-visible:ring-primary/60 w-full cursor-grab outline-none focus-visible:ring-2 active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onPlay?.(id);
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          onContext?.(id, e.clientX, e.clientY);
        }}
        onMouseEnter={previewHandlers?.onMouseEnter}
        onMouseLeave={previewHandlers?.onMouseLeave}
        onTouchStart={previewHandlers?.onTouchStart}
        onTouchEnd={previewHandlers?.onTouchEnd}
        onTouchCancel={previewHandlers?.onTouchCancel}
      >
        <BoardCard card={card} />
      </motion.div>

      {ghost &&
        createPortal(
          <div
            aria-hidden
            style={{
              position: "fixed",
              left: ghost.x - ghost.w / 2,
              top: ghost.y - ghost.h / 2,
              width: ghost.w,
              height: ghost.h,
              pointerEvents: "none",
              zIndex: 9999,
            }}
            className="scale-105 drop-shadow-xl"
          >
            <BoardCard card={card} />
          </div>,
          document.body,
        )}
    </>
  );
}
