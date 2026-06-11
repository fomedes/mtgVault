/** Centralised game economy constants — change here, not scattered in code. */
export const GAME_CONFIG = {
  BOOSTER_PRICE: 100,
  DAILY_BONUS: 50,
  FIRST_TIME_BONUS: 100, // equal to one booster so new users can dive in immediately
  DRAFT_REWARD_BASE: 50,

  BOOSTER_COMMONS: 10,
  BOOSTER_UNCOMMONS: 3,
  BOOSTER_RARES: 1,
  MYTHIC_RATE: 1 / 8, // probability that the rare slot is mythic
  BOOSTER_LANDS: 1,
  BOOSTER_SIZE: 15,
} as const;

export const ACHIEVEMENT_REWARDS: Record<string, number> = {
  first_purchase: 50,
  first_draft: 200,
  collection_100: 150,
  collection_500: 300,
};
