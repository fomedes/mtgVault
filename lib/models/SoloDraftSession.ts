import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";

const soloDraftSessionSchema = new Schema(
  {
    userId: { type: String, required: true },
    setCode: { type: String, required: true, lowercase: true },
    difficulty: { type: String, enum: ["easy", "medium", "hard"], required: true },
    status: { type: String, enum: ["drafting", "complete"], default: "drafting" },
    /** Full DraftState — checkpointed after every pick slot. */
    draftState: { type: Schema.Types.Mixed, required: true },
    /** Human seat's final pick list (populated on completion). */
    picks: [{ type: String }],
  },
  { timestamps: true },
);

soloDraftSessionSchema.index({ userId: 1, createdAt: -1 });

export type SoloDraftSessionDoc = InferSchemaType<typeof soloDraftSessionSchema>;

export const SoloDraftSession: Model<SoloDraftSessionDoc> =
  (models.SoloDraftSession as Model<SoloDraftSessionDoc>) ??
  model<SoloDraftSessionDoc>("SoloDraftSession", soloDraftSessionSchema);
