import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";

export const DRAFT_FORMATS = ["booster"] as const;
export const DRAFT_STATUSES = ["lobby", "drafting", "complete"] as const;

const draftPlayerSchema = new Schema(
  {
    uid: { type: String, required: true },
    displayName: { type: String, default: "" },
    seatIndex: { type: Number, required: true },
    isReady: { type: Boolean, default: false },
  },
  { _id: false },
);

const draftSessionSchema = new Schema(
  {
    sessionId: { type: String, required: true, unique: true },
    shortCode: { type: String, required: true, unique: true },
    setCode: { type: String, required: true, lowercase: true },
    format: { type: String, enum: DRAFT_FORMATS, default: "booster" },
    status: { type: String, enum: DRAFT_STATUSES, default: "lobby" },
    timerMs: { type: Number, required: true, min: 30_000, max: 90_000 },
    hostUid: { type: String, required: true },
    players: [draftPlayerSchema],
    /** Full serialised DraftState — checkpointed after every pick. */
    draftState: { type: Schema.Types.Mixed },
    startedAt: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true },
);

draftSessionSchema.index({ shortCode: 1 });
draftSessionSchema.index({ "players.uid": 1 });
draftSessionSchema.index({ status: 1, createdAt: -1 });

export type DraftSessionDoc = InferSchemaType<typeof draftSessionSchema>;

export const DraftSession: Model<DraftSessionDoc> =
  (models.DraftSession as Model<DraftSessionDoc>) ??
  model<DraftSessionDoc>("DraftSession", draftSessionSchema);
