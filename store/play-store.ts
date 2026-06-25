import { create } from "zustand";
import type {
  PlayerBoardView,
  PlayStatus,
  BattlefieldZone,
} from "@/lib/game/play";
import type { CardListItemDto } from "@/lib/api/card-dto";
import type { ArrowEvent } from "@/lib/play/arrow";

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

// ── Session persistence (survives reload so the client can auto-rejoin) ──────
const PLAY_SESSION_KEY = "mtgvault:play:session";

export function getPersistedSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(PLAY_SESSION_KEY);
  } catch {
    return null;
  }
}

function persistSessionId(sessionId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PLAY_SESSION_KEY, sessionId);
  } catch {
    /* ignore quota/availability errors */
  }
}

export function clearPersistedSessionId(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PLAY_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export interface PlayStoreState {
  socketConnected: boolean;
  status: PlayStatus | "idle";
  lobby: PlayLobbyState | null;
  board: PlayerBoardView | null;
  /** cardObjectId → card dto (populated via /api/cards/batch). */
  cardCache: Map<string, CardListItemDto>;
  lastReveal: RevealEvent | null;
  /** Most recent ephemeral targeting arrow (cleared after its TTL). */
  lastArrow: ArrowEvent | null;

  setSocketConnected: (v: boolean) => void;
  applyLobby: (s: PlayLobbyState) => void;
  applyBoard: (view: PlayerBoardView) => void;
  /** Optimistic local reorder of cards within a zone (server reconciles). */
  optimisticReorder: (zone: BattlefieldZone, newOrder: string[]) => void;
  /** Optimistic local zone assignment (server reconciles). */
  optimisticSetZone: (instanceId: string, zone: BattlefieldZone) => void;
  setReveal: (r: RevealEvent | null) => void;
  setArrow: (a: ArrowEvent | null) => void;
  cacheCards: (cards: Record<string, CardListItemDto>) => void;
  reset: () => void;
}

const initial: Pick<
  PlayStoreState,
  | "socketConnected"
  | "status"
  | "lobby"
  | "board"
  | "cardCache"
  | "lastReveal"
  | "lastArrow"
> = {
  socketConnected: false,
  status: "idle",
  lobby: null,
  board: null,
  cardCache: new Map(),
  lastReveal: null,
  lastArrow: null,
};

export const usePlayStore = create<PlayStoreState>((set) => ({
  ...initial,

  setSocketConnected: (v) => set({ socketConnected: v }),

  applyLobby: (s) => {
    // Remember the session so a reload can auto-rejoin it.
    if (s.status === "ended") clearPersistedSessionId();
    else persistSessionId(s.sessionId);
    set((prev) => ({
      lobby: s,
      // Don't downgrade away from an active board if a stale lobby arrives.
      status:
        prev.status === "playing" && s.status === "lobby"
          ? prev.status
          : s.status,
    }));
  },

  applyBoard: (view) =>
    set((prev) => {
      // Server is authoritative: only accept a non-stale version.
      if (prev.board && view.version < prev.board.version) return prev;
      if (view.status === "ended") clearPersistedSessionId();
      else persistSessionId(view.sessionId);
      return { board: view, status: view.status };
    }),

  optimisticReorder: (zone, newOrder) =>
    set((prev) => {
      if (!prev.board) return prev;
      const orderMap = new Map<string, number>();
      newOrder.forEach((id, idx) => orderMap.set(id, idx));
      return {
        board: {
          ...prev.board,
          battlefield: prev.board.battlefield.map((b) =>
            b.zone === zone && orderMap.has(b.instanceId)
              ? { ...b, order: orderMap.get(b.instanceId)! }
              : b,
          ),
        },
      };
    }),

  optimisticSetZone: (instanceId, zone) =>
    set((prev) => {
      if (!prev.board) return prev;
      return {
        board: {
          ...prev.board,
          battlefield: prev.board.battlefield.map((b) =>
            b.instanceId === instanceId ? { ...b, zone } : b,
          ),
        },
      };
    }),

  setReveal: (r) => set({ lastReveal: r }),

  setArrow: (a) => set({ lastArrow: a }),

  cacheCards: (cards) =>
    set((s) => {
      const next = new Map(s.cardCache);
      for (const [id, card] of Object.entries(cards)) next.set(id, card);
      return { cardCache: next };
    }),

  reset: () => {
    clearPersistedSessionId();
    set({ ...initial, cardCache: new Map() });
  },
}));
