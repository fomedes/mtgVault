import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";

/**
 * An MTG set (curated via `enabled`, per decision D2). Seeded as a stub
 * ({code, enabled}); the sync job fills in Scryfall metadata. `cachedAt`
 * tracks metadata freshness (TTL 7 d), `cardsSyncedAt` the full card sync
 * (TTL 30 d) — both checked in code so warm paths make zero Scryfall calls.
 */
const cardSetSchema = new Schema({
  code: { type: String, required: true, unique: true, lowercase: true },
  name: { type: String, default: "" },
  scryfallId: { type: String, default: "" },
  setType: { type: String, default: "" },
  cardCount: { type: Number, default: 0 },
  releasedAt: { type: Date },
  iconSvgUri: { type: String, default: "" },
  enabled: { type: Boolean, default: false },
  boosterPrice: { type: Number, default: 100, min: 0 },
  cachedAt: { type: Date },
  cardsSyncedAt: { type: Date },
});

export type CardSetDoc = InferSchemaType<typeof cardSetSchema>;

export const CardSet: Model<CardSetDoc> =
  (models.Set as Model<CardSetDoc>) ?? model<CardSetDoc>("Set", cardSetSchema);
