"use client";

import { useEffect } from "react";
import { io, type Socket } from "socket.io-client";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { useDraftStore } from "@/store/draft-store";
import { useConnectionStore } from "@/store/connection-store";
import type { PlayerView } from "@/lib/game/draft";

let sharedSocket: Socket | null = null;
let wired = false;
/** Set after an "unauthorized" rejection so the next attempt forces a fresh token. */
let forceRefreshNext = false;

/**
 * Resolve the current Firebase ID token, or null if no user is signed in.
 * `getIdToken()` transparently refreshes a token that's expired or near expiry,
 * so reconnecting after the tab idled past the token lifetime just works.
 */
async function getSignedInToken(forceRefresh = false): Promise<string | null> {
  try {
    const auth = getFirebaseAuth();
    await auth.authStateReady();
    const user = auth.currentUser;
    if (!user) return null;
    return await user.getIdToken(forceRefresh);
  } catch {
    return null;
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
        const force = forceRefreshNext;
        forceRefreshNext = false;
        void getSignedInToken(force).then((token) =>
          cb(token ? { token } : {}),
        );
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
  socket.on("connect_error", (err: Error) => {
    // An auth rejection is usually a stale token — force a refresh next attempt.
    if (err?.message === "unauthorized") forceRefreshNext = true;
    conn().set("error", friendlyConnectError(err));
  });
  socket.io.on("reconnect_attempt", () => conn().set("connecting"));
  socket.io.on("reconnect_failed", () =>
    conn().set("error", "Couldn't reconnect to the server."),
  );
}

/**
 * Idempotently bring up the shared socket. Safe to call from every hook/component
 * that needs the connection — only the first call actually dials. We confirm a
 * signed-in user BEFORE dialing so we never hand the server an empty token (which
 * it would reject as "unauthorized"); if signed out we surface that instead.
 */
export function connectSocket(): Socket {
  const socket = getSocket();
  ensureWired(socket);
  if (socket.connected || socket.active) return socket;

  useConnectionStore.getState().set("connecting");
  void (async () => {
    const token = await getSignedInToken();
    if (!token) {
      useConnectionStore
        .getState()
        .set("error", "You appear to be signed out. Sign in again to play.");
      return;
    }
    if (!socket.connected && !socket.active) socket.connect();
  })();
  return socket;
}

/** User-triggered retry after an error (Retry button) — forces a fresh token. */
export function retryConnection(): void {
  const socket = getSocket();
  ensureWired(socket);
  if (socket.connected) {
    useConnectionStore.getState().set("connected");
    return;
  }
  forceRefreshNext = true;
  useConnectionStore.getState().set("connecting");
  void (async () => {
    const token = await getSignedInToken(true);
    if (!token) {
      useConnectionStore
        .getState()
        .set("error", "You appear to be signed out. Sign in again to play.");
      return;
    }
    socket.connect();
  })();
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
