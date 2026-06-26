"use client";

import { useEffect } from "react";
import type { Socket } from "socket.io-client";
import { connectSocket, getSocket } from "@/hooks/use-socket";
import {
  clearPersistedSessionId,
  getPersistedSessionId,
  usePlayStore,
} from "@/store/play-store";
import type { PlayerBoardView } from "@/lib/game/play";
import type { PlayLobbyState, RevealEvent } from "@/store/play-store";
import type { ArrowEvent } from "@/lib/play/arrow";

/**
 * Connects to the shared singleton socket and wires the `play:*` / `playlobby:*`
 * events into the play store. Reuses `getSocket()` from the draft hook (the
 * singleton already carries the Firebase token); the two hooks listen to
 * disjoint event names so they coexist on one connection.
 */
export function usePlaySocketConnection(): Socket {
  useEffect(() => {
    // The connection (auth, reconnection, lifecycle) is owned centrally; this
    // hook only adds the play-specific listeners.
    const socket = connectSocket();

    const store = () => usePlayStore.getState();

    /** Re-bind this (possibly new) socket to its session: re-joins the room,
     *  refreshes the seat→socket map, and pulls a fresh board/lobby snapshot.
     *  Runs on every (re)connect and after a reload, which is what makes the
     *  start-of-game and page-reload races recoverable. */
    function rejoin(sessionId: string | null | undefined) {
      if (!sessionId) return;
      socket.emit(
        "play:rejoin",
        { sessionId },
        (res: { ok: boolean; error?: string }) => {
          // Drop a stale pointer so we don't retry a dead session every connect.
          if (
            res &&
            !res.ok &&
            (res.error === "session_not_found" || res.error === "not_in_session")
          ) {
            clearPersistedSessionId();
          }
        },
      );
    }

    function onConnect() {
      store().setSocketConnected(true);
      rejoin(store().lobby?.sessionId ?? getPersistedSessionId());
    }
    function onDisconnect() {
      store().setSocketConnected(false);
    }
    function onLobby(data: PlayLobbyState) {
      store().applyLobby(data);
    }
    function onBoard(view: PlayerBoardView) {
      store().applyBoard(view);
    }
    function onStarted() {
      // The host started the game — pull our board view immediately rather than
      // relying solely on the per-socket broadcast (which a stale socket misses).
      rejoin(store().lobby?.sessionId ?? getPersistedSessionId());
    }
    function onEnded() {
      clearPersistedSessionId();
    }
    function onReveal(r: RevealEvent) {
      store().setReveal(r);
    }
    function onArrow(a: ArrowEvent) {
      store().setArrow(a);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("playlobby:state", onLobby);
    socket.on("play:board", onBoard);
    socket.on("play:started", onStarted);
    socket.on("play:ended", onEnded);
    socket.on("play:reveal", onReveal);
    socket.on("play:arrow", onArrow);

    // If the socket is already connected when this effect runs (e.g. navigating
    // back to the page), reflect it and rejoin now — `connect` won't refire.
    if (socket.connected) {
      store().setSocketConnected(true);
      rejoin(store().lobby?.sessionId ?? getPersistedSessionId());
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("playlobby:state", onLobby);
      socket.off("play:board", onBoard);
      socket.off("play:started", onStarted);
      socket.off("play:ended", onEnded);
      socket.off("play:reveal", onReveal);
      socket.off("play:arrow", onArrow);
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
    const timer = setTimeout(
      () => reject(new Error("socket_timeout")),
      timeoutMs,
    );
    socket.emit(event, payload, (res: T) => {
      clearTimeout(timer);
      resolve(res);
    });
  });
}
