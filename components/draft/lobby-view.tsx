"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useSocketConnection } from "@/hooks/use-socket";
import { useDraftStore } from "@/store/draft-store";
import { cn } from "@/lib/utils";

const TIMER_OPTIONS = [
  { label: "30 s", value: 30_000 },
  { label: "60 s", value: 60_000 },
  { label: "90 s", value: 90_000 },
];

const PACK_OPTIONS = [
  { label: "1 pack (15 picks)", value: 1 },
  { label: "2 packs (30 picks)", value: 2 },
  { label: "3 packs (45 picks)", value: 3 },
  { label: "4 packs (60 picks)", value: 4 },
  { label: "5 packs (75 picks)", value: 5 },
];

const SOCKET_TIMEOUT_MS = 8_000;

/** Wraps socket.emit with a timeout so the button never gets stuck if the
 *  server is unreachable or the socket is not yet connected. */
function emitWithTimeout<T>(
  socket: ReturnType<typeof useSocketConnection>,
  event: string,
  payload: unknown,
  timeoutMs: number,
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

export function LobbyView({
  myUid,
  availableSets,
}: {
  myUid: string;
  availableSets: { code: string; name: string }[];
}) {
  const socket = useSocketConnection();
  const socketConnected = useDraftStore((s) => s.socketConnected);
  const { sessionId, shortCode, lobbyPlayers, hostUid, status } =
    useDraftStore();

  const [mode, setMode] = useState<"pick" | "create" | "join">("pick");
  const [setCode, setSetCode] = useState(availableSets[0]?.code ?? "");
  const [timerMs, setTimerMs] = useState(60_000);
  const [numPacks, setNumPacks] = useState(3);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isHost = hostUid === myUid;
  const amInLobby = status === "lobby" && !!sessionId;
  const canStart = isHost && lobbyPlayers.length >= 2;

  async function handleCreate() {
    if (!socketConnected) {
      setError("Not connected to the draft server. Make sure pnpm dev:socket is running and NEXT_PUBLIC_SOCKET_URL is set.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await emitWithTimeout<{ ok: boolean; error?: string }>(
        socket,
        "lobby:create",
        { setCode, timerMs, numPacks },
        SOCKET_TIMEOUT_MS,
      );
      if (!res.ok) setError(res.error ?? "Failed to create lobby");
    } catch {
      setError("Could not reach the draft server. Is it running?");
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    if (!joinCode.trim()) return;
    if (!socketConnected) {
      setError("Not connected to the draft server.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await emitWithTimeout<{ ok: boolean; error?: string }>(
        socket,
        "lobby:join",
        { shortCode: joinCode.trim().toUpperCase() },
        SOCKET_TIMEOUT_MS,
      );
      if (!res.ok) setError(res.error ?? "Lobby not found");
    } catch {
      setError("Could not reach the draft server. Is it running?");
    } finally {
      setBusy(false);
    }
  }

  function handleStart() {
    if (!sessionId) return;
    socket.emit(
      "lobby:start",
      { sessionId },
      (res: { ok: boolean; error?: string }) => {
        if (!res.ok) setError(res.error ?? "Could not start draft");
      },
    );
  }

  function handleLeave() {
    if (!sessionId) return;
    socket.emit("lobby:leave", { sessionId });
    useDraftStore.getState().reset();
    setMode("pick");
  }

  // ── Connection status banner ──────────────────────────────────────────────

  const connectionBanner = !socketConnected ? (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-400">
      Connecting to draft server…{" "}
      <span className="text-muted-foreground text-xs">
        (run <code className="font-mono">pnpm dev:socket</code> locally)
      </span>
    </div>
  ) : null;

  // ── In lobby ──────────────────────────────────────────────────────────────
  if (amInLobby) {
    return (
      <div className="space-y-6">
        {connectionBanner}

        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Lobby</h2>
            <p className="text-muted-foreground text-sm">
              Code:{" "}
              <button
                className="font-mono font-bold tracking-widest hover:text-foreground transition-colors"
                onClick={() => navigator.clipboard.writeText(shortCode ?? "")}
                title="Click to copy"
              >
                {shortCode}
              </button>
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleLeave}>
            Leave
          </Button>
        </div>

        <div className="space-y-2">
          {lobbyPlayers.map((p) => (
            <div
              key={p.uid}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-4 py-3",
                p.uid === myUid && "border-primary/40",
              )}
            >
              <span className="flex-1 font-medium">
                {p.displayName}
                {p.uid === myUid ? " (you)" : ""}
                {p.uid === hostUid ? " 👑" : ""}
              </span>
            </div>
          ))}
        </div>

        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        {isHost ? (
          <Button disabled={!canStart || busy} onClick={handleStart} className="w-full">
            {lobbyPlayers.length < 2 ? "Waiting for players…" : "Start draft"}
          </Button>
        ) : (
          <p className="text-muted-foreground text-sm text-center">
            Waiting for the host to start…
          </p>
        )}
      </div>
    );
  }

  // ── Pre-lobby: pick mode ──────────────────────────────────────────────────
  if (mode === "pick") {
    return (
      <div className="flex flex-col gap-6">
        {connectionBanner}
        <div className="flex flex-col gap-4 items-center py-8">
          <h2 className="text-lg font-semibold">Ready to draft?</h2>
          <div className="flex gap-3">
            <Button onClick={() => setMode("create")}>Create lobby</Button>
            <Button variant="outline" onClick={() => setMode("join")}>
              Join lobby
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Create form ──────────────────────────────────────────────────────────
  if (mode === "create") {
    return (
      <div className="space-y-4 max-w-sm">
        <h2 className="text-lg font-semibold">Create lobby</h2>

        {connectionBanner}

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="setCode">Set</label>
          <select
            id="setCode"
            value={setCode}
            onChange={(e) => setSetCode(e.target.value)}
            className="border-input bg-background h-9 w-full rounded-lg border px-2 text-sm"
          >
            {availableSets.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name} ({s.code.toUpperCase()})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Pick timer</label>
          <div className="flex gap-2">
            {TIMER_OPTIONS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTimerMs(t.value)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm transition-colors",
                  timerMs === t.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="numPacks">Boosters per player</label>
          <select
            id="numPacks"
            value={numPacks}
            onChange={(e) => setNumPacks(Number(e.target.value))}
            className="border-input bg-background h-9 w-full rounded-lg border px-2 text-sm"
          >
            {PACK_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        <div className="flex gap-2">
          <Button onClick={handleCreate} disabled={busy || !setCode || !socketConnected}>
            {busy ? "Creating…" : "Create"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setMode("pick");
              setError(null);
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // ── Join form ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 max-w-sm">
      <h2 className="text-lg font-semibold">Join lobby</h2>

      {connectionBanner}

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="code">Lobby code</label>
        <input
          id="code"
          type="text"
          maxLength={6}
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          placeholder="ABC123"
          className="border-input bg-background h-9 w-full rounded-lg border px-3 font-mono text-sm uppercase tracking-widest"
        />
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <div className="flex gap-2">
        <Button
          onClick={handleJoin}
          disabled={busy || joinCode.length !== 6 || !socketConnected}
        >
          {busy ? "Joining…" : "Join"}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setMode("pick");
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
