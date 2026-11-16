import express from "express";
import mongoose from "mongoose";
import { OrderModel } from "../models/Order.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { publishNotifications } from "../services/notifications.js";

const router = express.Router();
const orderStatuses = new Set([
  "Order Placed",
  "Payment Confirmed",
  "Preparing Order",
  "Packed",
  "Shipped",
  "Out for Delivery",
  "Delivered",
  "Cancelled",
]);
const deliveryStatuses = new Set([
  "Pending",
  "In Transit",
  "Out for Delivery",
  "Delivered",
]);

// List orders with optional search and status filter
router.get("/", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const search = (req.query.search as string) || "";
    const status = (req.query.status as string) || "";

    const filter: any = {};
    if (search) {
      filter.$or = [
        { orderId: { $regex: search, $options: "i" } },
        { buyerPhone: { $regex: search, $options: "i" } },
        { buyerName: { $regex: search, $options: "i" } },
      ];
    }
    if (status) filter.status = status;

    const total = await OrderModel.countDocuments(filter);
    const orders = await OrderModel.find(filter)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    res.json({ orders, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// Get order details
router.get("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const order = await OrderModel.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json({ order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

// Update order status or delivery info
router.put("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid order ID." });
    }
    const updates = req.body;
    if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
      return res
        .status(400)
        .json({ error: "Provide an order status or tracking update." });
    }
    const keys = Object.keys(updates);
    if (keys.length === 1 && keys[0] === "status") {
      if (
        typeof updates.status !== "string" ||
        !orderStatuses.has(updates.status)
      ) {
        return res.status(400).json({ error: "Invalid order status." });
      }
      const previousOrder = await OrderModel.findById(req.params.id);
      if (!previousOrder)
        return res.status(404).json({ error: "Order not found" });
      if (previousOrder.status === updates.status) {
        return res.json({ order: previousOrder });
      }

      const timestamp = new Date();
      const order = await OrderModel.findByIdAndUpdate(
        req.params.id,
        {
          status: updates.status,
          ...(updates.status === "Delivered"
            ? { deliveredAt: timestamp, deliveryStatus: "Delivered" }
            : {}),
          ...(updates.status === "Cancelled"
            ? { deliveryStatus: "Cancelled" }
            : {}),
          $push: {
            trackingHistory: { status: updates.status, timestamp },
          },
        },
        { new: true, runValidators: true }
      );
      if (!order) return res.status(404).json({ error: "Order not found" });
      await publishNotifications([
        {
          userId: order.buyerId,
          type: "order",
          title: "Order status update",
          message: `Order ${order.orderId} is now ${updates.status.toLowerCase()}.`,
          link: `/orders/${order._id}`,
          orderId: order._id,
        },
      ]);
      return res.json({ order });
    }
    if (
      keys.every(key =>
        ["trackingHistoryEntry", "deliveryStatus"].includes(key)
      ) &&
      keys.includes("trackingHistoryEntry")
    ) {
      const entry = updates.trackingHistoryEntry;
      if (
        !entry ||
        typeof entry !== "object" ||
        typeof entry.status !== "string" ||
        !entry.status.trim() ||
        entry.status.length > 100
      ) {
        return res.status(400).json({
          error: "Tracking status must be between 1 and 100 characters.",
        });
      }
      if (
        updates.deliveryStatus !== undefined &&
        (typeof updates.deliveryStatus !== "string" ||
          !deliveryStatuses.has(updates.deliveryStatus))
      ) {
        return res.status(400).json({ error: "Invalid delivery status." });
      }
      const order = await OrderModel.findById(req.params.id);
      if (!order) return res.status(404).json({ error: "Order not found" });
      const previousDeliveryStatus = order.deliveryStatus;
      order.trackingHistory.push({
        status: entry.status.trim(),
        timestamp: new Date(),
      });
      if (updates.deliveryStatus) {
        order.deliveryStatus = updates.deliveryStatus;
        if (updates.deliveryStatus === "Delivered") {
          order.status = "Delivered";
          order.deliveredAt = new Date();
        }
      }
      await order.save();
      if (
        updates.deliveryStatus &&
        previousDeliveryStatus !== updates.deliveryStatus
      ) {
        await publishNotifications([
          {
            userId: order.buyerId,
            type: "delivery",
            title: "Delivery update",
            message: `Order ${order.orderId} is now ${updates.deliveryStatus.toLowerCase()}.`,
            link: `/orders/${order._id}`,
            orderId: order._id,
          },
        ]);
      }
      return res.json({ order });
    }
    return res.status(400).json({
      error: "Only order status and delivery tracking updates are allowed.",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update order" });
  }
});

export default router;
