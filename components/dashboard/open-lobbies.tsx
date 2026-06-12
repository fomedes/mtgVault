import Link from "next/link";
import type { OpenLobby } from "@/lib/game/dashboard";

export function OpenLobbies({ lobbies }: { lobbies: OpenLobby[] }) {
  if (lobbies.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 text-base font-semibold">Open Lobbies</h2>
      <ul className="space-y-2">
        {lobbies.map((lobby) => (
          <li
            key={lobby.sessionId}
            className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">{lobby.setName}</p>
              <p className="text-muted-foreground text-xs">
                {lobby.playerCount} player{lobby.playerCount !== 1 ? "s" : ""} · #{lobby.shortCode}
              </p>
            </div>
            <Link
              href={`/draft?code=${lobby.shortCode}`}
              className="shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {lobby.isMember ? "Rejoin" : "Join"}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
