import { create } from "zustand";
import type { PlayerView, DraftStatus } from "@/lib/game/draft";
import type { CardListItemDto } from "@/lib/api/card-dto";

export interface DraftStoreState {
  // Connection
  socketConnected: boolean;

  // Session
  sessionId: string | null;
  shortCode: string | null;

  // Lobby
  lobbyPlayers: Array<{
    uid: string;
    displayName: string;
    seatIndex: number;
    isReady: boolean;
  }>;
  hostUid: string | null;

  // Draft in progress
  status: DraftStatus | "idle";
  currentPack: string[];  // card ObjectId strings
  myPicks: string[];
  round: number;
  pickInRound: number;
  needsPick: boolean;
  players: PlayerView["players"];
  timerExpiresAt: number | null; // ms timestamp

  // Card detail cache (cardObjectId → dto, populated by components)
  cardCache: Map<string, CardListItemDto>;

  // Actions
  setSocketConnected: (v: boolean) => void;
  applyLobbyState: (s: { sessionId: string; shortCode: string; players: DraftStoreState["lobbyPlayers"]; hostUid?: string }) => void;
  applyPlayerView: (view: PlayerView) => void;
  setTimerExpiresAt: (ts: number | null) => void;
  // keys are MongoDB ObjectId strings (matching pack/pick state IDs)
  cacheCards: (cards: Record<string, CardListItemDto>) => void;
  reset: () => void;
}

const initial: Omit<
  DraftStoreState,
  | "setSocketConnected"
  | "applyLobbyState"
  | "applyPlayerView"
  | "setTimerExpiresAt"
  | "cacheCards"
  | "reset"
> = {
  socketConnected: false,
  sessionId: null,
  shortCode: null,
  lobbyPlayers: [],
  hostUid: null,
  status: "idle",
  currentPack: [],
  myPicks: [],
  round: 0,
  pickInRound: 0,
  needsPick: false,
  players: [],
  timerExpiresAt: null,
  cardCache: new Map(),
};

export const useDraftStore = create<DraftStoreState>((set) => ({
  ...initial,

  setSocketConnected: (v) => set({ socketConnected: v }),

  applyLobbyState: (s) =>
    set({
      sessionId: s.sessionId,
      shortCode: s.shortCode,
      lobbyPlayers: s.players,
      hostUid: s.hostUid ?? null,
      status: "lobby",
    }),

  applyPlayerView: (view) =>
    set({
      currentPack: view.currentPack,
      myPicks: view.picks,
      round: view.round,
      pickInRound: view.pickInRound,
      status: view.status,
      needsPick: view.needsPick,
      players: view.players,
    }),

  setTimerExpiresAt: (ts) => set({ timerExpiresAt: ts }),

  cacheCards: (cards) =>
    set((s) => {
      const next = new Map(s.cardCache);
      for (const [id, card] of Object.entries(cards)) next.set(id, card);
      return { cardCache: next };
    }),

  reset: () => set({ ...initial, cardCache: new Map() }),
}));
