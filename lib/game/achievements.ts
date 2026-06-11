import { connectToDatabase } from "@/lib/db";
import { Achievement, type AchievementId } from "@/lib/models/Achievement";
import { ACHIEVEMENT_REWARDS } from "@/lib/game/config";
import { creditWallet } from "@/lib/game/wallet";

export interface AchievementDef {
  id: AchievementId;
  label: string;
  description: string;
  reward: number;
}

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  {
    id: "first_purchase",
    label: "First Purchase",
    description: "Open your first booster pack",
    reward: ACHIEVEMENT_REWARDS.first_purchase,
  },
  {
    id: "first_draft",
    label: "First Draft",
    description: "Complete your first multiplayer draft",
    reward: ACHIEVEMENT_REWARDS.first_draft,
  },
  {
    id: "collection_100",
    label: "Century",
    description: "Collect 100 unique cards",
    reward: ACHIEVEMENT_REWARDS.collection_100,
  },
  {
    id: "collection_500",
    label: "Hoarder",
    description: "Collect 500 unique cards",
    reward: ACHIEVEMENT_REWARDS.collection_500,
  },
];

/**
 * Awards an achievement to a user if they haven't earned it yet.
 * Credits the reward via the wallet service and returns whether it was newly earned.
 */
export async function awardAchievement(
  userId: string,
  achievementId: AchievementId,
): Promise<boolean> {
  await connectToDatabase();

  const reward = ACHIEVEMENT_REWARDS[achievementId] ?? 0;

  try {
    await Achievement.create({
      userId,
      achievementId,
      earnedAt: new Date(),
      vaultCoinsRewarded: reward,
    });
  } catch (err: unknown) {
    // Duplicate key → already earned, silently skip.
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: number }).code === 11000
    ) {
      return false;
    }
    throw err;
  }

  if (reward > 0) {
    await creditWallet(userId, reward, "achievement", { achievementId });
  }

  return true;
}

/** Returns all achievements earned by a user. */
export async function getUserAchievements(userId: string) {
  await connectToDatabase();
  return Achievement.find({ userId }).sort({ earnedAt: -1 }).lean();
}
