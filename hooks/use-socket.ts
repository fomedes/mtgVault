"use client";

import { useEffect } from "react";
import { io, type Socket } from "socket.io-client";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { useDraftStore } from "@/store/draft-store";
import type { PlayerView } from "@/lib/game/draft";

let sharedSocket: Socket | null = null;

export function getSocket(): Socket {
  if (!sharedSocket) {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000";
    sharedSocket = io(url, { autoConnect: false, withCredentials: true });
  }
  return sharedSocket;
}

/**
 * Connects to the socket server and wires events to Zustand.
 * The socket reference is acquired inside the effect (not in component scope)
 * so the React Compiler does not flag the auth-property assignment as a
 * "local variable mutation after render".
 */
export function useSocketConnection(): Socket {
  useEffect(() => {
    const socket = getSocket();

    async function connect() {
      if (socket.connected) return;
      const auth = getFirebaseAuth();
      // authStateReady() waits until Firebase has restored the session from
      // IndexedDB. Without this, currentUser is null at mount time even when
      // the user IS logged in, so the socket never connects.
      await auth.authStateReady();
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      socket.auth = { token };
      socket.connect();
    }
    void connect();

    const store = () => useDraftStore.getState();

    function onConnect() { store().setSocketConnected(true); }
    function onDisconnect() { store().setSocketConnected(false); }
    function onLobbyState(data: {
      sessionId: string;
      shortCode: string;
      players: { uid: string; displayName: string; seatIndex: number; isReady: boolean }[];
    }) {
      store().applyLobbyState({
        sessionId: data.sessionId,
        shortCode: data.shortCode,
        players: data.players,
        hostUid: data.players?.[0]?.uid,
      });
    }
    function onPlayerView(view: PlayerView) { store().applyPlayerView(view); }
    function onTimer(d: { expiresAt: number }) { store().setTimerExpiresAt(d.expiresAt); }
    function onComplete() { store().setTimerExpiresAt(null); }

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
