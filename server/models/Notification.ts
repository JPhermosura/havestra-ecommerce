import mongoose, { Schema, model } from "mongoose";

const NotificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: ["order", "delivery", "review", "inventory"],
      required: true,
    },
    title: { type: String, required: true, maxlength: 120 },
    message: { type: String, required: true, maxlength: 500 },
    link: { type: String, required: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order" },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

NotificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });

export const NotificationModel =
  mongoose.models.Notification || model("Notification", NotificationSchema);
