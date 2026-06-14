import { connectToDatabase } from "@/lib/db";
import { Achievement, type AchievementId } from "@/lib/models/Achievement";
import { ACHIEVEMENT_REWARDS } from "@/lib/game/config";
import { creditWallet } from "@/lib/game/wallet";

export type AchievementTier = "bronze" | "silver" | "gold" | "platinum";

export interface AchievementDef {
  id: AchievementId;
  label: string;
  description: string;
  reward: number;
  tier: AchievementTier;
  hidden?: boolean;
}

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  // ── Bronze ──────────────────────────────────────────────────────────────────
  {
    id: "first_card",
    label: "First Blood",
    description: "Add your first card to your collection",
    reward: ACHIEVEMENT_REWARDS.first_card,
    tier: "bronze",
  },
  {
    id: "first_purchase",
    label: "Pack Cracker",
    description: "Open your first booster pack",
    reward: ACHIEVEMENT_REWARDS.first_purchase,
    tier: "bronze",
  },
  {
    id: "first_draft",
    label: "Drafted!",
    description: "Complete your first multiplayer draft",
    reward: ACHIEVEMENT_REWARDS.first_draft,
    tier: "bronze",
  },
  {
    id: "first_login",
    label: "Early Bird",
    description: "Log in to the Vault for the first time",
    reward: ACHIEVEMENT_REWARDS.first_login,
    tier: "bronze",
  },
  {
    id: "coins_500",
    label: "Saving Up",
    description: "Accumulate 500 vault coins",
    reward: ACHIEVEMENT_REWARDS.coins_500,
    tier: "bronze",
  },
  {
    id: "night_owl",
    label: "Night Owl",
    description: "Log in between midnight and 4am",
    reward: ACHIEVEMENT_REWARDS.night_owl,
    tier: "bronze",
    hidden: true,
  },
  // ── Silver ──────────────────────────────────────────────────────────────────
  {
    id: "collection_100",
    label: "Collector",
    description: "Own 100 unique cards",
    reward: ACHIEVEMENT_REWARDS.collection_100,
    tier: "silver",
  },
  {
    id: "hat_drafter",
    label: "Hat Drafter",
    description: "First-pick a mythic rare in a draft",
    reward: ACHIEVEMENT_REWARDS.hat_drafter,
    tier: "silver",
  },
  {
    id: "draft_10",
    label: "Draft Veteran",
    description: "Complete 10 drafts",
    reward: ACHIEVEMENT_REWARDS.draft_10,
    tier: "silver",
  },
  {
    id: "spent_1000",
    label: "Big Spender",
    description: "Spend 1,000 vault coins in the shop",
    reward: ACHIEVEMENT_REWARDS.spent_1000,
    tier: "silver",
  },
  {
    id: "login_7",
    label: "Regular",
    description: "Log in 7 days in a row",
    reward: ACHIEVEMENT_REWARDS.login_7,
    tier: "silver",
  },
  {
    id: "social_butterfly",
    label: "Social Butterfly",
    description: "Have your first friend on the Vault",
    reward: ACHIEVEMENT_REWARDS.social_butterfly,
    tier: "silver",
  },
  // ── Gold ────────────────────────────────────────────────────────────────────
  {
    id: "collection_500",
    label: "Hoarder",
    description: "Own 500 unique cards",
    reward: ACHIEVEMENT_REWARDS.collection_500,
    tier: "gold",
  },
  {
    id: "draft_3_0",
    label: "3-0 Club",
    description: "Complete a perfect 3-0 draft",
    reward: ACHIEVEMENT_REWARDS.draft_3_0,
    tier: "gold",
  },
  {
    id: "coins_5000",
    label: "High Roller",
    description: "Accumulate 5,000 vault coins",
    reward: ACHIEVEMENT_REWARDS.coins_5000,
    tier: "gold",
  },
  {
    id: "login_30",
    label: "Dedicated",
    description: "Log in 30 days in a row",
    reward: ACHIEVEMENT_REWARDS.login_30,
    tier: "gold",
  },
  {
    id: "rainbow_collector",
    label: "Rainbow Collector",
    description: "Own at least one card of each of the five colors",
    reward: ACHIEVEMENT_REWARDS.rainbow_collector,
    tier: "gold",
  },
  // ── Platinum ────────────────────────────────────────────────────────────────
  {
    id: "collection_1000",
    label: "Archivist",
    description: "Own 1,000 unique cards",
    reward: ACHIEVEMENT_REWARDS.collection_1000,
    tier: "platinum",
  },
  {
    id: "draft_50",
    label: "Draft Master",
    description: "Complete 50 drafts",
    reward: ACHIEVEMENT_REWARDS.draft_50,
    tier: "platinum",
  },
  {
    id: "coins_10000",
    label: "Vault Billionaire",
    description: "Accumulate 10,000 vault coins",
    reward: ACHIEVEMENT_REWARDS.coins_10000,
    tier: "platinum",
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
