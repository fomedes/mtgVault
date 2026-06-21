import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";

export const PLAY_STATUSES = ["lobby", "playing", "ended"] as const;
export const LIFE_MODES = ["per-player", "shared-team"] as const;

const playPlayerSchema = new Schema(
  {
    uid: { type: String, required: true },
    displayName: { type: String, default: "" },
    seatIndex: { type: Number, required: true },
    teamId: { type: Number, default: 0 },
    isReady: { type: Boolean, default: false },
    /** Whether this seat has chosen a deck (source kind only; library not stored here). */
    deckSource: {
      kind: { type: String, enum: ["deck", "decklist"] },
    },
  },
  { _id: false },
);

const playSessionSchema = new Schema(
  {
    sessionId: { type: String, required: true, unique: true },
    shortCode: { type: String, required: true, unique: true },
    status: { type: String, enum: PLAY_STATUSES, default: "lobby" },
    formatLabel: { type: String, default: "Casual" },
    playerCount: { type: Number, required: true, min: 2, max: 4 },
    lifeMode: { type: String, enum: LIFE_MODES, default: "per-player" },
    startingLife: { type: Number, required: true, min: 1, max: 999 },
    hostUid: { type: String, required: true },
    players: [playPlayerSchema],
    /** Full serialised BoardState — checkpointed after every action. */
    boardState: { type: Schema.Types.Mixed },
    startedAt: { type: Date },
    endedAt: { type: Date },
  },
  { timestamps: true },
);

playSessionSchema.index({ shortCode: 1 });
playSessionSchema.index({ "players.uid": 1 });
playSessionSchema.index({ status: 1, createdAt: -1 });

export type PlaySessionDoc = InferSchemaType<typeof playSessionSchema>;

export const PlaySession: Model<PlaySessionDoc> =
  (models.PlaySession as Model<PlaySessionDoc>) ??
  model<PlaySessionDoc>("PlaySession", playSessionSchema);
