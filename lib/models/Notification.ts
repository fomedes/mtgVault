import {
  Schema,
  model,
  models,
  type InferSchemaType,
  type Model,
} from "mongoose";

export const NOTIFICATION_TYPES = ["draft_invite", "draft_started"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

const notificationSchema = new Schema(
  {
    userId: { type: String, required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    fromUid: { type: String, required: true },
    fromDisplayName: { type: String, default: "" },
    sessionId: { type: String, required: true },
    shortCode: { type: String, required: true },
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
