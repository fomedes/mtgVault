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

  return <PlayLobbyView myUid={myUid} decks={decks} />;
}
