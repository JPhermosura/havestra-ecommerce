import { Types } from "mongoose";
import { NotificationModel } from "../models/Notification.js";

export interface NotificationInput {
  userId: Types.ObjectId;
  type: "order" | "delivery" | "review" | "inventory";
  title: string;
  message: string;
  link: string;
  orderId?: Types.ObjectId;
}

export async function publishNotifications(notifications: NotificationInput[]) {
  if (notifications.length === 0) return;

  try {
    await NotificationModel.insertMany(notifications, { ordered: false });
  } catch (error) {
    console.error(
      "[Notifications] Failed to persist marketplace notifications",
      error
    );
  }
}
