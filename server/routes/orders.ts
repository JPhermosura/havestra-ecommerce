import { Router } from "express";
import mongoose from "mongoose";
import { OrderModel } from "../models/Order.js";
import { ProductModel } from "../models/Product.js";
import { UserModel } from "../models/User.js";
import { requireAuth, requireRole, AuthRequest } from "../middleware/auth.js";
import { nanoid } from "nanoid";
import { publishNotifications } from "../services/notifications.js";
import {
  isValidFulfillmentTransition,
  normalizeFulfillmentStatus,
} from "../utils/orderFulfillment.js";

const router = Router();

function createOrderId() {
  return `ORD-${nanoid(8).toUpperCase()}`;
}

type StockReservation = {
  productId: mongoose.Types.ObjectId;
  quantity: number;
  productName: string;
};

class StockUnavailableError extends Error {}
class StockRestorationError extends Error {}

async function reserveInventory(
  orderId: mongoose.Types.ObjectId,
  reservations: StockReservation[],
  productsById: Map<string, any>
) {
  const reserved: StockReservation[] = [];
  try {
    for (const reservation of reservations) {
      const product = productsById.get(reservation.productId.toString());
      const updatedProduct = await ProductModel.findOneAndUpdate(
        {
          _id: reservation.productId,
          stock: { $gte: reservation.quantity },
          price: product.price,
          isActive: { $ne: false },
          status: { $ne: "inactive" },
          approvalStatus: { $nin: ["pending", "rejected"] },
        },
        {
          $inc: { stock: -reservation.quantity },
          $push: {
            stockReservations: { orderId, quantity: reservation.quantity },
          },
        },
        { returnDocument: "after" }
      );
      if (!updatedProduct) {
        throw new StockUnavailableError(
          `${reservation.productName} does not have enough stock`
        );
      }
      reserved.push(reservation);
    }
    return reserved;
  } catch (error) {
    try {
      await restoreStockReservations(orderId, reserved);
    } catch (restoreError) {
      console.error("[Orders] Failed to roll back stock reservation", {
        orderId: orderId.toString(),
        errorName: restoreError instanceof Error ? restoreError.name : "Error",
      });
      throw new StockRestorationError(
        "Inventory recovery failed after checkout could not reserve all items"
      );
    }
    throw error;
  }
}

async function restoreStockReservations(
  orderId: mongoose.Types.ObjectId,
  reservations: StockReservation[]
) {
  for (const reservation of reservations) {
    await ProductModel.findOneAndUpdate(
      {
        _id: reservation.productId,
        stockReservations: {
          $elemMatch: { orderId, quantity: reservation.quantity },
        },
      },
      {
        $inc: { stock: reservation.quantity },
        $pull: { stockReservations: { orderId } },
      },
      { returnDocument: "after" }
    );
  }
}

async function consumeStockReservations(
  orderId: mongoose.Types.ObjectId,
  reservations: StockReservation[]
) {
  for (const reservation of reservations) {
    await ProductModel.updateOne(
      {
        _id: reservation.productId,
        stockReservations: {
          $elemMatch: { orderId, quantity: reservation.quantity },
        },
      },
      { $pull: { stockReservations: { orderId } } }
    );
  }
}

function getSellerFulfillments(items: any[], stockStatus: string) {
  const groups = new Map<string, { sellerId: any; itemIndexes: number[] }>();
  items.forEach((item, index) => {
    const sellerId = item.sellerId || item.farmerId;
    if (!sellerId) return;
    const sellerKey = sellerId.toString();
    const group = groups.get(sellerKey) || { sellerId, itemIndexes: [] };
    group.itemIndexes.push(index);
    groups.set(sellerKey, group);
  });
  return Array.from(groups.values()).map(group => ({
    ...group,
    status: "Pending",
    stockStatus,
    trackingHistory: [{ status: "Pending", timestamp: new Date() }],
  }));
}

function getOrderStockReservations(
  order: {
    items: Array<{
      productId: mongoose.Types.ObjectId;
      quantity: number;
      sellerId?: mongoose.Types.ObjectId;
      farmerId?: mongoose.Types.ObjectId;
    }>;
  },
  sellerId?: string
): StockReservation[] {
  const totals = new Map<string, StockReservation>();
  for (const item of order.items || []) {
    const ownerId = item.sellerId || item.farmerId;
    if (sellerId && ownerId?.toString() !== sellerId) continue;
    const key = item.productId.toString();
    const existing = totals.get(key);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      totals.set(key, {
        productId: item.productId,
        quantity: item.quantity,
        productName: "",
      });
    }
  }
  return Array.from(totals.values());
}

