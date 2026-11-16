import { Router } from "express";
import mongoose from "mongoose";
import { OrderModel } from "../models/Order.js";
import { ProductModel } from "../models/Product.js";
import { UserModel } from "../models/User.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import { nanoid } from "nanoid";
import { publishNotifications } from "../services/notifications.js";

const router = Router();

function createOrderId() {
  return `ORD-${nanoid(8).toUpperCase()}`;
}

async function decrementDeliveredOrderInventory(order: {
  items: Array<{
    productId: mongoose.Types.ObjectId;
    quantity: number;
  }>;
}) {
  const lowStockNotifications = [];
  for (const item of order.items) {
    const product = await ProductModel.findByIdAndUpdate(
      item.productId,
      { $inc: { stock: -item.quantity } },
      { new: true }
    );
    if (!product) continue;

    const previousStock = product.stock + item.quantity;
    product.status = product.stock > 0 ? "Available" : "Out of Stock";
    await product.save();
    const sellerId = product.sellerId || product.farmerId;
    if (sellerId && previousStock > 5 && product.stock <= 5) {
      lowStockNotifications.push({
        userId: sellerId,
        type: "inventory" as const,
        title:
          product.stock > 0 ? "Low stock alert" : "Product is out of stock",
        message:
          product.stock > 0
            ? `${product.title} has only ${product.stock} unit(s) remaining.`
            : `${product.title} is now out of stock.`,
        link: "/seller/products",
      });
    }
  }
  await publishNotifications(lowStockNotifications);
}

router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const { items, shippingAddress, paymentMethod } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Order items are required" });
  }
  if (!shippingAddress) {
    return res.status(400).json({ error: "Shipping address is required" });
  }

  const buyer = await UserModel.findById(req.user._id);
  if (!buyer) {
    return res.status(404).json({ error: "Buyer not found" });
  }

  const orderItems = [];
  let totalAmount = 0;
  for (const item of items) {
    const product = await ProductModel.findById(item.productId);
    if (!product) {
      return res
        .status(404)
        .json({ error: `Product not found: ${item.productId}` });
    }
    const unitPrice = product.price;
    const quantity = Number(item.quantity || 1);
    const totalPrice = unitPrice * quantity;
    orderItems.push({
      productId: product._id,
      productName: product.name,
      productImage: product.image,
      unitPrice,
      quantity,
      totalPrice,
      sellerId: product.sellerId,
      farmerId: product.farmerId,
    });
    totalAmount += totalPrice;
  }

  const order = new OrderModel({
    orderId: createOrderId(),
    buyerId: buyer._id,
    buyerName: buyer.name,
    buyerPhone: buyer.phone,
    buyerEmail: buyer.email,
    buyerAddress: {
      street: shippingAddress.street || "",
      city: shippingAddress.city || "",
      province: shippingAddress.province || "",
      zipCode: shippingAddress.zipCode || "",
    },
    paymentMethod: paymentMethod || "cod",
    paymentStatus: "pending",
    totalAmount,
    status: "Order Placed",
    deliveryStatus: "Pending",
    trackingHistory: [{ status: "Pending", timestamp: new Date() }],
    items: orderItems,
  });

  await order.save();
  const sellerIds = new Map<string, mongoose.Types.ObjectId>();
  for (const item of orderItems) {
    const sellerId = item.sellerId || item.farmerId;
    if (sellerId) sellerIds.set(sellerId.toString(), sellerId);
  }
  await publishNotifications([
    {
      userId: buyer._id,
      type: "order",
      title: "Order placed",
      message: `Your order ${order.orderId} has been placed.`,
      link: `/orders/${order._id}`,
      orderId: order._id,
    },
    ...Array.from(sellerIds.values()).map(userId => ({
      userId,
      type: "order" as const,
      title: "New order received",
      message: `A new order ${order.orderId} includes your products.`,
      link: "/seller/orders",
      orderId: order._id,
    })),
  ]);
  return res.status(201).json(order);
});

router.get("/buyer/:buyerId", requireAuth, async (req: AuthRequest, res) => {
  if (req.user._id.toString() !== req.params.buyerId) {
    return res
      .status(403)
      .json({ error: "Unauthorized to view this buyer's orders" });
  }
  const orders = await OrderModel.find({ buyerId: req.user._id }).sort({
    createdAt: -1,
  });
  return res.json(orders);
});

