"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { BattlefieldLayer } from "@/components/play/battlefield-layer";
import { HandFan } from "@/components/play/hand-fan";
import { ZoneRow } from "@/components/play/zone-row";
import { LifeCounters } from "@/components/play/life-counters";
import { LogPanel } from "@/components/play/log-panel";
import { CardContextMenu, type ContextMenuState } from "@/components/play/card-context-menu";
import type { ResolvedCard } from "@/components/play/board-card";
import { PlayerBand } from "@/components/play/player-band";
import { usePlaySocketConnection } from "@/hooks/use-play-socket";
import { usePlayStore } from "@/store/play-store";
import type { BoardAction, Zone } from "@/lib/game/play";

export function PlayBoard({ myUid }: { myUid: string }) {
  const socket = usePlaySocketConnection();
  const board = usePlayStore((s) => s.board);
  const cardCache = usePlayStore((s) => s.cardCache);
  const cacheCards = usePlayStore((s) => s.cacheCards);
  const optimisticMove = usePlayStore((s) => s.optimisticMove);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [logOpen, setLogOpen] = useState(false);

  // Fetch card details for any cardObjectId not yet cached.
  useEffect(() => {
    if (!board) return;
    const needed = new Set<string>();
    for (const inst of Object.values(board.cards)) {
      if (!cardCache.has(inst.cardObjectId) && /^[0-9a-fA-F]{24}$/.test(inst.cardObjectId)) {
        needed.add(inst.cardObjectId);
      }
    }
    if (needed.size === 0) return;
    const ids = [...needed].slice(0, 60).join(",");
    fetch(`/api/cards/batch?ids=${encodeURIComponent(ids)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { cards: Record<string, Parameters<typeof cacheCards>[0][string]> } | null) => {
        if (d?.cards) cacheCards(d.cards);
      })
      .catch(() => undefined);
  }, [board, cardCache, cacheCards]);

  const sessionId = board?.sessionId ?? "";
  const isHost = useMemo(
    () => board?.seats.find((s) => s.seat === board.mySeat)?.uid === myUid,
    [board, myUid],
  );

  function emit(action: BoardAction) {
    socket.emit("play:action", { sessionId, action }, () => undefined);
  }

  function resolve(instanceId: string): ResolvedCard {
    if (!board) return { dto: null, faceDown: true };
    const inst = board.cards[instanceId];
    if (!inst) return { dto: null, faceDown: true };
    return { dto: cardCache.get(inst.cardObjectId) ?? null, faceDown: false };
  }

  function ownerOf(instanceId: string): number {
    return board?.cards[instanceId]?.ownerSeat ?? board?.mySeat ?? 0;
  }

  if (!board) return null;

  const mySeat = board.mySeat;
  const opponents = board.seats.filter((s) => s.seat !== mySeat);
  const mySeatView = board.seats.find((s) => s.seat === mySeat);

  return (
    <div className="flex h-screen flex-col overflow-hidden" data-testid="play-board">
      {/* Top bar: life + turn + host controls */}
      <div className="flex-shrink-0 border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <LifeCounters board={board} onAdjust={(seat, delta) => emit({ type: "ADJUST_LIFE", seat, delta })} />
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">
              Active: {board.activeSeat === null ? "—" : board.seats[board.activeSeat]?.displayName}
            </span>
            <Button size="sm" variant="secondary" onClick={() => emit({ type: "SET_ACTIVE_SEAT", seat: mySeat })}>
              My turn
            </Button>
            <Button size="sm" variant="ghost" onClick={() => emit({ type: "UNTAP_ALL" })}>
              Untap all
            </Button>
            {isHost && board.status === "playing" && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => socket.emit("play:end", { sessionId }, () => undefined)}
              >
                End game
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setLogOpen(!logOpen)}
            >
              {logOpen ? "Hide" : "Show"} Log
            </Button>
          </div>
        </div>

        {board.status === "ended" && (
          <div className="mt-2 rounded border border-amber-500/40 bg-amber-500/10 p-2 text-sm">
            The game has ended.
          </div>
        )}
      </div>

      {/* Main board area */}
      <div className="flex flex-1 overflow-hidden gap-4 px-4 py-4">
        {/* Board content */}
        <div className="flex-1 flex flex-col overflow-y-auto space-y-3">
          {/* Opponents' bands */}
          {opponents.map((s) => (
            <PlayerBand key={s.seat} seat={s.seat} isMe={false}>
              <ZoneRow
                seat={s}
                isMe={false}
                resolve={resolve}
                onDraw={() => undefined}
                onMill={() => undefined}
                onShuffle={() => undefined}
              />
            </PlayerBand>
          ))}

          {/* Combat line divider */}
          <div className="flex items-center gap-2 py-2">
            <div className="flex-1 h-px bg-border" />
            <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">Combat Line</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Battlefield */}
          <BattlefieldLayer
            battlefield={board.battlefield}
            resolve={resolve}
            onMove={(instanceId, x, y) => {
              optimisticMove(instanceId, x, y);
              emit({ type: "MOVE_ON_BATTLEFIELD", instanceId, x, y });
            }}
            onOpenMenu={setMenu}
          />

          {/* My band */}
          <PlayerBand seat={mySeat} isMe>
            <div className="space-y-3">
              {mySeatView && (
                <ZoneRow
                  seat={mySeatView}
                  isMe
                  resolve={resolve}
                  onDraw={() => emit({ type: "DRAW", count: 1 })}
                  onMill={() => emit({ type: "MILL", count: 1 })}
                  onShuffle={() => emit({ type: "SHUFFLE" })}
                />
              )}
              <HandFan
                hand={board.myHand}
                resolve={resolve}
                onPlay={(instanceId) =>
                  emit({ type: "MOVE_CARD", instanceId, target: { kind: "battlefield", x: 0.5, y: 0.6 } })
                }
                onContext={(instanceId, x, y) =>
                  setMenu({ instanceId, onBattlefield: false, tapped: false, faceDown: false, x, y })
                }
              />
            </div>
          </PlayerBand>
        </div>

        {/* Collapsible log panel */}
        {logOpen && (
          <div className="flex-shrink-0 w-80 overflow-y-auto border-l border-border pl-4">
            <LogPanel log={board.log} />
          </div>
        )}
      </div>

      {menu && (
        <CardContextMenu
          menu={menu}
          onClose={() => setMenu(null)}
          actions={{
            onTap: (instanceId, tapped) => emit({ type: "TAP", instanceId, tapped }),
            onFlip: (instanceId, faceDown) => emit({ type: "FLIP", instanceId, faceDown }),
            onTransform: (instanceId) => {
              const bf = board.battlefield.find((b) => b.instanceId === instanceId);
              emit({ type: "TRANSFORM", instanceId, flipped: !bf?.flipped });
            },
            onAdjustCounter: (instanceId, key, delta) => emit({ type: "ADJUST_COUNTER", instanceId, key, delta }),
            onMoveToZone: (instanceId, zone: Zone) =>
              emit({
                type: "MOVE_CARD",
                instanceId,
                target: { kind: "zone", zone, toSeat: ownerOf(instanceId), position: "top" },
              }),
            onReveal: (instanceId) => emit({ type: "REVEAL", instanceId }),
          }}
        />
      )}
    </div>
  );
}
