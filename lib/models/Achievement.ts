import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";

export const ACHIEVEMENT_IDS = [
  "first_purchase",
  "first_draft",
  "collection_100",
  "collection_500",
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