router.get("/seller/:sellerId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { sellerId } = req.params;
    if (req.user._id.toString() !== sellerId && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Unauthorized to view this seller's orders" });
    }
    // Try to convert to ObjectId if valid, otherwise use string
    let sellerIdQuery: any = sellerId;
    if (mongoose.Types.ObjectId.isValid(sellerId)) {
      sellerIdQuery = new mongoose.Types.ObjectId(sellerId);
    }

    const orders = await OrderModel.find({
      $or: [
        { "items.sellerId": sellerIdQuery },
        { "items.farmerId": sellerIdQuery },
      ],
    }).sort({ createdAt: -1 });
    return res.json(orders);
  } catch (error) {
    console.error("Error fetching seller orders:", error);
    return res.status(500).json({ error: "Failed to fetch orders" });
  }
});

router.get("/id/:orderId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const orderId = req.params.orderId;
    // Skip if this looks like a route parameter (not a valid ID)
    if (!orderId || orderId === "history" || orderId === "tracking") {
      return res.status(400).json({ error: "Invalid order ID" });
    }

    const order =
      (await OrderModel.findOne({ _id: orderId }).catch(() => null)) ||
      (await OrderModel.findOne({ orderId }));
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    const isBuyer = order.buyerId.toString() === req.user._id.toString();
    const isSeller = (order.items || []).some(
      (item: any) =>
        item.sellerId?.toString() === req.user._id.toString() ||
        item.farmerId?.toString() === req.user._id.toString()
    );
    if (!isBuyer && !isSeller && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ error: "You are not authorized to view this order" });
    }
    return res.json(order);
  } catch (error) {
    console.error("Error fetching order by ID:", error);
    return res.status(400).json({ error: "Invalid order ID format" });
  }
});

router.put("/:id/cancel", requireAuth, async (req: AuthRequest, res) => {
  const order = await OrderModel.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }
  // Authorization: only the buyer who placed the order or an admin may cancel it
  try {
    const isBuyer =
      order.buyerId && order.buyerId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";
    if (!isBuyer && !isAdmin) {
      return res
        .status(403)
        .json({ error: "You are not authorized to cancel this order" });
    }
  } catch (e) {
    console.warn("Authorization check failed", e);
    return res
      .status(403)
      .json({ error: "You are not authorized to cancel this order" });
  }

  if (order.status === "Cancelled") {
    return res.status(400).json({ error: "Order already cancelled" });
  }

  const cancellableStatuses = [
    "Order Placed",
    "Payment Confirmed",
    "Preparing Order",
    "Packed",
  ];

  if (!cancellableStatuses.includes(order.status)) {
    return res
      .status(400)
      .json({ error: "This order can no longer be cancelled" });
  }

  const cancelReason = req.body.cancelReason;
  if (!cancelReason || typeof cancelReason !== "string") {
    return res.status(400).json({ error: "Cancellation reason is required" });
  }

  order.status = "Cancelled";
  order.deliveryStatus = "Cancelled";
  order.trackingHistory = order.trackingHistory || [];
  order.trackingHistory.push({ status: "Cancelled", timestamp: new Date() });
  order.cancelReason = cancelReason;
  order.cancelDescription = req.body.cancelDescription || "";
  order.cancelledBy = req.user._id.toString();
  order.cancelledAt = new Date();

  await order.save();
  const sellerIds = new Map<string, mongoose.Types.ObjectId>();
  for (const item of order.items) {
    const sellerId = item.sellerId || item.farmerId;
    if (sellerId) sellerIds.set(sellerId.toString(), sellerId);
  }
  await publishNotifications([
    {
      userId: order.buyerId,
      type: "order",
      title: "Order cancelled",
      message: `Your order ${order.orderId} was cancelled.`,
      link: `/orders/${order._id}`,
      orderId: order._id,
    },
    ...Array.from(sellerIds.values())
      .filter(sellerId => sellerId.toString() !== req.user._id.toString())
      .map(userId => ({
        userId,
        type: "order" as const,
        title: "Order cancelled",
        message: `Order ${order.orderId} was cancelled.`,
        link: "/seller/orders",
        orderId: order._id,
      })),
  ]);
  return res.json(order);
});

