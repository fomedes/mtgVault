import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";

export const FRIENDSHIP_STATUSES = ["pending", "accepted"] as const;
export type FriendshipStatus = (typeof FRIENDSHIP_STATUSES)[number];

/**
 * Canonical pair model: userA < userB (lexicographic) so the compound unique
 * index prevents duplicates regardless of request direction. The `requesterUid`
 * field records who sent the initial request.
 */
const friendshipSchema = new Schema(
  {
    /** Always the lexicographically smaller uid of the two parties. */
    userA: { type: String, required: true },
    /** Always the lexicographically larger uid of the two parties. */
    userB: { type: String, required: true },
    /** UID of the user who sent the initial request. */
    requesterUid: { type: String, required: true },
    status: {
      type: String,
      enum: FRIENDSHIP_STATUSES,
      default: "pending",
      required: true,
    },
  },
  { timestamps: true },
);

/** Prevent duplicate pairs — canonical order guarantees uniqueness. */
friendshipSchema.index({ userA: 1, userB: 1 }, { unique: true });
/** Fast lookups for "all friendships involving uid X". */
friendshipSchema.index({ userA: 1, status: 1 });
friendshipSchema.index({ userB: 1, status: 1 });

export type FriendshipDoc = InferSchemaType<typeof friendshipSchema>;

export const Friendship: Model<FriendshipDoc> =
  (models.Friendship as Model<FriendshipDoc>) ??
  model<FriendshipDoc>("Friendship", friendshipSchema);

/**
 * Return the canonical (userA, userB) pair for two UIDs.
 * userA is always the lexicographically smaller one.
 */
export function canonicalPair(
  uid1: string,
  uid2: string,
): { userA: string; userB: string } {
  return uid1 < uid2
    ? { userA: uid1, userB: uid2 }
    : { userA: uid2, userB: uid1 };
}
