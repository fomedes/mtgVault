import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";

export const DECK_CATEGORIES = ["draft", "complete", "wishlist"] as const;
export type DeckCategory = (typeof DECK_CATEGORIES)[number];

/** Denormalized card entry — avoids a Card join on every deck render. */
const deckCardSchema = new Schema(
  {
    cardId: { type: Schema.Types.ObjectId, ref: "Card", required: true },
    scryfallId: { type: String, required: true },
    name: { type: String, required: true },
    manaCost: { type: String, default: "" },
    typeLine: { type: String, default: "" },
    colors: { type: [String], default: [] },
    colorIdentity: { type: [String], default: [] },
    rarity: { type: String, default: "common" },
    imageUris: {
      small: { type: String },
      normal: { type: String },
    },
    quantity: { type: Number, required: true, min: 1, default: 1 },
  },
  { _id: false },
);

const deckSchema = new Schema(
  {
    userId: { type: String, required: true },
    name: { type: String, required: true, maxlength: 80 },
    cards: { type: [deckCardSchema], default: [] },
    /** Set when the deck was created from a draft pick list. */
    sourceDraftId: { type: String },
  },
  { timestamps: true },
);

deckSchema.index({ userId: 1, createdAt: -1 });

export type DeckCardEntry = InferSchemaType<typeof deckCardSchema>;
export type DeckDoc = InferSchemaType<typeof deckSchema>;

export const Deck: Model<DeckDoc> =
  (models.Deck as Model<DeckDoc>) ?? model<DeckDoc>("Deck", deckSchema);

/** A typeLine starting with "Basic Land" means unlimited copies in any deck. */
export function isBasicLand(typeLine: string): boolean {
  return typeLine.startsWith("Basic Land");
}
