import Link from "next/link";
import type { SoloDraftSummary } from "@/lib/game/solo-draft";

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export function PracticeHistory({ sessions }: { sessions: SoloDraftSummary[] }) {
  if (sessions.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No practice drafts yet. Start one above!
      </p>
    );
  }

  return (
    <ul className="divide-y rounded-lg border">
      {sessions.map((s) => (
        <li key={s.sessionId} className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="space-y-0.5">
            <p className="text-sm font-medium uppercase">
              {s.setCode}
              <span className="text-muted-foreground font-normal ml-2">
                {DIFFICULTY_LABEL[s.difficulty] ?? s.difficulty}
              </span>
            </p>
            <p className="text-muted-foreground text-xs">
              {s.status === "complete" ? `${s.pickCount} picks` : "In progress"} ·{" "}
              {new Date(s.createdAt).toLocaleDateString()}
            </p>
          </div>
          <Link
            href={`/solo-draft/${s.sessionId}`}
            className="text-xs text-primary hover:underline shrink-0"
          >
            {s.status === "complete" ? "View" : "Resume"}
          </Link>
        </li>
      ))}
    </ul>
  );
}
