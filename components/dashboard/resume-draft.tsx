import Link from "next/link";
import type { InProgressDraft } from "@/lib/game/dashboard";

export function ResumeDraft({ drafts }: { drafts: InProgressDraft[] }) {
  if (drafts.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 text-base font-semibold">Resume a Draft</h2>
      <ul className="space-y-2">
        {drafts.map((draft) => (
          <li
            key={`${draft.kind}-${draft.id}`}
            className="bg-card flex items-center justify-between gap-3 rounded-lg border px-4 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{draft.setName}</p>
              <p className="text-muted-foreground text-xs">
                {draft.kind === "phantom" ? "Phantom draft" : "Multiplayer draft"} · in progress
              </p>
            </div>
            <Link
              href={draft.href}
              className="hover:bg-muted focus-visible:ring-ring shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2"
            >
              Resume
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