function getOverallFulfillmentStatus(fulfillments: Array<{ status: string }>) {
  if (fulfillments.length === 0) return "Pending";
  if (fulfillments.every(item => item.status === "Cancelled")) {
    return "Cancelled";
  }
  if (
    fulfillments.every(
      item => item.status === "Delivered" || item.status === "Cancelled"
    )
  ) {
    return fulfillments.some(item => item.status === "Cancelled")
      ? "Partially Delivered"
      : "Delivered";
  }
  if (fulfillments.some(item => item.status === "Delivered")) {
    return "Partially Delivered";
  }
  if (fulfillments.some(item => item.status === "In Transit")) {
    return "In Transit";
  }
  return "Pending";
}

function getLegacyFulfillmentStatus(order: {
  status?: string;
  deliveryStatus?: string;
}) {
  return normalizeFulfillmentStatus([order.deliveryStatus, order.status]);
}

function ensureSellerFulfillments(order: any) {
  if (order.fulfillments?.length) return order.fulfillments;
  const fulfillments = getSellerFulfillments(
    order.items || [],
    order.stockReservationStatus === "reserved" ? "reserved" : "legacy"
  );
  const status = getLegacyFulfillmentStatus(order);
  for (const fulfillment of fulfillments) {
    fulfillment.status = status;
  }
  order.fulfillments = fulfillments;
  return order.fulfillments;
}

function getFulfillmentItems(order: any, fulfillment: any) {
  return (fulfillment.itemIndexes || [])
    .map((index: number) => order.items[index])
    .filter(Boolean);
}

function projectSellerOrder(order: any, sellerId: string) {
  const result =
    typeof order.toObject === "function"
      ? order.toObject()
      : {
          ...order,
          items: [...(order.items || [])],
          fulfillments: [...(order.fulfillments || [])],
        };
  const itemIndexes = result.items
    .map((item: any, index: number) =>
      item.sellerId?.toString() === sellerId ||
      item.farmerId?.toString() === sellerId
        ? index
        : -1
    )
    .filter((index: number) => index >= 0);
  result.items = itemIndexes.map((index: number) => result.items[index]);
  result.fulfillments = (result.fulfillments || [])
    .filter((fulfillment: any) => fulfillment.sellerId?.toString() === sellerId)
    .map((fulfillment: any) => ({
      ...fulfillment,
      itemIndexes: (fulfillment.itemIndexes || [])
        .map((index: number) => itemIndexes.indexOf(index))
        .filter((index: number) => index >= 0),
    }));
  result.sellerFulfillment = result.fulfillments[0] || {
    sellerId,
    status: getLegacyFulfillmentStatus(result),
  };
  result.deliveryStatus = result.sellerFulfillment.status;
  result.trackingNumber =
    result.sellerFulfillment.trackingNumber || result.trackingNumber;
  result.courier = result.sellerFulfillment.courier || result.courier;
  result.estimatedDelivery =
    result.sellerFulfillment.estimatedDelivery || result.estimatedDelivery;
  return result;
}

