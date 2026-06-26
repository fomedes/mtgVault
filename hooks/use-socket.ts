"use client";

import { useEffect } from "react";
import { io, type Socket } from "socket.io-client";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { useDraftStore } from "@/store/draft-store";
import { useConnectionStore } from "@/store/connection-store";
import type { PlayerView } from "@/lib/game/draft";

let sharedSocket: Socket | null = null;
let wired = false;

/**
 * Resolve the Firebase ID token for a (re)connect attempt. socket.io calls this
 * before EVERY connection attempt, so a token that expired while the tab was
 * open is refreshed automatically (getIdToken() refreshes when near expiry)
 * instead of leaving the socket permanently stuck on a stale token.
 */
async function resolveAuth(
  cb: (data: Record<string, unknown>) => void,
): Promise<void> {
  try {
    const auth = getFirebaseAuth();
    await auth.authStateReady();
    const user = auth.currentUser;
    if (!user) return cb({});
    cb({ token: await user.getIdToken() });
  } catch {
    cb({});
  }
}

/** Map a raw connect_error into something a user can act on. */
function friendlyConnectError(err: Error): string {
  const msg = err?.message ?? "";
  if (msg === "unauthorized") {
    return "Your session isn't authorized (it may have expired). Retry, or sign in again.";
  }
  if (/xhr|websocket|timeout|transport|network|cors/i.test(msg)) {
    return "Can't reach the game server. Check your connection and retry.";
  }
  return msg || "Connection error";
}

export function getSocket(): Socket {
  if (!sharedSocket) {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000";
    sharedSocket = io(url, {
      autoConnect: false,
      withCredentials: true,
      // Auth as a function → fresh token on every (re)connect attempt.
      auth: (cb) => {
        void resolveAuth(cb);
      },
      reconnectionAttempts: 10,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      timeout: 10_000,
    });
  }
  return sharedSocket;
}

/** Attach connection-lifecycle listeners once; drive the shared connection store. */
function ensureWired(socket: Socket): void {
  if (wired) return;
  wired = true;
  const conn = () => useConnectionStore.getState();
  socket.on("connect", () => conn().set("connected"));
  socket.on("disconnect", (reason) => {
    // "io client disconnect" = we called disconnect() → idle; anything else is a
    // drop the manager will try to recover from → show as reconnecting.
    conn().set(reason === "io client disconnect" ? "idle" : "connecting");
  });
  socket.on("connect_error", (err: Error) =>
    conn().set("error", friendlyConnectError(err)),
  );
  socket.io.on("reconnect_attempt", () => conn().set("connecting"));
  socket.io.on("reconnect_failed", () =>
    conn().set("error", "Couldn't reconnect to the server."),
  );
}

/**
 * Idempotently bring up the shared socket. Safe to call from every hook/component
 * that needs the connection — only the first call actually dials.
 */
export function connectSocket(): Socket {
  const socket = getSocket();
  ensureWired(socket);
  if (!socket.connected && !socket.active) {
    useConnectionStore.getState().set("connecting");
    socket.connect();
  }
  return socket;
}

/** User-triggered retry after an error (Retry button). */
export function retryConnection(): void {
  const socket = getSocket();
  ensureWired(socket);
  if (socket.connected) {
    useConnectionStore.getState().set("connected");
    return;
  }
  useConnectionStore.getState().set("connecting");
  socket.connect();
}

/**
 * Connects to the socket server and wires the draft events to Zustand.
 * The connection itself (auth, reconnection, lifecycle) is owned by
 * connectSocket(); this hook only adds the draft-specific listeners.
 */
export function useSocketConnection(): Socket {
  useEffect(() => {
    const socket = connectSocket();

    const store = () => useDraftStore.getState();

    function onConnect() { store().setSocketConnected(true); }
    function onDisconnect() { store().setSocketConnected(false); }
    function onLobbyState(data: {
      sessionId: string;
      shortCode: string;
      setCode?: string;
      players: { uid: string; displayName: string; seatIndex: number; isReady: boolean }[];
    }) {
      store().applyLobbyState({
        sessionId: data.sessionId,
        shortCode: data.shortCode,
        setCode: data.setCode,
        players: data.players,
        hostUid: data.players?.[0]?.uid,
      });
    }
    function onPlayerView(view: PlayerView) { store().applyPlayerView(view); }
    function onTimer(d: { expiresAt: number }) { store().setTimerExpiresAt(d.expiresAt); }
    function onComplete() { store().setTimerExpiresAt(null); }

    // Reflect the live connection state immediately (the singleton may already
    // be connected from another mounted hook, so `connect` won't refire).
    if (socket.connected) store().setSocketConnected(true);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("lobby:state", onLobbyState);
    socket.on("draft:playerView", onPlayerView);
    socket.on("draft:timer", onTimer);
    socket.on("draft:complete", onComplete);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("lobby:state", onLobbyState);
      socket.off("draft:playerView", onPlayerView);
      socket.off("draft:timer", onTimer);
      socket.off("draft:complete", onComplete);
    };
  }, []);

  return getSocket();
}
