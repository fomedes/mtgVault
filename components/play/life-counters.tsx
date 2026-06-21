"use client";

import type { PlayerBoardView } from "@/lib/game/play";

/**
 * Per-seat or per-team life. In shared-team mode one counter is shown per team;
 * any seat may adjust any counter (manual play).
 */
export function LifeCounters({
  board,
  onAdjust,
}: {
  board: PlayerBoardView;
  onAdjust: (seat: number, delta: number) => void;
}) {
  if (board.lifeMode === "shared-team") {
    // One representative seat per team drives the shared total.
    const teams = new Map<number, number>();
    for (const s of board.seats) if (!teams.has(s.teamId)) teams.set(s.teamId, s.seat);
    return (
      <div className="flex flex-wrap gap-3">
        {[...teams.entries()].map(([teamId, seat]) => (
          <Counter
            key={teamId}
            label={`Team ${teamId + 1}`}
            value={board.teamLife[teamId] ?? 0}
            onDelta={(d) => onAdjust(seat, d)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      {board.seats.map((s) => (
        <Counter
          key={s.seat}
          label={s.displayName}
          value={s.life}
          highlight={s.seat === board.mySeat}
          onDelta={(d) => onAdjust(s.seat, d)}
        />
      ))}
    </div>
  );
}

function Counter({
  label,
  value,
  highlight,
  onDelta,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  onDelta: (delta: number) => void;
}) {
  return (
    <div
      className={`border-border bg-card flex items-center gap-2 rounded-lg border px-3 py-2 ${
        highlight ? "ring-primary/40 ring-2" : ""
      }`}
    >
      <button className="text-muted-foreground hover:text-foreground text-lg" onClick={() => onDelta(-1)}>
        −
      </button>
      <div className="text-center">
        <div data-testid="life-value" className="text-xl font-bold tabular-nums">
          {value}
        </div>
        <div className="text-muted-foreground max-w-20 truncate text-[10px]">{label}</div>
      </div>
      <button className="text-muted-foreground hover:text-foreground text-lg" onClick={() => onDelta(1)}>
        +
      </button>
    </div>
  );
}
