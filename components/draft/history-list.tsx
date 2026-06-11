"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface DraftSummary {
  sessionId: string;
  setCode: string;
  pickCount: number;
  completedAt: string;
  players: string[];
}

export function HistoryList() {
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/history")
      .then((r) => r.json())
      .then((d: { drafts: DraftSummary[] }) => {
        setDrafts(d.drafts ?? []);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="bg-muted h-20 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (drafts.length === 0) {
    return (
      <p className="text-muted-foreground py-16 text-center text-sm">
        No drafts yet. Head to Draft to start one!
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {drafts.map((d) => (
        <Link
          key={d.sessionId}
          href={`/history/${d.sessionId}`}
          className="bg-card hover:bg-muted/60 block rounded-lg border p-4 transition-colors"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold uppercase tracking-wide text-sm">
                {d.setCode}
              </p>
              <p className="text-muted-foreground text-xs">
                {d.pickCount} cards · {new Date(d.completedAt).toLocaleDateString()}
              </p>
            </div>
            <p className="text-muted-foreground text-xs text-right max-w-32 truncate">
              {d.players.join(", ")}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
