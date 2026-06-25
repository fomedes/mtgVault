"use client";

import { useEffect, useState } from "react";
import { usePlayStore } from "@/store/play-store";
import {
  ARROW_START_EVENT,
  type ArrowStartDetail,
  type ArrowTarget,
} from "@/lib/play/arrow";

const TTL_MS = 1300;

interface Point {
  x: number;
  y: number;
}

function centerOf(selector: string): Point | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function targetSelector(t: ArrowTarget): string {
  return t.kind === "card"
    ? `[data-card-id="${t.instanceId}"]`
    : `[data-seat-target="${t.seat}"]`;
}

/** Resolve what's under the pointer into a card or seat target. */
function findTargetAt(x: number, y: number): ArrowTarget | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const node = el as HTMLElement;
    const card = node.closest?.("[data-card-id]");
    if (card) {
      const id = card.getAttribute("data-card-id");
      if (id) return { kind: "card", instanceId: id };
    }
    const seatEl = node.closest?.("[data-seat-target]");
    if (seatEl) {
      const s = seatEl.getAttribute("data-seat-target");
      if (s !== null) return { kind: "seat", seat: Number(s) };
    }
  }
  return null;
}

interface DragState {
  source: string;
  from: Point;
  to: Point;
}

/**
 * Renders ephemeral targeting arrows: the local live-drag arrow (amber, follows
 * the pointer from an attack handle) and the most recent broadcast arrow (red,
 * fades after a short TTL). `fixed inset-0`, never intercepts pointer events.
 */
export function ArrowOverlay({
  onEmit,
}: {
  onEmit: (source: string, target: ArrowTarget) => void;
}) {
  const lastArrow = usePlayStore((s) => s.lastArrow);
  const setArrow = usePlayStore((s) => s.setArrow);
  const [drag, setDrag] = useState<DragState | null>(null);

  // Begin a live drag when an attack handle dispatches the start event.
  useEffect(() => {
    function onStart(e: Event) {
      const detail = (e as CustomEvent<ArrowStartDetail>).detail;
      const from = centerOf(`[data-card-id="${detail.sourceId}"]`) ?? {
        x: detail.x,
        y: detail.y,
      };
      setDrag({
        source: detail.sourceId,
        from,
        to: { x: detail.x, y: detail.y },
      });
    }
    window.addEventListener(ARROW_START_EVENT, onStart);
    return () => window.removeEventListener(ARROW_START_EVENT, onStart);
  }, []);

  // Track the pointer while dragging; resolve a target on release.
  useEffect(() => {
    if (!drag) return;
    const source = drag.source;
    function onMove(e: PointerEvent) {
      setDrag((d) => (d ? { ...d, to: { x: e.clientX, y: e.clientY } } : d));
    }
    function onUp(e: PointerEvent) {
      const target = findTargetAt(e.clientX, e.clientY);
      setDrag(null);
      if (target && !(target.kind === "card" && target.instanceId === source)) {
        onEmit(source, target);
      }
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, onEmit]);

  // Auto-clear broadcast arrows after the TTL.
  useEffect(() => {
    if (!lastArrow) return;
    const t = window.setTimeout(() => setArrow(null), TTL_MS);
    return () => window.clearTimeout(t);
  }, [lastArrow, setArrow]);

  const broadcast =
    lastArrow &&
    (() => {
      const from = centerOf(`[data-card-id="${lastArrow.source}"]`);
      const to = centerOf(targetSelector(lastArrow.target));
      return from && to ? { from, to } : null;
    })();

  if (!drag && !broadcast) return null;

  return (
    <svg
      className="pointer-events-none fixed inset-0 z-[60] h-full w-full"
      aria-hidden
    >
      <defs>
        <marker
          id="play-arrowhead"
          markerWidth="5"
          markerHeight="5"
          refX="3.5"
          refY="2.5"
          orient="auto"
        >
          <path d="M0,0 L5,2.5 L0,5 Z" fill="currentColor" />
        </marker>
      </defs>
      {broadcast && (
        <ArrowPath
          from={broadcast.from}
          to={broadcast.to}
          className="text-red-500"
        />
      )}
      {drag && (
        <ArrowPath from={drag.from} to={drag.to} className="text-amber-400" />
      )}
    </svg>
  );
}

function ArrowPath({
  from,
  to,
  className,
}: {
  from: Point;
  to: Point;
  className: string;
}) {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const bow = Math.min(len * 0.18, 70);
  const cx = mx + (-dy / len) * bow;
  const cy = my + (dx / len) * bow;
  const d = `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
  return (
    <path
      d={d}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={4}
      strokeLinecap="round"
      markerEnd="url(#play-arrowhead)"
      opacity={0.92}
    />
  );
}
