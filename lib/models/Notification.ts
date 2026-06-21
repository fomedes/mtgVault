import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";

export const NOTIFICATION_TYPES = [
  "draft_invite",
  "draft_started",
  "play_invite",
  "friend_request",
  "friend_accepted",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

const notificationSchema = new Schema(
  {
    userId: { type: String, required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    fromUid: { type: String, required: true },
    fromDisplayName: { type: String, default: "" },
    /** Draft invite fields — optional for friend notifications. */
    sessionId: { type: String },
    shortCode: { type: String },
    /** Friendship ID for friend_request notifications. */
    friendshipId: { type: String },
    /** Extensible metadata for future notification types. */
    metadata: { type: Map, of: String },
    read: { type: Boolean, default: false },
  },
  { timestamps: true },
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });

export type NotificationDoc = InferSchemaType<typeof notificationSchema>;

export const Notification: Model<NotificationDoc> =
  (models.Notification as Model<NotificationDoc>) ??
  model<NotificationDoc>("Notification", notificationSchema);
