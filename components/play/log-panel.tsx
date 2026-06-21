"use client";

import { useEffect, useRef } from "react";
import type { LogEntry } from "@/lib/game/play";

/** Opponent-safe game log (server never writes hidden card names here). */
export function LogPanel({ log }: { log: LogEntry[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [log.length]);

  return (
    <div className="border-border bg-card flex h-full max-h-64 flex-col rounded-lg border p-3">
      <h3 className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wide">Log</h3>
      <div className="flex-1 space-y-1 overflow-y-auto text-xs">
        {log.map((e) => (
          <p key={e.seq} className="text-muted-foreground">
            {e.text}
          </p>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
