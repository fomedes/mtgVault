"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type HistoryKind = "all" | "multiplayer" | "phantom";

interface DraftSummary {
  sessionId: string;
  setCode: string;
  pickCount: number;
  completedAt: string;
  players: string[];
  kind: "multiplayer" | "phantom";
  difficulty?: string;
}

const FILTER_LABELS: { key: HistoryKind; label: string }[] = [
  { key: "all", label: "All" },
  { key: "multiplayer", label: "Multiplayer" },
  { key: "phantom", label: "Phantom" },
];

const KIND_BADGE: Record<string, string> = {
  multiplayer:
    "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  phantom:
    "bg-violet-500/15 text-violet-400 border border-violet-500/30",
};

const EMPTY_MESSAGES: Record<HistoryKind, string> = {
  all: "No drafts yet. Head to Draft to start one!",
  multiplayer: "No multiplayer drafts yet. Invite your friends!",
  phantom: "No phantom drafts yet. Try a solo draft!",
};

export function HistoryList() {
  const [filter, setFilter] = useState<HistoryKind>("all");
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    fetch(`/api/history?kind=${filter}`)
      .then((r) => r.json())
      .then((d: { drafts: DraftSummary[] }) => {
        setDrafts(d.drafts ?? []);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [filter]);

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-2">
        {FILTER_LABELS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              filter === key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="bg-muted h-20 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : drafts.length === 0 ? (
        <p className="text-muted-foreground py-16 text-center text-sm">
          {EMPTY_MESSAGES[filter]}
        </p>
      ) : (
        <div className="space-y-3">
          {drafts.map((d) => (
            <Link
              key={d.sessionId}
              href={`/history/${d.sessionId}`}
              className="bg-card hover:bg-muted/60 block rounded-lg border p-4 transition-colors"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold uppercase tracking-wide text-sm">
                      {d.setCode}
                    </p>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-xs font-medium",
                        KIND_BADGE[d.kind] ?? KIND_BADGE.multiplayer,
                      )}
                    >
                      {d.kind === "phantom" ? "Phantom" : "Multiplayer"}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {d.pickCount} cards ·{" "}
                    {new Date(d.completedAt).toLocaleDateString()}
                    {d.kind === "phantom" && d.difficulty && (
                      <> · {d.difficulty.charAt(0).toUpperCase() + d.difficulty.slice(1)} bots</>
                    )}
                  </p>
                </div>
                {d.kind === "multiplayer" && d.players.length > 0 && (
                  <p className="text-muted-foreground text-xs text-right max-w-32 truncate shrink-0">
                    {d.players.join(", ")}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
