import { connectToDatabase } from "@/lib/db";
import { Transaction } from "@/lib/models/Transaction";
import { Achievement } from "@/lib/models/Achievement";
import { SavedDeck } from "@/lib/models/SavedDeck";
import { Notification } from "@/lib/models/Notification";
import { DraftSession } from "@/lib/models/DraftSession";
import { CardSet } from "@/lib/models/CardSet";
import { getCollectionStats } from "@/lib/game/collection";
import { ACHIEVEMENT_DEFS } from "@/lib/game/achievements";

export interface FeedEvent {
  type: "transaction" | "achievement" | "draft_complete";
  date: string;
  label: string;
  detail?: string;
}

export interface PendingInvite {
  id: string;
  fromDisplayName: string;
  shortCode: string;
  sessionId: string;
  createdAt: string;
}

export interface OpenLobby {
  sessionId: string;
  shortCode: string;
  setCode: string;
  setName: string;
  playerCount: number;
  isMember: boolean;
  createdAt: string;
}

export interface Recommendation {
  setCode: string;
  setName: string;
  boosterPrice: number;
}

export interface DashboardData {
  stats: {
    uniqueCards: number;
    totalCards: number;
    draftsPlayed: number;
    vaultCoins: number;
  };
  feed: FeedEvent[];
  pendingInvites: PendingInvite[];
  openLobbies: OpenLobby[];
  recommendation: Recommendation | null;
}

const TX_REASON_LABEL: Record<string, string> = {
  daily_bonus: "Daily bonus",
  first_time_bonus: "Welcome bonus",
  shop_purchase: "Booster purchase",
  draft_reward: "Draft reward",
  achievement: "Achievement reward",
  admin_grant: "Admin grant",
};

export async function getDashboardData(
  userId: string,
  vaultCoins: number,
): Promise<DashboardData> {
  await connectToDatabase();

  const [
    collectionStats,
    transactions,
    achievements,
    recentDecks,
    invites,
    openLobbies,
    sets,
    draftsPlayed,
  ] = await Promise.all([
    getCollectionStats(userId),
    Transaction.find({ userId }, { type: 1, amount: 1, reason: 1, createdAt: 1 })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
    Achievement.find({ userId }, { achievementId: 1, earnedAt: 1, vaultCoinsRewarded: 1 })
      .sort({ earnedAt: -1 })
      .limit(10)
      .lean(),
    SavedDeck.find({ userId }, { sessionId: 1, setCode: 1, cardIds: 1, createdAt: 1 })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    Notification.find({ userId, type: "draft_invite", read: false })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
    DraftSession.find(
      { status: "lobby" },
      { sessionId: 1, shortCode: 1, setCode: 1, players: 1, createdAt: 1 },
    )
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    CardSet.find({ enabled: true }, { code: 1, name: 1, boosterPrice: 1 }).lean(),
    SavedDeck.countDocuments({ userId }),
  ]);

  // Build unified activity feed
  const feedItems: FeedEvent[] = [];

  for (const tx of transactions) {
    const sign = tx.type === "credit" ? "+" : "-";
    feedItems.push({
      type: "transaction",
      date: (tx.createdAt as Date).toISOString(),
      label: TX_REASON_LABEL[tx.reason] ?? tx.reason,
      detail: `${sign}${tx.amount} VC`,
    });
  }

  for (const ach of achievements) {
    const def = ACHIEVEMENT_DEFS.find((d) => d.id === ach.achievementId);
    feedItems.push({
      type: "achievement",
      date: (ach.earnedAt as Date).toISOString(),
      label: `Achievement: ${def?.label ?? ach.achievementId}`,
      detail: ach.vaultCoinsRewarded > 0 ? `+${ach.vaultCoinsRewarded} VC` : undefined,
    });
  }

  for (const deck of recentDecks) {
    feedItems.push({
      type: "draft_complete",
      date: (deck.createdAt as Date).toISOString(),
      label: `Draft — ${deck.setCode.toUpperCase()}`,
      detail: `${deck.cardIds.length} picks`,
    });
  }

  feedItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const setMap = new Map(sets.map((s) => [s.code, s]));

  // Cheapest affordable set, preferring the most expensive (most interesting)
  const affordableSets = sets
    .filter((s) => s.boosterPrice <= vaultCoins)
    .sort((a, b) => b.boosterPrice - a.boosterPrice);
  const recSet = affordableSets[0];

  return {
    stats: {
      uniqueCards: collectionStats.uniqueCards,
      totalCards: collectionStats.totalCards,
      draftsPlayed,
      vaultCoins,
    },
    feed: feedItems.slice(0, 10),
    pendingInvites: invites.map((n) => ({
      id: String(n._id),
      fromDisplayName: n.fromDisplayName,
      shortCode: n.shortCode,
      sessionId: n.sessionId,
      createdAt: (n.createdAt as Date).toISOString(),
    })),
    openLobbies: openLobbies.map((s) => ({
      sessionId: s.sessionId,
      shortCode: s.shortCode,
      setCode: s.setCode,
      setName: setMap.get(s.setCode)?.name ?? s.setCode.toUpperCase(),
      playerCount: s.players.length,
      isMember: s.players.some((p) => p.uid === userId),
      createdAt: (s.createdAt as Date).toISOString(),
    })),
    recommendation: recSet
      ? {
          setCode: recSet.code,
          setName: recSet.name || recSet.code.toUpperCase(),
          boosterPrice: recSet.boosterPrice,
        }
      : null,
  };
}
