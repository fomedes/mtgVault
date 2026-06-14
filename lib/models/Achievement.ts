import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";

export const ACHIEVEMENT_IDS = [
  // Bronze
  "first_card",
  "first_purchase",
  "first_draft",
  "first_login",
  "coins_500",
  "night_owl",
  // Silver
  "collection_100",
  "hat_drafter",
  "draft_10",
  "spent_1000",
  "login_7",
  "social_butterfly",
  // Gold
  "collection_500",
  "draft_3_0",
  "coins_5000",
  "login_30",
  "rainbow_collector",
  // Platinum
  "collection_1000",
  "draft_50",
  "coins_10000",
] as const;

export type AchievementId = (typeof ACHIEVEMENT_IDS)[number];

const achievementSchema = new Schema(
  {
    userId: { type: String, required: true },
    achievementId: {
      type: String,
      enum: ACHIEVEMENT_IDS,
      required: true,
    },
    earnedAt: { type: Date, required: true },
    vaultCoinsRewarded: { type: Number, required: true, min: 0 },
  },
  { timestamps: false },
);

achievementSchema.index({ userId: 1, achievementId: 1 }, { unique: true });

export type AchievementDoc = InferSchemaType<typeof achievementSchema>;

export const Achievement: Model<AchievementDoc> =
  (models.Achievement as Model<AchievementDoc>) ??
  model<AchievementDoc>("Achievement", achievementSchema);
