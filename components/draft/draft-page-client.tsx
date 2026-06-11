"use client";

import { DraftRoom } from "@/components/draft/draft-room";
import { LobbyView } from "@/components/draft/lobby-view";
import { useDraftStore } from "@/store/draft-store";

export function DraftPageClient({
  myUid,
  availableSets,
}: {
  myUid: string;
  availableSets: { code: string; name: string }[];
}) {
  const status = useDraftStore((s) => s.status);

  if (status === "drafting" || status === "complete") {
    return <DraftRoom myUid={myUid} />;
  }

  return <LobbyView myUid={myUid} availableSets={availableSets} />;
}
