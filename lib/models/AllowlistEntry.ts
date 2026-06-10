import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";

/**
 * Access control source of truth: a Google account may sign in only if its
 * email has an entry here. `User.isAllowlisted` mirrors this at login time.
 */
const allowlistEntrySchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    addedBy: { type: String, default: "seed-script" },
  },
  { timestamps: true },
);

export type AllowlistEntryDoc = InferSchemaType<typeof allowlistEntrySchema>;

export const AllowlistEntry: Model<AllowlistEntryDoc> =
  (models.AllowlistEntry as Model<AllowlistEntryDoc>) ??
  model<AllowlistEntryDoc>("AllowlistEntry", allowlistEntrySchema);
