"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PHASES, PHASE_LABELS, nextPhase, type Phase } from "@/lib/game/phases";

interface TurnPhaseBarProps {
  phase: Phase;
  activeSeat: number | null;
  mySeat: number;
  activeName: string | null;
  onSetPhase: (phase: Phase) => void;
  onPassTurn: () => void;
  onUntapAll: () => void;
  onTakeTurn: () => void;
}

/**
 * Advisory turn tracker. The active seat can jump phases, advance, or pass the
 * turn; everyone else sees the shared phase read-only and can claim the turn.
 * The engine enforces nothing — this only keeps players in sync.
 */
export function TurnPhaseBar({
  phase,
  activeSeat,
  mySeat,
  activeName,
  onSetPhase,
  onPassTurn,
  onUntapAll,
  onTakeTurn,
}: TurnPhaseBarProps) {
  const isMyTurn = activeSeat === mySeat;

  return (
    <div className="flex items-center gap-2">
      <div className="border-border bg-card/60 flex items-center rounded-md border p-0.5">
        {PHASES.map((p) => {
          const active = p === phase;
          return (
            <button
              key={p}
              type="button"
              disabled={!isMyTurn}
              aria-pressed={active}
              onClick={() => onSetPhase(p)}
              className={cn(
                "rounded px-2 py-1 text-[0.7rem] font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
                !isMyTurn && "cursor-not-allowed opacity-70",
              )}
            >
              {PHASE_LABELS[p]}
            </button>
          );
        })}
      </div>

      {isMyTurn ? (
        <>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onSetPhase(nextPhase(phase))}
          >
            Next
          </Button>
          <Button size="sm" onClick={onPassTurn}>
            Pass turn
          </Button>
        </>
      ) : (
        <Button size="sm" variant="secondary" onClick={onTakeTurn}>
          Take turn{activeName ? ` · ${activeName}'s` : ""}
        </Button>
      )}

      <Button size="sm" variant="ghost" onClick={onUntapAll}>
        Untap all
      </Button>
    </div>
  );
}
