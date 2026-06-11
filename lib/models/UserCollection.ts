import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";

const collectionEntrySchema = new Schema(
  {
    cardId: { type: Schema.Types.ObjectId, ref: "Card", required: true },
    quantity: { type: Number, required: true, default: 1, min: 0 },
    obtainedVia: [{ type: String, enum: ["admin", "draft", "shop"] }],
    firstObtainedAt: { type: Date, required: true },
    lastObtainedAt: { type: Date, required: true },
  },
  { _id: false },
);

const userCollectionSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true },
    cards: [collectionEntrySchema],
  },
  { timestamps: true },
);

userCollectionSchema.index({ "cards.cardId": 1 });

export type CollectionEntry = InferSchemaType<typeof collectionEntrySchema>;
export type UserCollectionDoc = InferSchemaType<typeof userCollectionSchema>;

export const UserCollection: Model<UserCollectionDoc> =
  (models.UserCollection as Model<UserCollectionDoc>) ??
  model<UserCollectionDoc>("UserCollection", userCollectionSchema);