async function decrementLegacyFulfillmentInventory(
  items: Array<{
    productId: mongoose.Types.ObjectId;
    quantity: number;
  }>
) {
  const lowStockNotifications = [];
  for (const item of items) {
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

router.post(
  "/",
  requireAuth,
  requireRole("buyer"),
  async (req: AuthRequest, res) => {
    const { items, shippingAddress, paymentMethod } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Order items are required" });
    }
    if (
      !shippingAddress ||
      typeof shippingAddress !== "object" ||
      Array.isArray(shippingAddress)
    ) {
      return res.status(400).json({ error: "Shipping address is required" });
    }
    if (
      paymentMethod !== undefined &&
      (typeof paymentMethod !== "string" ||
        paymentMethod.trim().toLowerCase() !== "cod")
    ) {
      return res
        .status(400)
        .json({
          error: "Cash on Delivery is the only supported payment method",
        });
    }

    const buyer = await UserModel.findById(req.user._id);
    if (!buyer) {
      return res.status(404).json({ error: "Buyer not found" });
    }

    const orderItems = [];
    const requestedQuantities = new Map<string, number>();
    const productsById = new Map<string, any>();
    let totalAmount = 0;
    for (const item of items) {
      if (
        !item ||
        typeof item !== "object" ||
        !mongoose.Types.ObjectId.isValid(item.productId)
      ) {
        return res
          .status(400)
          .json({ error: "A valid product ID is required" });
      }
      const quantity = Number(item.quantity ?? 1);
      if (!Number.isSafeInteger(quantity) || quantity <= 0) {
        return res.status(400).json({
          error: "Order quantities must be positive whole numbers",
        });
      }

      const product = await ProductModel.findById(item.productId);
      if (!product) {
        return res
          .status(404)
          .json({ error: `Product not found: ${item.productId}` });
      }
      productsById.set(product._id.toString(), product);
      if (
        product.isActive === false ||
        product.status === "inactive" ||
        product.approvalStatus === "pending" ||
        product.approvalStatus === "rejected"
      ) {
        return res.status(409).json({
          error: `${product.name} is no longer available for purchase`,
        });
      }
      const requestedQuantity =
        (requestedQuantities.get(product._id.toString()) || 0) + quantity;
      const availableStock = Number(product.stock ?? 0);
      if (
        !Number.isSafeInteger(requestedQuantity) ||
        !Number.isSafeInteger(availableStock) ||
        availableStock < 0 ||
        requestedQuantity > availableStock
      ) {
        return res.status(409).json({
          error: `${product.name} does not have enough stock`,
        });
      }
      requestedQuantities.set(product._id.toString(), requestedQuantity);

      const unitPrice = Number(product.price);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        return res.status(409).json({
          error: `${product.name} has an invalid price and cannot be ordered`,
        });
      }
      const totalPrice = unitPrice * quantity;
      if (
        !Number.isFinite(totalPrice) ||
        !Number.isFinite(totalAmount + totalPrice)
      ) {
        return res.status(400).json({ error: "Order total is invalid" });
      }
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
      paymentMethod: "cod",
      paymentStatus: "pending",
      totalAmount,
      status: "Order Placed",
      deliveryStatus: "Pending",
      trackingHistory: [{ status: "Pending", timestamp: new Date() }],
      items: orderItems,
      fulfillments: getSellerFulfillments(orderItems, "reserved"),
      stockReservationStatus: "reserved",
    });

    const reservations = Array.from(
      requestedQuantities,
      ([productId, quantity]) => {
        const product = productsById.get(productId);
        return {
          productId: product._id,
          quantity,
          productName: product.name,
        };
      }
    );
    let reserved: StockReservation[];
    try {
      reserved = await reserveInventory(order._id, reservations, productsById);
    } catch (error) {
      if (error instanceof StockUnavailableError) {
        return res.status(409).json({ error: error.message });
      }
      if (error instanceof StockRestorationError) {
        return res.status(500).json({ error: error.message });
      }
      console.error("[Orders] Could not reserve inventory", {
        errorName: error instanceof Error ? error.name : "Error",
      });
      return res.status(500).json({ error: "Unable to reserve inventory" });
    }
    try {
      await order.save();
    } catch (error) {
      try {
        await restoreStockReservations(order._id, reserved);
      } catch (restoreError) {
        console.error(
          "[Orders] Failed to restore stock after order save failure",
          {
            orderId: order._id.toString(),
            errorName:
              restoreError instanceof Error ? restoreError.name : "Error",
          }
        );
        return res.status(500).json({
          error:
            "Order creation failed and inventory recovery needs assistance",
        });
      }
      console.error("[Orders] Order save failed after inventory reservation", {
        errorName: error instanceof Error ? error.name : "Error",
      });
      return res
        .status(500)
        .json({
          error: "Unable to create the order; reserved stock was restored",
        });
    }
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
  }
);

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
    return res.json(
      req.user.role === "admin"
        ? orders
        : orders.map(order =>
            projectSellerOrder(order, req.user._id.toString())
          )
    );
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
    if (req.user.role === "seller") {
      return res.json(projectSellerOrder(order, req.user._id.toString()));
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

  const isAlreadyCancelled =
    order.status === "Cancelled" && order.deliveryStatus === "Cancelled";
  if (!isAlreadyCancelled) {
    const fulfillments = ensureSellerFulfillments(order);
    if (
      fulfillments.some(
        (fulfillment: any) =>
          fulfillment.status !== "Pending" && fulfillment.status !== "Cancelled"
      )
    ) {
      return res
        .status(400)
        .json({ error: "This order can no longer be cancelled" });
    }

    const cancelReason = req.body.cancelReason;
    if (!cancelReason || typeof cancelReason !== "string") {
      return res.status(400).json({ error: "Cancellation reason is required" });
    }

    for (const fulfillment of fulfillments) {
      fulfillment.status = "Cancelled";
      if (fulfillment.stockStatus === "reserved") {
        fulfillment.stockStatus = "released";
      }
      fulfillment.trackingHistory.push({
        status: "Cancelled",
        timestamp: new Date(),
      });
    }
    order.deliveryStatus = getOverallFulfillmentStatus(fulfillments);
    if (order.deliveryStatus === "Cancelled") order.status = "Cancelled";
    order.stockReservationStatus =
      order.stockReservationStatus === "reserved"
        ? "released"
        : order.stockReservationStatus;
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
  }

  try {
    await restoreStockReservations(order._id, getOrderStockReservations(order));
  } catch (error) {
    console.error("[Orders] Failed to restore stock for cancelled order", {
      orderId: String(order._id),
      errorName: error instanceof Error ? error.name : "Error",
    });
    return res
      .status(500)
      .json({
        error: "Order cancelled, but stock restoration needs assistance",
      });
  }
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

  if (req.user.role !== "seller" && req.user.role !== "admin") {
    return res.status(403).json({
      error: "You are not authorized to update tracking for this order",
    });
  }

  const sellerIdStr = req.user._id.toString();
  const fulfillments = ensureSellerFulfillments(order);
  const isSellerOfOrder = fulfillments.some(
    (fulfillment: any) => fulfillment.sellerId?.toString() === sellerIdStr
  );
  if (!isSellerOfOrder && req.user.role !== "admin") {
    return res.status(403).json({
      error: "You are not authorized to update tracking for this order",
    });
  }
  const requestedSellerId =
    typeof req.body.sellerId === "string" ? req.body.sellerId : undefined;
  const targets =
    req.user.role === "admin"
      ? requestedSellerId
        ? fulfillments.filter(
            (fulfillment: any) =>
              fulfillment.sellerId?.toString() === requestedSellerId
          )
        : fulfillments
      : fulfillments.filter(
          (fulfillment: any) => fulfillment.sellerId?.toString() === sellerIdStr
        );
  if (targets.length === 0) {
    return res.status(404).json({ error: "Seller fulfillment not found" });
  }

  const now = new Date();
  const stockToRestore: StockReservation[] = [];
  const stockToConsume: StockReservation[] = [];
  const legacyItemsToDecrement: Array<{
    productId: mongoose.Types.ObjectId;
    quantity: number;
  }> = [];
  let statusChanged = false;
  for (const fulfillment of targets) {
    if (!isValidFulfillmentTransition(fulfillment.status, status)) {
      return res.status(409).json({
        error: `Cannot move fulfillment from ${fulfillment.status} to ${status}`,
      });
    }

    if (status === "Delivered" && fulfillment.stockStatus === "legacy") {
      legacyItemsToDecrement.push(
        ...getFulfillmentItems(order, fulfillment).map((item: any) => ({
          productId: item.productId,
          quantity: item.quantity,
        }))
      );
      fulfillment.stockStatus = "consumed";
    } else if (
      status === "Delivered" &&
      ["reserved", "consumed"].includes(fulfillment.stockStatus)
    ) {
      stockToConsume.push(
        ...getOrderStockReservations(
          { items: getFulfillmentItems(order, fulfillment) },
          fulfillment.sellerId.toString()
        )
      );
      fulfillment.stockStatus = "consumed";
    }
    if (
      status === "Cancelled" &&
      ["reserved", "released"].includes(fulfillment.stockStatus)
    ) {
      stockToRestore.push(
        ...getOrderStockReservations(
          { items: getFulfillmentItems(order, fulfillment) },
          fulfillment.sellerId.toString()
        )
      );
      fulfillment.stockStatus = "released";
    } else if (status === "Cancelled" && fulfillment.stockStatus === "legacy") {
      fulfillment.stockStatus = "released";
    }
    if (fulfillment.status !== status) {
      fulfillment.status = status;
      fulfillment.trackingHistory.push({ status, timestamp: now });
      statusChanged = true;
    }
    if (trackingNumber !== undefined)
      fulfillment.trackingNumber = trackingNumber;
    if (courier !== undefined) fulfillment.courier = courier;
    if (estimatedDelivery !== undefined) {
      fulfillment.estimatedDelivery = estimatedDelivery;
    }
    if (status === "In Transit") fulfillment.shippedAt = now;
    if (status === "Delivered") fulfillment.deliveredAt = now;
  }

  order.deliveryStatus = getOverallFulfillmentStatus(fulfillments);
  if (order.deliveryStatus === "Delivered") order.status = "Delivered";
  if (order.deliveryStatus === "Cancelled") order.status = "Cancelled";
  order.trackingHistory = order.trackingHistory || [];
  order.trackingHistory.push({
    status: `Seller fulfillment updated: ${status}`,
    timestamp: now,
  });
  if (targets.length === 1) {
    order.trackingNumber = targets[0].trackingNumber;
    order.courier = targets[0].courier;
    order.estimatedDelivery = targets[0].estimatedDelivery;
    order.shippedAt = targets[0].shippedAt;
    order.deliveredAt = targets[0].deliveredAt;
  }

  await order.save();
  try {
    await restoreStockReservations(order._id, stockToRestore);
    await consumeStockReservations(order._id, stockToConsume);
    if (legacyItemsToDecrement.length) {
      await decrementLegacyFulfillmentInventory(legacyItemsToDecrement);
    }
  } catch (error) {
    console.error("[Orders] Fulfillment inventory update failed", {
      orderId: String(order._id),
      errorName: error instanceof Error ? error.name : "Error",
    });
    return res.status(500).json({
      error: "Fulfillment updated, but inventory needs attention",
    });
  }

  if (statusChanged) {
    await publishNotifications([
      {
        userId: order.buyerId,
        type: "delivery",
        title: "Delivery update",
        message: `A seller's items in order ${order.orderId} are now ${status.toLowerCase()}.`,
        link: `/orders/${order._id}`,
        orderId: order._id,
      },
    ]);
  }
  return res.json(
    req.user.role === "seller" ? projectSellerOrder(order, sellerIdStr) : order
  );
});

