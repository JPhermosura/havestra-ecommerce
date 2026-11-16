import express from "express";
import { OrderModel } from "../models/Order.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

// List active deliveries (deliveryStatus not Delivered or Cancelled)
router.get("/", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const filter: any = { deliveryStatus: { $nin: ["Delivered", "Cancelled"] } };

    const total = await OrderModel.countDocuments(filter);
    const orders = await OrderModel.find(filter)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ updatedAt: -1 });

    res.json({ orders, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch active deliveries" });
  }
});

// Get delivery history for an order
router.get("/:id/history", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const order = await OrderModel.findById(req.params.id).select("trackingHistory deliveryStatus");
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json({ trackingHistory: order.trackingHistory, deliveryStatus: order.deliveryStatus });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch delivery history" });
  }
});

export default router;
