import { create } from "zustand";
import type { PlayerBoardView, PlayStatus } from "@/lib/game/play";
import type { CardListItemDto } from "@/lib/api/card-dto";

export interface PlayLobbyPlayer {
  uid: string;
  displayName: string;
  seatIndex: number;
  teamId: number;
  isReady: boolean;
  hasDeck: boolean;
}

export interface PlayLobbyState {
  sessionId: string;
  shortCode: string;
  status: PlayStatus;
  formatLabel: string;
  lifeMode: "per-player" | "shared-team";
  startingLife: number;
  playerCount: number;
  hostUid: string;
  players: PlayLobbyPlayer[];
}

export interface RevealEvent {
  by: number;
  instanceId: string;
  cardObjectId: string;
  scryfallId: string;
}

export interface PlayStoreState {
  socketConnected: boolean;
  status: PlayStatus | "idle";
  lobby: PlayLobbyState | null;
  board: PlayerBoardView | null;
  /** cardObjectId → card dto (populated via /api/cards/batch). */
  cardCache: Map<string, CardListItemDto>;
  lastReveal: RevealEvent | null;

  setSocketConnected: (v: boolean) => void;
  applyLobby: (s: PlayLobbyState) => void;
  applyBoard: (view: PlayerBoardView) => void;
  /** Optimistic local reposition of a battlefield card (server reconciles). */
  optimisticMove: (instanceId: string, x: number, y: number) => void;
  setReveal: (r: RevealEvent | null) => void;
  cacheCards: (cards: Record<string, CardListItemDto>) => void;
  reset: () => void;
}

const initial: Pick<
  PlayStoreState,
  "socketConnected" | "status" | "lobby" | "board" | "cardCache" | "lastReveal"
> = {
  socketConnected: false,
  status: "idle",
  lobby: null,
  board: null,
  cardCache: new Map(),
  lastReveal: null,
};

export const usePlayStore = create<PlayStoreState>((set) => ({
  ...initial,

  setSocketConnected: (v) => set({ socketConnected: v }),

  applyLobby: (s) =>
    set((prev) => ({
      lobby: s,
      // Don't downgrade away from an active board if a stale lobby arrives.
      status: prev.status === "playing" && s.status === "lobby" ? prev.status : s.status,
    })),

  applyBoard: (view) =>
    set((prev) => {
      // Server is authoritative: only accept a non-stale version.
      if (prev.board && view.version < prev.board.version) return prev;
      return { board: view, status: view.status };
    }),

  optimisticMove: (instanceId, x, y) =>
    set((prev) => {
      if (!prev.board) return prev;
      return {
        board: {
          ...prev.board,
          battlefield: prev.board.battlefield.map((b) =>
            b.instanceId === instanceId ? { ...b, x, y } : b,
          ),
        },
      };
    }),

  setReveal: (r) => set({ lastReveal: r }),

  cacheCards: (cards) =>
    set((s) => {
      const next = new Map(s.cardCache);
      for (const [id, card] of Object.entries(cards)) next.set(id, card);
      return { cardCache: next };
    }),

  reset: () => set({ ...initial, cardCache: new Map() }),
}));
