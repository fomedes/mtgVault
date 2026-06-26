"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConnectionStatus } from "@/components/connection-status";
import { emitWithTimeout, usePlaySocketConnection } from "@/hooks/use-play-socket";
import { usePlayStore } from "@/store/play-store";
import type { DeckOption } from "@/components/play/play-page-client";
import { cn } from "@/lib/utils";

/** Mirrors PlaySummary returned by the `playlobby:list` socket handler. */
interface PlaySummary {
  sessionId: string;
  shortCode: string;
  formatLabel: string;
  status: "lobby" | "playing" | "ended";
  playerCount: number;
  seatedCount: number;
  hostName: string;
  playerNames: string[];
}

interface PlayListResult {
  ok: boolean;
  myGames?: PlaySummary[];
  openTables?: PlaySummary[];
  error?: string;
}

const LIFE_PRESETS = [20, 25, 30, 40];

export function PlayLobbyView({ myUid, decks }: { myUid: string; decks: DeckOption[] }) {
  const socket = usePlaySocketConnection();
  const lobby = usePlayStore((s) => s.lobby);
  const connected = usePlayStore((s) => s.socketConnected);

  if (lobby && lobby.status === "lobby") {
    return <LobbyRoom myUid={myUid} decks={decks} />;
  }

  return <LobbyEntry socket={socket} connected={connected} />;
}

// ─── Create / join screen ─────────────────────────────────────────────────────

