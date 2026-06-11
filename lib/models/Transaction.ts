import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";

export const TRANSACTION_REASONS = [
  "daily_bonus",
  "first_time_bonus",
  "shop_purchase",
  "draft_reward",
  "achievement",
  "admin_grant",
] as const;

export type TransactionReason = (typeof TRANSACTION_REASONS)[number];

const transactionSchema = new Schema(
  {
    userId: { type: String, required: true },
    type: { type: String, enum: ["credit", "debit"], required: true },
    amount: { type: Number, required: true, min: 1 },
    reason: { type: String, enum: TRANSACTION_REASONS, required: true },
    balanceBefore: { type: Number, required: true, min: 0 },
    balanceAfter: { type: Number, required: true, min: 0 },
    meta: {
      setCode: { type: String },
      packCount: { type: Number },
      achievementId: { type: String },
      grantedBy: { type: String },
    },
  },
  { timestamps: true },
);

transactionSchema.index({ userId: 1, createdAt: -1 });

export type TransactionDoc = InferSchemaType<typeof transactionSchema>;

export const Transaction: Model<TransactionDoc> =
  (models.Transaction as Model<TransactionDoc>) ??
  model<TransactionDoc>("Transaction", transactionSchema);
