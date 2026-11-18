import express from "express";
import mongoose from "mongoose";
import { OrderModel } from "../models/Order.js";
import { ProductModel } from "../models/Product.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { publishNotifications } from "../services/notifications.js";
import {
  isValidFulfillmentTransition,
  normalizeFulfillmentStatus,
  type FulfillmentStatus,
} from "../utils/orderFulfillment.js";

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

function getFulfillmentOverallStatus(fulfillments: Array<{ status: string }>) {
  if (fulfillments.every(fulfillment => fulfillment.status === "Cancelled")) {
    return "Cancelled";
  }
  if (
    fulfillments.every(
      fulfillment =>
        fulfillment.status === "Delivered" || fulfillment.status === "Cancelled"
    )
  ) {
    return fulfillments.some(fulfillment => fulfillment.status === "Cancelled")
      ? "Partially Delivered"
      : "Delivered";
  }
  if (
    fulfillments.some(fulfillment => fulfillment.status === "Delivered")
  ) {
    return "Partially Delivered";
  }
  if (fulfillments.some(fulfillment => fulfillment.status === "In Transit")) {
    return "In Transit";
  }
  return "Pending";
}

function getReservedItems(order: any) {
  const quantities = new Map<string, { productId: any; quantity: number }>();
  for (const fulfillment of order.fulfillments || []) {
    if (fulfillment.stockStatus !== "reserved") continue;
    for (const itemIndex of fulfillment.itemIndexes || []) {
      const item = order.items[itemIndex];
      if (!item) continue;
      const key = item.productId.toString();
      const reservation = quantities.get(key) || {
        productId: item.productId,
        quantity: 0,
      };
      reservation.quantity += item.quantity;
      quantities.set(key, reservation);
    }
  }
  return Array.from(quantities.values());
}

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
      const hasFulfillments = Boolean(previousOrder.fulfillments?.length);
      const currentFulfillmentStatus = hasFulfillments
        ? "Pending"
        : normalizeFulfillmentStatus([
            previousOrder.deliveryStatus,
            previousOrder.status,
          ]);
      const allFulfillmentsCancelled =
        hasFulfillments &&
        previousOrder.fulfillments.every(
          (fulfillment: { status: string }) =>
            fulfillment.status === "Cancelled"
        );
      const allFulfillmentsDelivered =
        hasFulfillments &&
        previousOrder.fulfillments.every(
          (fulfillment: { status: string }) =>
            fulfillment.status === "Delivered"
        );
      if (
        (allFulfillmentsCancelled ||
          (!hasFulfillments && currentFulfillmentStatus === "Cancelled")) &&
        updates.status !== "Cancelled"
      ) {
        return res.status(409).json({
          error: "Cancelled orders cannot be reactivated",
        });
      }
      if (
        (allFulfillmentsDelivered ||
          (!hasFulfillments && currentFulfillmentStatus === "Delivered")) &&
        updates.status !== "Delivered"
      ) {
        return res.status(409).json({
          error: "Delivered orders cannot be moved backward",
        });
      }

      const statusToFulfillment: Record<string, FulfillmentStatus> = {
        Delivered: "Delivered",
        Cancelled: "Cancelled",
        Shipped: "In Transit",
        "Out for Delivery": "In Transit",
      };
      const requestedFulfillmentStatus = statusToFulfillment[updates.status];
      if (requestedFulfillmentStatus && previousOrder.fulfillments?.length) {
        for (const fulfillment of previousOrder.fulfillments) {
          if (
            !isValidFulfillmentTransition(
              fulfillment.status,
              requestedFulfillmentStatus
            )
          ) {
            return res.status(409).json({
              error: `Cannot move fulfillment from ${fulfillment.status} to ${requestedFulfillmentStatus}`,
            });
          }
        }
      } else if (
        !hasFulfillments &&
        requestedFulfillmentStatus &&
        !isValidFulfillmentTransition(
          currentFulfillmentStatus,
          requestedFulfillmentStatus
        )
      ) {
        return res.status(409).json({
          error: `Cannot move fulfillment from ${currentFulfillmentStatus} to ${requestedFulfillmentStatus}`,
        });
      }

      const timestamp = new Date();
      if (
        previousOrder.fulfillments?.length &&
        ["Delivered", "Cancelled", "Shipped", "Out for Delivery"].includes(
          updates.status
        )
      ) {
        const fulfillmentStatus =
          updates.status === "Delivered"
            ? "Delivered"
            : updates.status === "Cancelled"
              ? "Cancelled"
              : "In Transit";
        const reservations = getReservedItems(previousOrder);
        for (const fulfillment of previousOrder.fulfillments) {
          fulfillment.status = fulfillmentStatus;
          if (
            fulfillmentStatus === "Delivered" &&
            fulfillment.stockStatus === "reserved"
          ) {
            fulfillment.stockStatus = "consumed";
          } else if (
            fulfillmentStatus === "Cancelled" &&
            fulfillment.stockStatus === "reserved"
          ) {
            fulfillment.stockStatus = "released";
          }
          fulfillment.trackingHistory.push({
            status: fulfillmentStatus,
            timestamp,
          });
        }
        previousOrder.status = updates.status;
        previousOrder.deliveryStatus = getFulfillmentOverallStatus(
          previousOrder.fulfillments
        );
        previousOrder.trackingHistory.push({
          status: updates.status,
          timestamp,
        });
        if (updates.status === "Delivered")
          previousOrder.deliveredAt = timestamp;
        if (
          updates.status === "Shipped" ||
          updates.status === "Out for Delivery"
        ) {
          previousOrder.shippedAt = timestamp;
        }
        await previousOrder.save();
        try {
          for (const reservation of reservations) {
            const filter = {
              _id: reservation.productId,
              stockReservations: {
                $elemMatch: {
                  orderId: previousOrder._id,
                  quantity: reservation.quantity,
                },
              },
            };
            const update =
              fulfillmentStatus === "Cancelled"
                ? {
                    $inc: { stock: reservation.quantity },
                    $pull: {
                      stockReservations: { orderId: previousOrder._id },
                    },
                  }
                : {
                    $pull: {
                      stockReservations: { orderId: previousOrder._id },
                    },
                  };
            if (fulfillmentStatus === "Cancelled") {
              await ProductModel.findOneAndUpdate(filter, update);
            } else {
              await ProductModel.updateOne(filter, update);
            }
          }
        } catch (error) {
          console.error("[Admin.Orders] Fulfillment inventory update failed", {
            orderId: String(previousOrder._id),
            errorName: error instanceof Error ? error.name : "Error",
          });
          return res.status(500).json({
            error: "Order status updated, but inventory needs attention",
          });
        }
        await publishNotifications([
          {
            userId: previousOrder.buyerId,
            type: "order",
            title: "Order status update",
            message: `Order ${previousOrder.orderId} is now ${updates.status.toLowerCase()}.`,
            link: `/orders/${previousOrder._id}`,
            orderId: previousOrder._id,
          },
        ]);
        return res.json({ order: previousOrder });
      }

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
      if (order.fulfillments?.length && updates.deliveryStatus) {
        const fulfillmentStatus: FulfillmentStatus =
          updates.deliveryStatus === "Shipped" ||
          updates.deliveryStatus === "Out for Delivery"
            ? "In Transit"
            : updates.deliveryStatus;
        for (const fulfillment of order.fulfillments) {
          if (
            !isValidFulfillmentTransition(
              fulfillment.status,
              fulfillmentStatus
            )
          ) {
            return res.status(409).json({
              error: `Cannot move fulfillment from ${fulfillment.status} to ${fulfillmentStatus}`,
            });
          }
        }
        const reservations = getReservedItems(order);
        for (const fulfillment of order.fulfillments) {
          fulfillment.status = fulfillmentStatus;
          if (
            fulfillmentStatus === "Delivered" &&
            fulfillment.stockStatus === "reserved"
          ) {
            fulfillment.stockStatus = "consumed";
          }
          fulfillment.trackingHistory.push({
            status: entry.status.trim(),
            timestamp: new Date(),
          });
        }
        order.trackingHistory.push({
          status: entry.status.trim(),
          timestamp: new Date(),
        });
        order.deliveryStatus = getFulfillmentOverallStatus(order.fulfillments);
        if (order.deliveryStatus === "Delivered") {
          order.status = "Delivered";
          order.deliveredAt = new Date();
        }
        await order.save();
        if (fulfillmentStatus === "Delivered") {
          try {
            for (const reservation of reservations) {
              await ProductModel.updateOne(
                {
                  _id: reservation.productId,
                  stockReservations: {
                    $elemMatch: {
                      orderId: order._id,
                      quantity: reservation.quantity,
                    },
                  },
                },
                { $pull: { stockReservations: { orderId: order._id } } }
              );
            }
          } catch (error) {
            console.error(
              "[Admin.Orders] Fulfillment inventory update failed",
              {
                orderId: String(order._id),
                errorName: error instanceof Error ? error.name : "Error",
              }
            );
            return res.status(500).json({
              error: "Tracking updated, but inventory needs attention",
            });
          }
        }
        if (previousDeliveryStatus !== order.deliveryStatus) {
          await publishNotifications([
            {
              userId: order.buyerId,
              type: "delivery",
              title: "Delivery update",
              message: `Order ${order.orderId} is now ${order.deliveryStatus.toLowerCase()}.`,
              link: `/orders/${order._id}`,
              orderId: order._id,
            },
          ]);
        }
        return res.json({ order });
      }
      if (updates.deliveryStatus) {
        const currentFulfillmentStatus = normalizeFulfillmentStatus([
          order.deliveryStatus,
          order.status,
        ]);
        const nextFulfillmentStatus = normalizeFulfillmentStatus([
          updates.deliveryStatus,
        ]);
        if (
          !isValidFulfillmentTransition(
            currentFulfillmentStatus,
            nextFulfillmentStatus
          )
        ) {
          return res.status(409).json({
            error: `Cannot move fulfillment from ${currentFulfillmentStatus} to ${nextFulfillmentStatus}`,
          });
        }
      }
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
