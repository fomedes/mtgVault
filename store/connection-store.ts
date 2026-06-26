import { create } from "zustand";

/** Lifecycle of the single shared Socket.io connection (draft + play). */
export type ConnectionStatus = "idle" | "connecting" | "connected" | "error";

interface ConnectionStore {
  status: ConnectionStatus;
  /** Human-readable reason, set only when status === "error". */
  error: string | null;
  set: (status: ConnectionStatus, error?: string | null) => void;
}

/**
 * Single source of truth for the shared socket's connection state, driven by the
 * lifecycle listeners in hooks/use-socket.ts and read by the connection-status UI.
 */
export const useConnectionStore = create<ConnectionStore>((set) => ({
  status: "idle",
  error: null,
  set: (status, error = null) =>
    set({ status, error: status === "error" ? error : null }),
}));