function LobbyEntry({
  socket,
  connected,
}: {
  socket: ReturnType<typeof usePlaySocketConnection>;
  connected: boolean;
}) {
  const [formatLabel, setFormatLabel] = useState("Casual");
  const [playerCount, setPlayerCount] = useState(2);
  const [lifeMode, setLifeMode] = useState<"per-player" | "shared-team">("per-player");
  const [startingLife, setStartingLife] = useState(20);
  const [shortCode, setShortCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [myGames, setMyGames] = useState<PlaySummary[]>([]);
  const [openTables, setOpenTables] = useState<PlaySummary[]>([]);
  const [listLoading, setListLoading] = useState(false);

  // Promise-chain (not async/await) so the setState lives inside a `.then`
  // callback — safe to invoke from an effect (cf. components/history/history-list.tsx).
  const refreshList = useCallback((): Promise<void> => {
    if (!connected) return Promise.resolve();
    return emitWithTimeout<PlayListResult>(socket, "playlobby:list", {})
      .then((res) => {
        if (res.ok) {
          setMyGames(res.myGames ?? []);
          setOpenTables(res.openTables ?? []);
        }
      })
      .catch(() => {
        /* leave the last good list in place */
      });
  }, [socket, connected]);

  // Manual refresh (button) — fine to flip the spinner synchronously here since
  // it runs in an event handler, not an effect.
  const manualRefresh = useCallback(() => {
    setListLoading(true);
    void refreshList().finally(() => setListLoading(false));
  }, [refreshList]);

  // Load (and refresh on (re)connect) the rejoin + friends'-tables lists.
  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  async function rejoin(sessionId: string) {
    setError(null);
    try {
      const res = await emitWithTimeout<{ ok: boolean; error?: string }>(
        socket,
        "play:rejoin",
        { sessionId },
      );
      if (!res.ok) setError(res.error ?? "Could not rejoin");
    } catch {
      setError("Server unreachable");
    }
  }

  async function joinByCode(code: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await emitWithTimeout<{ ok: boolean; error?: string }>(
        socket,
        "playlobby:join",
        { shortCode: code.trim().toUpperCase() },
      );
      if (!res.ok) setError(res.error ?? "Failed to join");
    } catch {
      setError("Server unreachable");
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await emitWithTimeout<{ ok: boolean; error?: string }>(socket, "playlobby:create", {
        formatLabel,
        playerCount,
        lifeMode,
        startingLife,
      });
      if (!res.ok) setError(res.error ?? "Failed to create lobby");
    } catch {
      setError("Server unreachable");
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    await joinByCode(shortCode);
  }

  return (
    <div className="space-y-8">
    <ConnectionStatus />
    <div className="grid gap-6 md:grid-cols-2">
      <section className="border-border bg-card rounded-lg border p-5">
        <h2 className="mb-4 text-lg font-semibold">Create a table</h2>
        <div className="space-y-4">
          <Field label="Format label">
            <input
              value={formatLabel}
              onChange={(e) => setFormatLabel(e.target.value)}
              maxLength={40}
              className="input"
            />
          </Field>
          <Field label="Players">
            <div className="flex gap-2">
              {[2, 3, 4].map((n) => (
                <Chip key={n} active={playerCount === n} onClick={() => setPlayerCount(n)}>
                  {n}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label="Life mode">
            <div className="flex gap-2">
              <Chip active={lifeMode === "per-player"} onClick={() => setLifeMode("per-player")}>
                Per player
              </Chip>
              <Chip
                active={lifeMode === "shared-team"}
                onClick={() => setLifeMode("shared-team")}
                disabled={playerCount !== 4}
                title={playerCount !== 4 ? "Team mode needs 4 players" : undefined}
              >
                Shared team (2v2)
              </Chip>
            </div>
          </Field>
          <Field label="Starting life">
            <div className="flex gap-2">
              {LIFE_PRESETS.map((n) => (
                <Chip key={n} active={startingLife === n} onClick={() => setStartingLife(n)}>
                  {n}
                </Chip>
              ))}
            </div>
          </Field>
          <Button onClick={create} disabled={busy || !connected} className="w-full">
            Create table
          </Button>
        </div>
      </section>

      <section className="border-border bg-card rounded-lg border p-5">
        <h2 className="mb-4 text-lg font-semibold">Join a table</h2>
        <Field label="Short code">
          <input
            data-testid="play-join-code"
            value={shortCode}
            onChange={(e) => setShortCode(e.target.value)}
            placeholder="ABC123"
            maxLength={12}
            className="input font-mono uppercase tracking-widest"
          />
        </Field>
        <Button
          onClick={join}
          disabled={busy || !connected || shortCode.trim().length < 4}
          variant="secondary"
          className="mt-4 w-full"
        >
          Join
        </Button>
        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      </section>
    </div>

      <PlayLists
        myGames={myGames}
        openTables={openTables}
        loading={listLoading}
        busy={busy}
        connected={connected}
        onRefresh={manualRefresh}
        onRejoin={rejoin}
        onJoin={joinByCode}
      />
    </div>
  );
}

// ─── Rejoin + friends'-tables lists ───────────────────────────────────────────

function PlayLists({
  myGames,
  openTables,
  loading,
  busy,
  connected,
  onRefresh,
  onRejoin,
  onJoin,
}: {
  myGames: PlaySummary[];
  openTables: PlaySummary[];
  loading: boolean;
  busy: boolean;
  connected: boolean;
  onRefresh: () => void;
  onRejoin: (sessionId: string) => void;
  onJoin: (shortCode: string) => void;
}) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="border-border bg-card rounded-lg border p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Your games</h2>
          <Button
            onClick={onRefresh}
            disabled={!connected || loading}
            variant="ghost"
            size="sm"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
        {myGames.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No games in progress. Create or join a table to get started.
          </p>
        ) : (
          <ul className="space-y-2">
            {myGames.map((g) => (
              <li
                key={g.sessionId}
                className="border-border flex items-center justify-between gap-3 rounded-md border p-3"
              >
                <TableMeta summary={g} />
                <Button onClick={() => onRejoin(g.sessionId)} disabled={!connected} size="sm">
                  Rejoin
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-border bg-card rounded-lg border p-5">
        <h2 className="mb-3 text-lg font-semibold">Friends&apos; open tables</h2>
        {openTables.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No friends have an open table right now.
          </p>
        ) : (
          <ul className="space-y-2">
            {openTables.map((g) => (
              <li
                key={g.sessionId}
                className="border-border flex items-center justify-between gap-3 rounded-md border p-3"
              >
                <TableMeta summary={g} />
                <Button
                  onClick={() => onJoin(g.shortCode)}
                  disabled={!connected || busy}
                  variant="secondary"
                  size="sm"
                >
                  Join
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function TableMeta({ summary }: { summary: PlaySummary }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-medium">
        {summary.hostName}
        <span className="text-muted-foreground"> · {summary.formatLabel}</span>
      </p>
      <p className="text-muted-foreground text-xs">
        <span className="font-mono tracking-widest">{summary.shortCode}</span> ·{" "}
        {summary.status === "playing" ? "in progress" : "in lobby"} ·{" "}
        {summary.seatedCount}/{summary.playerCount}
      </p>
    </div>
  );
}

// ─── In-lobby room ────────────────────────────────────────────────────────────

function LobbyRoom({ myUid, decks }: { myUid: string; decks: DeckOption[] }) {
  const socket = usePlaySocketConnection();
  const lobby = usePlayStore((s) => s.lobby)!;
  const me = lobby.players.find((p) => p.uid === myUid);
  const isHost = lobby.hostUid === myUid;

  const [deckId, setDeckId] = useState("");
  const [paste, setPaste] = useState("");
  const [unknown, setUnknown] = useState<string[]>([]);
  const [deckMsg, setDeckMsg] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  async function setDeckFromSaved() {
    if (!deckId) return;
    setDeckMsg(null);
    setUnknown([]);
    const res = await emitWithTimeout<{ ok: boolean; error?: string; unknownCards?: string[] }>(
      socket,
      "playlobby:set-deck",
      { sessionId: lobby.sessionId, source: { kind: "deck", deckId } },
    );
    setDeckMsg(res.ok ? "Deck ready ✓" : res.error ?? "Failed");
  }

  async function setDeckFromPaste() {
    if (!paste.trim()) return;
    setDeckMsg(null);
    setUnknown([]);
    const res = await emitWithTimeout<{ ok: boolean; error?: string; unknownCards?: string[] }>(
      socket,
      "playlobby:set-deck",
      { sessionId: lobby.sessionId, source: { kind: "decklist", text: paste } },
    );
    setUnknown(res.unknownCards ?? []);
    setDeckMsg(res.ok ? "Deck ready ✓" : res.error ?? "Failed");
  }

  function toggleReady() {
    socket.emit("playlobby:ready", { sessionId: lobby.sessionId, ready: !me?.isReady });
  }

  async function start() {
    setStartError(null);
    const res = await emitWithTimeout<{ ok: boolean; error?: string }>(socket, "playlobby:start", {
      sessionId: lobby.sessionId,
    });
    if (!res.ok) setStartError(res.error ?? "Cannot start yet");
  }

  function leave() {
    socket.emit("playlobby:leave", { sessionId: lobby.sessionId });
    usePlayStore.getState().reset();
  }

  const allReady = lobby.players.length >= 2 && lobby.players.every((p) => p.isReady && p.hasDeck);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="space-y-5">
        <div className="border-border bg-card flex items-center justify-between rounded-lg border p-4">
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Short code</p>
            <p data-testid="play-short-code" className="font-mono text-2xl font-bold tracking-widest">
              {lobby.shortCode}
            </p>
          </div>
          <div className="text-right text-sm">
            <p>{lobby.formatLabel}</p>
            <p className="text-muted-foreground">
              {lobby.lifeMode === "shared-team" ? "2v2 shared life" : "Per-player"} · {lobby.startingLife} life
            </p>
          </div>
        </div>

        <div className="border-border bg-card rounded-lg border p-4">
          <h3 className="mb-3 font-semibold">Choose your deck</h3>
          <div className="space-y-3">
            <div className="flex gap-2">
              <select
                value={deckId}
                onChange={(e) => setDeckId(e.target.value)}
                className="input flex-1"
              >
                <option value="">Saved deck…</option>
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.cardCount})
                  </option>
                ))}
              </select>
              <Button onClick={setDeckFromSaved} disabled={!deckId} variant="secondary">
                Use
              </Button>
            </div>
            <div>
              <textarea
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                placeholder={"Or paste a decklist…\n4 Lightning Bolt\n1 Brainstorm (STA) 13"}
                rows={5}
                className="input w-full font-mono text-xs"
              />
              <Button onClick={setDeckFromPaste} disabled={!paste.trim()} variant="secondary" className="mt-2">
                Import pasted list
              </Button>
            </div>
            {deckMsg && <p className="text-sm">{deckMsg}</p>}
            {unknown.length > 0 && (
              <p className="text-sm text-amber-500">
                Unmatched: {unknown.slice(0, 10).join(", ")}
                {unknown.length > 10 ? `, +${unknown.length - 10} more` : ""}
              </p>
            )}
          </div>
        </div>
      </section>

      <aside className="border-border bg-card h-fit space-y-4 rounded-lg border p-4">
        <h3 className="font-semibold">Players ({lobby.players.length}/{lobby.playerCount})</h3>
        <ul className="space-y-2">
          {lobby.players.map((p) => (
            <li key={p.uid} className="flex items-center justify-between text-sm">
              <span className="truncate">
                {p.displayName}
                {p.uid === lobby.hostUid && <span className="text-muted-foreground"> (host)</span>}
                {lobby.lifeMode === "shared-team" && (
                  <span className="text-muted-foreground"> · Team {p.teamId + 1}</span>
                )}
              </span>
              <span className="flex items-center gap-2 text-xs">
                <span className={p.hasDeck ? "text-emerald-500" : "text-muted-foreground"}>deck</span>
                <span className={p.isReady ? "text-emerald-500" : "text-muted-foreground"}>
                  {p.isReady ? "ready" : "waiting"}
                </span>
              </span>
            </li>
          ))}
        </ul>

        <div className="space-y-2 pt-2">
          <Button onClick={toggleReady} className="w-full" variant={me?.isReady ? "secondary" : "default"}>
            {me?.isReady ? "Unready" : "Ready up"}
          </Button>
          {isHost && (
            <Button onClick={start} disabled={!allReady} className="w-full">
              Start game
            </Button>
          )}
          <Button onClick={leave} variant="ghost" className="w-full">
            Leave
          </Button>
          {startError && <p className="text-sm text-red-500">{startError}</p>}
        </div>
      </aside>
    </div>
  );
}

// ─── Tiny presentational helpers ──────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{label}</span>
      {children}
    </label>
  );
}

function Chip({
  active,
  onClick,
  disabled,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "rounded-md border px-3 py-1.5 text-sm transition",
        active ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      {children}
    </button>
  );
}