router.put("/:id/status", requireAuth, async (req: AuthRequest, res) => {
  const { status, trackingNumber, courier, estimatedDelivery } = req.body;
  if (!status) {
    return res.status(400).json({ error: "Status is required" });
  }

  const validDeliveryStatuses = [
    "Pending",
    "In Transit",
    "Delivered",
    "Cancelled",
  ];
  if (!validDeliveryStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid delivery status" });
  }

  const order = await OrderModel.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }

  const sellerIdStr = req.user._id.toString();
  const isSellerOfOrder = (order.items || []).some(
    (item: any) =>
      item.sellerId?.toString() === sellerIdStr ||
      item.farmerId?.toString() === sellerIdStr
  );
  if (!isSellerOfOrder && req.user.role !== "admin") {
    return res.status(403).json({
      error: "You are not authorized to update tracking for this order",
    });
  }

  const currentStatus = String(order.deliveryStatus || "").toLowerCase();
  const previousStatus = order.deliveryStatus;
  const isDelivered = status === "Delivered";
  const isCancelled = status === "Cancelled";

  if (isDelivered && currentStatus !== "delivered") {
    await decrementDeliveredOrderInventory(order);
  }

  if (isCancelled) {
    order.status = "Cancelled";
    order.deliveryStatus = "Cancelled";
  } else {
    if (isDelivered) {
      order.status = "Delivered";
    }
    order.deliveryStatus = status;
  }

  order.trackingHistory = order.trackingHistory || [];
  order.trackingHistory.push({ status, timestamp: new Date() });

  if (trackingNumber !== undefined) {
    order.trackingNumber = trackingNumber;
  }
  if (courier !== undefined) {
    order.courier = courier;
  }
  if (estimatedDelivery !== undefined) {
    order.estimatedDelivery = estimatedDelivery;
  }

  if (status === "In Transit") {
    order.shippedAt = new Date();
  }
  if (isDelivered) {
    order.deliveredAt = new Date();
  }

  await order.save();
  if (previousStatus !== status) {
    await publishNotifications([
      {
        userId: order.buyerId,
        type: "delivery",
        title: "Delivery update",
        message: `Order ${order.orderId} is now ${status.toLowerCase()}.`,
        link: `/orders/${order._id}`,
        orderId: order._id,
      },
    ]);
  }
  return res.json(order);
});

// Add or update tracking entries separately
router.patch("/:id/tracking", requireAuth, async (req: AuthRequest, res) => {
  const { deliveryStatus, note, timestamp, trackingNumber, courier } = req.body;
  const order = await OrderModel.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }
  const isSellerOfOrder = (order.items || []).some(
    (item: any) =>
      item.sellerId?.toString() === req.user._id.toString() ||
      item.farmerId?.toString() === req.user._id.toString()
  );
  if (!isSellerOfOrder && req.user.role !== "admin") {
    return res.status(403).json({
      error: "You are not authorized to update tracking for this order",
    });
  }
  const validStatuses = [
    "Pending",
    "In Transit",
    "Shipped",
    "Delivered",
    "Cancelled",
  ];
  if (deliveryStatus && !validStatuses.includes(deliveryStatus)) {
    return res.status(400).json({ error: "Invalid delivery status" });
  }
  const previousStatus = order.deliveryStatus;

  // If marking as Delivered, update product stock
  if (
    (deliveryStatus === "Delivered" || deliveryStatus === "delivered") &&
    order.deliveryStatus !== "Delivered" &&
    order.deliveryStatus !== "delivered"
  ) {
    await decrementDeliveredOrderInventory(order);
  }

  if (trackingNumber !== undefined) order.trackingNumber = trackingNumber;
  if (courier !== undefined) order.courier = courier;

  const entry = {
    status: deliveryStatus || note || "Status Updated",
    timestamp: timestamp ? new Date(timestamp) : new Date(),
  };

  order.trackingHistory = order.trackingHistory || [];
  order.trackingHistory.push(entry);
  if (deliveryStatus) {
    order.deliveryStatus = deliveryStatus;
    if (deliveryStatus === "Delivered") order.status = "Delivered";
    if (deliveryStatus === "Cancelled") order.status = "Cancelled";
  }

  if (deliveryStatus === "Shipped") order.shippedAt = new Date();
  if (deliveryStatus === "Delivered") order.deliveredAt = new Date();

  await order.save();
  if (deliveryStatus && previousStatus !== deliveryStatus) {
    await publishNotifications([
      {
        userId: order.buyerId,
        type: "delivery",
        title: "Delivery update",
        message: `Order ${order.orderId} is now ${String(deliveryStatus).toLowerCase()}.`,
        link: `/orders/${order._id}`,
        orderId: order._id,
      },
    ]);
  }
  return res.json(order);
});

// Lookup by tracking number
router.get(
  "/tracking/:trackingNumber",
  requireAuth,
  async (req: AuthRequest, res) => {
    const order = await OrderModel.findOne({
      trackingNumber: req.params.trackingNumber,
    });
    if (!order)
      return res.status(404).json({ error: "Tracking number not found" });
    const isBuyer = order.buyerId.toString() === req.user._id.toString();
    const isSeller = (order.items || []).some(
      (item: any) =>
        item.sellerId?.toString() === req.user._id.toString() ||
        item.farmerId?.toString() === req.user._id.toString()
    );
    if (!isBuyer && !isSeller && req.user.role !== "admin") {
      return res.status(403).json({
        error: "You are not authorized to view this tracking information",
      });
    }
    return res.json(order);
  }
);

export default router;
