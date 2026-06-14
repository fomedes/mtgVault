/** Centralised game economy constants — change here, not scattered in code. */
export const GAME_CONFIG = {
  BOOSTER_PRICE: 100,
  DAILY_BONUS: 100,
  FIRST_TIME_BONUS: 1000,
  DRAFT_REWARD_BASE: 50,

  BOOSTER_COMMONS: 10,
  BOOSTER_UNCOMMONS: 3,
  BOOSTER_RARES: 1,
  MYTHIC_RATE: 1 / 8, // probability that the rare slot is mythic
  BOOSTER_LANDS: 1,
  BOOSTER_SIZE: 15,
} as const;

export const ACHIEVEMENT_REWARDS: Record<string, number> = {
  // Bronze (50–75 VC)
  first_card: 50,
  first_purchase: 50,
  first_draft: 75,
  first_login: 50,
  coins_500: 50,
  night_owl: 75,
  // Silver (150 VC)
  collection_100: 150,
  hat_drafter: 150,
  draft_10: 150,
  spent_1000: 150,
  login_7: 150,
  social_butterfly: 150,
  // Gold (300 VC)
  collection_500: 300,
  draft_3_0: 300,
  coins_5000: 300,
  login_30: 300,
  rainbow_collector: 300,
  // Platinum (500 VC)
  collection_1000: 500,
  draft_50: 500,
  coins_10000: 500,
};
