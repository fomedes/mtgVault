"use client";

import { useEffect, useRef } from "react";
import type { Zone } from "@/lib/game/play";

export interface ContextMenuState {
  instanceId: string;
  /** Where the card currently is, so we offer relevant actions. */
  onBattlefield: boolean;
  tapped: boolean;
  faceDown: boolean;
  /** Screen coordinates for the menu. */
  x: number;
  y: number;
}

export interface CardMenuActions {
  onTap: (instanceId: string, tapped: boolean) => void;
  onFlip: (instanceId: string, faceDown: boolean) => void;
  onTransform: (instanceId: string) => void;
  onAdjustCounter: (instanceId: string, key: string, delta: number) => void;
  onMoveToZone: (instanceId: string, zone: Zone) => void;
  onReveal: (instanceId: string) => void;
}

const ZONE_LABELS: { zone: Zone; label: string }[] = [
  { zone: "hand", label: "Hand" },
  { zone: "graveyard", label: "Graveyard" },
  { zone: "exile", label: "Exile" },
  { zone: "library", label: "Library (top)" },
  { zone: "command", label: "Command" },
];

export function CardContextMenu({
  menu,
  actions,
  onClose,
}: {
  menu: ContextMenuState;
  actions: CardMenuActions;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);

  const item = "block w-full px-3 py-1.5 text-left text-sm hover:bg-accent rounded";

  return (
    <div
      ref={ref}
      style={{ left: menu.x, top: menu.y }}
      className="border-border bg-popover fixed z-50 w-44 rounded-md border p-1 shadow-lg"
      role="menu"
    >
      {menu.onBattlefield && (
        <>
          <button className={item} onClick={() => { actions.onTap(menu.instanceId, !menu.tapped); onClose(); }}>
            {menu.tapped ? "Untap" : "Tap"}
          </button>
          <button className={item} onClick={() => { actions.onFlip(menu.instanceId, !menu.faceDown); onClose(); }}>
            {menu.faceDown ? "Turn face up" : "Turn face down"}
          </button>
          <button className={item} onClick={() => { actions.onTransform(menu.instanceId); onClose(); }}>
            Transform / flip
          </button>
          <div className="flex items-center justify-between px-3 py-1.5 text-sm">
            <span>+1/+1</span>
            <span className="flex gap-1">
              <button className="border-border rounded border px-1.5" onClick={() => actions.onAdjustCounter(menu.instanceId, "+1/+1", -1)}>
                −
              </button>
              <button className="border-border rounded border px-1.5" onClick={() => actions.onAdjustCounter(menu.instanceId, "+1/+1", 1)}>
                +
              </button>
            </span>
          </div>
          <hr className="border-border my-1" />
        </>
      )}
      <button className={item} onClick={() => { actions.onReveal(menu.instanceId); onClose(); }}>
        Reveal
      </button>
      <hr className="border-border my-1" />
      <p className="text-muted-foreground px-3 py-1 text-xs">Move to…</p>
      {ZONE_LABELS.map(({ zone, label }) => (
        <button key={zone} className={item} onClick={() => { actions.onMoveToZone(menu.instanceId, zone); onClose(); }}>
          {label}
        </button>
      ))}
    </div>
  );
}
