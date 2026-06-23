"use client";

import { PlayLobbyView } from "@/components/play/play-lobby-view";
import { PlayBoard } from "@/components/play/play-board";
import { usePlaySocketConnection } from "@/hooks/use-play-socket";
import { usePlayStore } from "@/store/play-store";

export interface DeckOption {
  id: string;
  name: string;
  cardCount: number;
  colors: string[];
}

export function PlayPageClient({ myUid, decks }: { myUid: string; decks: DeckOption[] }) {
  // Establish the socket connection + event wiring for the whole page.
  usePlaySocketConnection();
  const status = usePlayStore((s) => s.status);

  if (status === "playing" || status === "ended") {
    return <PlayBoard myUid={myUid} />;
  }

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 flex flex-col gap-6 px-4 py-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Play</h1>
        <p className="text-muted-foreground text-sm">
          Create a virtual tabletop or join with a code, import a deck, and play a manual game —
          the board syncs; the rules are up to you.
        </p>
      </header>
      <PlayLobbyView myUid={myUid} decks={decks} />
    </div>
  );
}
