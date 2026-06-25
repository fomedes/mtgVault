"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PlayStage } from "@/components/play/play-stage";
import { LifeCounters } from "@/components/play/life-counters";
import { TurnPhaseBar } from "@/components/play/turn-phase-bar";
import { LogPanel } from "@/components/play/log-panel";
import {
  CardContextMenu,
  type ContextMenuState,
} from "@/components/play/card-context-menu";
import type { ResolvedCard } from "@/components/play/board-card";
import { ImmersiveStage } from "@/components/play/immersive-stage";
import { OrientationGuard } from "@/components/play/orientation-guard";
import { ArrowOverlay } from "@/components/play/arrow-overlay";
import { usePlaySocketConnection } from "@/hooks/use-play-socket";
import { usePlayStore } from "@/store/play-store";
import type { BoardAction, Zone, BattlefieldZone } from "@/lib/game/play";
import { getDefaultZone } from "@/lib/game/zone-routing";

export function PlayBoard({ myUid }: { myUid: string }) {
  const router = useRouter();
  const socket = usePlaySocketConnection();
  const board = usePlayStore((s) => s.board);
  const cardCache = usePlayStore((s) => s.cardCache);
  const cacheCards = usePlayStore((s) => s.cacheCards);
  const optimisticReorder = usePlayStore((s) => s.optimisticReorder);
  const optimisticSetZone = usePlayStore((s) => s.optimisticSetZone);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [logOpen, setLogOpen] = useState(false);

  // Fetch card details for any cardObjectId not yet cached.
  useEffect(() => {
    if (!board) return;
    const needed = new Set<string>();
    for (const inst of Object.values(board.cards)) {
      if (
        !cardCache.has(inst.cardObjectId) &&
        /^[0-9a-fA-F]{24}$/.test(inst.cardObjectId)
      ) {
        needed.add(inst.cardObjectId);
      }
    }
    if (needed.size === 0) return;
    const ids = [...needed].slice(0, 60).join(",");
    fetch(`/api/cards/batch?ids=${encodeURIComponent(ids)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          d: {
            cards: Record<string, Parameters<typeof cacheCards>[0][string]>;
          } | null,
        ) => {
          if (d?.cards) cacheCards(d.cards);
        },
      )
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

  // Play a hand card to its type-appropriate lane (creatures/lands/other).
  function playFromHand(instanceId: string, faceDown = false) {
    if (!board) return;
    const inst = board.cards[instanceId];
    const typeLine = inst
      ? (cardCache.get(inst.cardObjectId)?.typeLine ?? "")
      : "";
    emit({
      type: "MOVE_CARD",
      instanceId,
      target: { kind: "battlefield", zone: getDefaultZone(typeLine), faceDown },
    });
  }

  return (
    <ImmersiveStage>
      <OrientationGuard>
        <div
          className="flex h-full flex-col overflow-hidden"
          data-testid="play-board"
        >
          {/* Top bar: life + turn + host controls */}
          <div className="border-border flex-shrink-0 border-b px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <LifeCounters
                board={board}
                onAdjust={(seat, delta) =>
                  emit({ type: "ADJUST_LIFE", seat, delta })
                }
              />
              <div className="flex flex-wrap items-center gap-2">
                <TurnPhaseBar
                  phase={board.phase}
                  activeSeat={board.activeSeat}
                  mySeat={mySeat}
                  activeName={
                    board.activeSeat === null
                      ? null
                      : (board.seats[board.activeSeat]?.displayName ?? null)
                  }
                  onSetPhase={(phase) => emit({ type: "SET_PHASE", phase })}
                  onPassTurn={() => emit({ type: "PASS_TURN" })}
                  onUntapAll={() => emit({ type: "UNTAP_ALL" })}
                  onTakeTurn={() =>
                    emit({ type: "SET_ACTIVE_SEAT", seat: mySeat })
                  }
                />
                {isHost && board.status === "playing" && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() =>
                      socket.emit("play:end", { sessionId }, () => undefined)
                    }
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
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => router.push("/dashboard")}
                >
                  Leave
                </Button>
              </div>
            </div>

            {board.status === "ended" && (
              <div className="mt-2 rounded border border-amber-500/40 bg-amber-500/10 p-2 text-sm">
                The game has ended.
              </div>
            )}
          </div>

          {/* Main board area — full-bleed stage + optional log drawer */}
          <div className="relative flex min-h-0 flex-1 overflow-hidden">
            <div className="min-h-0 flex-1">
              <PlayStage
                board={board}
                resolve={resolve}
                onReorder={(zone, newOrder) => {
                  optimisticReorder(zone, newOrder);
                  emit({ type: "REORDER_ZONE", zone, newOrder });
                }}
                onOpenMenu={(instanceId, x, y) =>
                  setMenu({
                    instanceId,
                    onBattlefield: true,
                    inHand: false,
                    tapped: false,
                    faceDown: false,
                    x,
                    y,
                  })
                }
                onPlayFromHand={playFromHand}
                onPlayToZone={(instanceId, zone) =>
                  emit({
                    type: "MOVE_CARD",
                    instanceId,
                    target: { kind: "battlefield", zone },
                  })
                }
                onDraw={() => emit({ type: "DRAW", count: 1 })}
                onMill={() => emit({ type: "MILL", count: 1 })}
                onShuffle={() => emit({ type: "SHUFFLE" })}
                onHandContext={(instanceId, x, y) =>
                  setMenu({
                    instanceId,
                    onBattlefield: false,
                    inHand: true,
                    tapped: false,
                    faceDown: false,
                    x,
                    y,
                  })
                }
              />
            </div>

            {logOpen && (
              <div className="border-border bg-background/95 w-80 flex-shrink-0 overflow-y-auto border-l p-4">
                <LogPanel log={board.log} />
              </div>
            )}
          </div>

          <ArrowOverlay
            onEmit={(source, target) =>
              socket.emit("play:arrow", { sessionId, source, target })
            }
          />

          {menu && (
            <CardContextMenu
              menu={menu}
              onClose={() => setMenu(null)}
              actions={{
                onTap: (instanceId, tapped) =>
                  emit({ type: "TAP", instanceId, tapped }),
                onFlip: (instanceId, faceDown) =>
                  emit({ type: "FLIP", instanceId, faceDown }),
                onFlipUpsideDown: (instanceId, upsideDown) =>
                  emit({ type: "FLIP_UPSIDE_DOWN", instanceId, upsideDown }),
                onTransform: (instanceId) => {
                  const bf = board.battlefield.find(
                    (b) => b.instanceId === instanceId,
                  );
                  emit({
                    type: "TRANSFORM",
                    instanceId,
                    flipped: !bf?.flipped,
                  });
                },
                onAdjustCounter: (instanceId, key, delta) =>
                  emit({ type: "ADJUST_COUNTER", instanceId, key, delta }),
                onMoveToZone: (instanceId, zone: Zone) =>
                  emit({
                    type: "MOVE_CARD",
                    instanceId,
                    target: {
                      kind: "zone",
                      zone,
                      toSeat: ownerOf(instanceId),
                      position: "top",
                    },
                  }),
                onMoveToBattlefieldZone: (
                  instanceId,
                  zone: BattlefieldZone,
                ) => {
                  optimisticSetZone(instanceId, zone);
                  emit({ type: "SET_ZONE", instanceId, zone });
                },
                onPlay: (instanceId) => playFromHand(instanceId),
                onPlayFaceDown: (instanceId) => playFromHand(instanceId, true),
                onReveal: (instanceId) => emit({ type: "REVEAL", instanceId }),
              }}
            />
          )}
        </div>
      </OrientationGuard>
    </ImmersiveStage>
  );
}
