import { Router } from "express";
import mongoose from "mongoose";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import { NotificationModel } from "../models/Notification.js";

const router = Router();

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const [notifications, unreadCount] = await Promise.all([
    NotificationModel.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
    NotificationModel.countDocuments({ userId: req.user._id, readAt: null }),
  ]);
  return res.json({ notifications, unreadCount });
});

router.patch("/read-all", requireAuth, async (req: AuthRequest, res) => {
  await NotificationModel.updateMany(
    { userId: req.user._id, readAt: null },
    { $set: { readAt: new Date() } }
  );
  return res.json({ success: true });
});

router.patch("/:id/read", requireAuth, async (req: AuthRequest, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ error: "Invalid notification ID" });
  }

  const notification = await NotificationModel.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { $set: { readAt: new Date() } },
    { new: true }
  );
  if (!notification) {
    return res.status(404).json({ error: "Notification not found" });
  }
  return res.json(notification);
});

export default router;
