import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";

const rulingEntrySchema = new Schema(
  {
    source: { type: String, default: "" },
    publishedAt: { type: String, default: "" },
    comment: { type: String, required: true },
  },
  { _id: false },
);

/**
 * Cached Scryfall rulings, fetched on demand (P1-05). Keyed by oracleId so
 * all prints of a card share one cache entry; TTL 30 d via `cachedAt`.
 */
const rulingSchema = new Schema({
  oracleId: { type: String, required: true, unique: true },
  rulings: { type: [rulingEntrySchema], default: [] },
  cachedAt: { type: Date, required: true },
});

export type RulingDoc = InferSchemaType<typeof rulingSchema>;

export const Ruling: Model<RulingDoc> =
  (models.Ruling as Model<RulingDoc>) ??
  model<RulingDoc>("Ruling", rulingSchema);