// Add or update tracking entries separately
router.patch("/:id/tracking", requireAuth, async (req: AuthRequest, res) => {
  const { deliveryStatus, note, timestamp, trackingNumber, courier } = req.body;
  const order = await OrderModel.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }
  if (req.user.role !== "seller" && req.user.role !== "admin") {
    return res.status(403).json({
      error: "You are not authorized to update tracking for this order",
    });
  }
  const mappedStatus =
    deliveryStatus === "Shipped" ? "In Transit" : deliveryStatus;
  const validStatuses = ["Pending", "In Transit", "Delivered", "Cancelled"];
  if (mappedStatus && !validStatuses.includes(mappedStatus)) {
    return res.status(400).json({ error: "Invalid delivery status" });
  }
  const sellerIdStr = req.user._id.toString();
  const fulfillments = ensureSellerFulfillments(order);
  const ownsFulfillment = fulfillments.some(
    (fulfillment: any) => fulfillment.sellerId?.toString() === sellerIdStr
  );
  if (!ownsFulfillment && req.user.role !== "admin") {
    return res.status(403).json({
      error: "You are not authorized to update tracking for this order",
    });
  }
  const targets =
    req.user.role === "admin"
      ? req.body.sellerId
        ? fulfillments.filter(
            (fulfillment: any) =>
              fulfillment.sellerId?.toString() === req.body.sellerId
          )
        : fulfillments
      : fulfillments.filter(
          (fulfillment: any) => fulfillment.sellerId?.toString() === sellerIdStr
        );
  if (targets.length === 0) {
    return res.status(404).json({ error: "Seller fulfillment not found" });
  }

  const changedStatus = targets.some(
    (fulfillment: any) => mappedStatus && fulfillment.status !== mappedStatus
  );
  const now = timestamp ? new Date(timestamp) : new Date();
  if (Number.isNaN(now.getTime())) {
    return res.status(400).json({ error: "Invalid tracking timestamp" });
  }
  const stockToRestore: StockReservation[] = [];
  const stockToConsume: StockReservation[] = [];
  const legacyItemsToDecrement: Array<{
    productId: mongoose.Types.ObjectId;
    quantity: number;
  }> = [];
  for (const fulfillment of targets) {
    if (
      mappedStatus &&
      !isValidFulfillmentTransition(fulfillment.status, mappedStatus)
    ) {
      return res.status(409).json({
        error: `Cannot move fulfillment from ${fulfillment.status} to ${mappedStatus}`,
      });
    }
    if (mappedStatus === "Delivered" && fulfillment.stockStatus === "legacy") {
      legacyItemsToDecrement.push(
        ...getFulfillmentItems(order, fulfillment).map((item: any) => ({
          productId: item.productId,
          quantity: item.quantity,
        }))
      );
      fulfillment.stockStatus = "consumed";
    } else if (
      mappedStatus === "Delivered" &&
      ["reserved", "consumed"].includes(fulfillment.stockStatus)
    ) {
      stockToConsume.push(
        ...getOrderStockReservations(
          { items: getFulfillmentItems(order, fulfillment) },
          fulfillment.sellerId.toString()
        )
      );
      fulfillment.stockStatus = "consumed";
    }
    if (
      mappedStatus === "Cancelled" &&
      ["reserved", "released"].includes(fulfillment.stockStatus)
    ) {
      stockToRestore.push(
        ...getOrderStockReservations(
          { items: getFulfillmentItems(order, fulfillment) },
          fulfillment.sellerId.toString()
        )
      );
      fulfillment.stockStatus = "released";
    } else if (
      mappedStatus === "Cancelled" &&
      fulfillment.stockStatus === "legacy"
    ) {
      fulfillment.stockStatus = "released";
    }
    if (mappedStatus && fulfillment.status !== mappedStatus) {
      fulfillment.status = mappedStatus;
    }
    if (trackingNumber !== undefined)
      fulfillment.trackingNumber = trackingNumber;
    if (courier !== undefined) fulfillment.courier = courier;
    if (mappedStatus === "In Transit") fulfillment.shippedAt = now;
    if (mappedStatus === "Delivered") fulfillment.deliveredAt = now;
    fulfillment.trackingHistory.push({
      status: mappedStatus || note || "Status Updated",
      timestamp: now,
    });
  }

  order.deliveryStatus = getOverallFulfillmentStatus(fulfillments);
  if (order.deliveryStatus === "Delivered") order.status = "Delivered";
  if (order.deliveryStatus === "Cancelled") order.status = "Cancelled";
  order.trackingHistory.push({
    status: mappedStatus
      ? `Seller fulfillment updated: ${mappedStatus}`
      : note || "Tracking updated",
    timestamp: now,
  });
  if (targets.length === 1) {
    order.trackingNumber = targets[0].trackingNumber;
    order.courier = targets[0].courier;
    order.shippedAt = targets[0].shippedAt;
    order.deliveredAt = targets[0].deliveredAt;
  }

  await order.save();
  try {
    await restoreStockReservations(order._id, stockToRestore);
    await consumeStockReservations(order._id, stockToConsume);
    if (legacyItemsToDecrement.length) {
      await decrementLegacyFulfillmentInventory(legacyItemsToDecrement);
    }
  } catch (error) {
    console.error("[Orders] Fulfillment inventory update failed", {
      orderId: String(order._id),
      errorName: error instanceof Error ? error.name : "Error",
    });
    return res.status(500).json({
      error: "Fulfillment updated, but inventory needs attention",
    });
  }
  if (changedStatus) {
    await publishNotifications([
      {
        userId: order.buyerId,
        type: "delivery",
        title: "Delivery update",
        message: `A seller's items in order ${order.orderId} are now ${String(mappedStatus).toLowerCase()}.`,
        link: `/orders/${order._id}`,
        orderId: order._id,
      },
    ]);
  }
  return res.json(
    req.user.role === "seller" ? projectSellerOrder(order, sellerIdStr) : order
  );
});

// Lookup by tracking number
router.get(
  "/tracking/:trackingNumber",
  requireAuth,
  async (req: AuthRequest, res) => {
    const order = await OrderModel.findOne({
      $or: [
        { trackingNumber: req.params.trackingNumber },
        { "fulfillments.trackingNumber": req.params.trackingNumber },
      ],
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
    return res.json(
      req.user.role === "seller"
        ? projectSellerOrder(order, req.user._id.toString())
        : order
    );
  }
);

export default router;
