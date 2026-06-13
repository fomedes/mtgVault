import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";

const userSchema = new Schema(
  {
    uid: { type: String, required: true, unique: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    displayName: { type: String, default: "" },
    photoURL: { type: String, default: "" },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    vaultCoins: { type: Number, default: 0, min: 0 },
    isAllowlisted: { type: Boolean, default: false },
    lastLoginAt: { type: Date },
    lastDailyBonusAt: { type: Date },
    /** UI preferences (D14). `background` is a background-manifest id, "none" by default. */
    preferences: {
      background: { type: String, default: "none" },
    },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema>;

export const User: Model<UserDoc> =
  (models.User as Model<UserDoc>) ?? model<UserDoc>("User", userSchema);
