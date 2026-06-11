import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";

export const RARITIES = [
  "common",
  "uncommon",
  "rare",
  "mythic",
  "special",
  "bonus",
] as const;
export type Rarity = (typeof RARITIES)[number];

/** Numeric rank so rarity can be sorted (common < … < bonus). */
export const RARITY_VALUES: Record<Rarity, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  mythic: 4,
  special: 5,
  bonus: 6,
};

const imageUrisSchema = new Schema(
  {
    small: { type: String },
    normal: { type: String },
    large: { type: String },
    png: { type: String },
    artCrop: { type: String },
    borderCrop: { type: String },
  },
  { _id: false },
);

const cardFaceSchema = new Schema(
  {
    name: { type: String, required: true },
    manaCost: { type: String, default: "" },
    typeLine: { type: String, default: "" },
    oracleText: { type: String, default: "" },
    flavorText: { type: String, default: "" },
    colors: { type: [String], default: [] },
    power: { type: String },
    toughness: { type: String },
    loyalty: { type: String },
    imageUris: { type: imageUrisSchema },
  },
  { _id: false },
);

const cardSchema = new Schema({
  scryfallId: { type: String, required: true, unique: true },
  oracleId: { type: String, default: "", index: true },
  name: { type: String, required: true },
  set: { type: String, required: true, lowercase: true },
  collectorNumber: { type: String, required: true },
  /** Numeric prefix of collectorNumber ("123a" → 123) for correct ordering. */
  collectorNumberValue: { type: Number, default: 0 },
  rarity: { type: String, enum: RARITIES, required: true },
  rarityValue: { type: Number, default: 1 },
  colors: { type: [String], default: [] },
  colorIdentity: { type: [String], default: [] },
  typeLine: { type: String, default: "" },
  manaCost: { type: String, default: "" },
  cmc: { type: Number, default: 0 },
  oracleText: { type: String, default: "" },
  flavorText: { type: String, default: "" },
  power: { type: String },
  toughness: { type: String },
  loyalty: { type: String },
  imageUris: { type: imageUrisSchema },
  cardFaces: { type: [cardFaceSchema], default: [] },
  layout: { type: String, default: "normal" },
  legalities: { type: Map, of: String, default: {} },
  inBooster: { type: Boolean, default: false },
  cachedAt: { type: Date, required: true },
});

cardSchema.index({ set: 1, collectorNumber: 1 }, { unique: true });
cardSchema.index({ name: "text" });
cardSchema.index({ set: 1, collectorNumberValue: 1 });

export type CardDoc = InferSchemaType<typeof cardSchema>;

export const Card: Model<CardDoc> =
  (models.Card as Model<CardDoc>) ?? model<CardDoc>("Card", cardSchema);
