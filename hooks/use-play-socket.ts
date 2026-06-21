"use client";

import { useEffect } from "react";
import type { Socket } from "socket.io-client";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { getSocket } from "@/hooks/use-socket";
import { usePlayStore } from "@/store/play-store";
import type { PlayerBoardView } from "@/lib/game/play";
import type { PlayLobbyState, RevealEvent } from "@/store/play-store";

/**
 * Connects to the shared singleton socket and wires the `play:*` / `playlobby:*`
 * events into the play store. Reuses `getSocket()` from the draft hook (the
 * singleton already carries the Firebase token); the two hooks listen to
 * disjoint event names so they coexist on one connection.
 */
export function usePlaySocketConnection(): Socket {
  useEffect(() => {
    const socket = getSocket();

    async function connect() {
      if (socket.connected) return;
      const auth = getFirebaseAuth();
      await auth.authStateReady();
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      socket.auth = { token };
      socket.connect();
    }
    void connect();

    const store = () => usePlayStore.getState();

    function onConnect() { store().setSocketConnected(true); }
    function onDisconnect() { store().setSocketConnected(false); }
    function onLobby(data: PlayLobbyState) { store().applyLobby(data); }
    function onBoard(view: PlayerBoardView) { store().applyBoard(view); }
    function onReveal(r: RevealEvent) { store().setReveal(r); }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("playlobby:state", onLobby);
    socket.on("play:board", onBoard);
    socket.on("play:reveal", onReveal);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("playlobby:state", onLobby);
      socket.off("play:board", onBoard);
      socket.off("play:reveal", onReveal);
    };
  }, []);

  return getSocket();
}

const SOCKET_TIMEOUT_MS = 8_000;

/** Wraps socket.emit with a timeout so UI never hangs (mirrors lobby-view). */
export function emitWithTimeout<T>(
  socket: Socket,
  event: string,
  payload: unknown,
  timeoutMs: number = SOCKET_TIMEOUT_MS,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("socket_timeout")), timeoutMs);
    socket.emit(event, payload, (res: T) => {
      clearTimeout(timer);
      resolve(res);
    });
  });
}
