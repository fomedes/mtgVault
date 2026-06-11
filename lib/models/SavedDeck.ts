import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";

const savedDeckSchema = new Schema(
  {
    userId: { type: String, required: true },
    sessionId: { type: String, required: true },
    setCode: { type: String, required: true, lowercase: true },
    /** MongoDB ObjectId strings of all cards picked, in pick order. */
    cardIds: [{ type: String, required: true }],
  },
  { timestamps: true },
);

savedDeckSchema.index({ userId: 1, createdAt: -1 });
savedDeckSchema.index({ sessionId: 1 });

export type SavedDeckDoc = InferSchemaType<typeof savedDeckSchema>;

export const SavedDeck: Model<SavedDeckDoc> =
  (models.SavedDeck as Model<SavedDeckDoc>) ??
  model<SavedDeckDoc>("SavedDeck", savedDeckSchema);
