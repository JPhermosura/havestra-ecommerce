import { getJwtSecret } from "../utils/jwtSecret.js";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotificationModel } from "../models/Notification.js";
import { OrderModel } from "../models/Order.js";
import { ProductModel } from "../models/Product.js";
import { UserModel } from "../models/User.js";
import orderRouter from "../routes/orders.js";

const sellerOneId = "64b000000000000000000001";
const sellerTwoId = "64b000000000000000000002";
const buyerId = "64b000000000000000000006";
const orderId = new mongoose.Types.ObjectId("64b000000000000000000003");
const productOneId = new mongoose.Types.ObjectId("64b000000000000000000004");
const productTwoId = new mongoose.Types.ObjectId("64b000000000000000000005");

function authHeader(userId: string) {
  const token = jwt.sign(
    { userId },
    process.env.JWT_SECRET || getJwtSecret()
  );
  return { Authorization: `Bearer ${token}` };
}

function createOrder() {
  return {
    _id: orderId,
    buyerId: new mongoose.Types.ObjectId(buyerId),
    orderId: "ORD-TEST0001",
    status: "Order Placed",
    deliveryStatus: "Pending",
    stockReservationStatus: "reserved",
    items: [
      {
        productId: productOneId,
        productName: "Green beans",
        quantity: 2,
        unitPrice: 10,
        totalPrice: 20,
        sellerId: new mongoose.Types.ObjectId(sellerOneId),
      },
      {
        productId: productTwoId,
        productName: "Tomatoes",
        quantity: 3,
        unitPrice: 5,
        totalPrice: 15,
        sellerId: new mongoose.Types.ObjectId(sellerTwoId),
      },
    ],
    fulfillments: [
      {
        sellerId: new mongoose.Types.ObjectId(sellerOneId),
        itemIndexes: [0],
        status: "Pending",
        stockStatus: "reserved",
        trackingHistory: [],
      },
      {
        sellerId: new mongoose.Types.ObjectId(sellerTwoId),
        itemIndexes: [1],
        status: "Pending",
        stockStatus: "reserved",
        trackingHistory: [],
      },
    ],
    trackingHistory: [],
    save: vi.fn().mockResolvedValue(undefined),
  };
}

function createApp(
  order: ReturnType<typeof createOrder>,
  userId: string,
  role = "seller"
) {
  const app = express();
  app.use(express.json());
  app.use("/api/orders", orderRouter);
  vi.spyOn(UserModel, "findById").mockReturnValue({
    select: vi.fn().mockResolvedValue({
      _id: new mongoose.Types.ObjectId(userId),
      role,
    }),
  } as never);
  vi.spyOn(OrderModel, "findById").mockResolvedValue(order as never);
  vi.spyOn(NotificationModel, "insertMany").mockResolvedValue([] as never);
  return app;
}

afterEach(() => vi.restoreAllMocks());

describe("seller-specific order fulfillment", () => {
  it("updates and exposes only the authenticated seller's fulfillment items", async () => {
    const order = createOrder();
    vi.spyOn(ProductModel, "updateOne").mockResolvedValue({} as never);
    const firstResponse = await request(createApp(order, sellerOneId))
      .put(`/api/orders/${orderId}/status`)
      .set(authHeader(sellerOneId))
      .send({ status: "In Transit" });

    expect(firstResponse.status).toBe(200);
    expect(order.fulfillments[0].status).toBe("In Transit");
    expect(order.fulfillments[1].status).toBe("Pending");
    expect(order.deliveryStatus).toBe("In Transit");
    expect(firstResponse.body.items).toHaveLength(1);
    expect(firstResponse.body.items[0].productName).toBe("Green beans");

    const deliveredResponse = await request(createApp(order, sellerOneId))
      .put(`/api/orders/${orderId}/status`)
      .set(authHeader(sellerOneId))
      .send({ status: "Delivered" });

    expect(deliveredResponse.status).toBe(200);
    expect(order.fulfillments[0].status).toBe("Delivered");
    expect(order.fulfillments[1].status).toBe("Pending");
    expect(order.deliveryStatus).toBe("Partially Delivered");

    const secondResponse = await request(createApp(order, sellerTwoId))
      .put(`/api/orders/${orderId}/status`)
      .set(authHeader(sellerTwoId))
      .send({ status: "In Transit" });

    expect(secondResponse.status).toBe(200);
    expect(order.fulfillments.map(item => item.status)).toEqual([
      "Delivered",
      "In Transit",
    ]);
    expect(order.deliveryStatus).toBe("Partially Delivered");
    expect(secondResponse.body.items).toHaveLength(1);
    expect(secondResponse.body.items[0].productName).toBe("Tomatoes");
  });

  it("releases only the cancelling seller's reserved inventory", async () => {
    const order = createOrder();
    const findOneAndUpdate = vi
      .spyOn(ProductModel, "findOneAndUpdate")
      .mockResolvedValue({} as never);
    const app = createApp(order, sellerOneId);

    const response = await request(app)
      .put(`/api/orders/${orderId}/status`)
      .set(authHeader(sellerOneId))
      .send({ status: "Cancelled" });

    expect(response.status).toBe(200);
    expect(order.fulfillments.map(item => item.status)).toEqual([
      "Cancelled",
      "Pending",
    ]);
    expect(order.status).toBe("Order Placed");
    expect(findOneAndUpdate).toHaveBeenCalledOnce();
    expect(findOneAndUpdate.mock.calls[0][0]).toMatchObject({
      _id: productOneId,
    });
    expect(findOneAndUpdate.mock.calls[0][1]).toMatchObject({
      $inc: { stock: 2 },
    });

    const reopenResponse = await request(app)
      .put(`/api/orders/${orderId}/status`)
      .set(authHeader(sellerOneId))
      .send({ status: "Pending" });
    const deliverResponse = await request(app)
      .patch(`/api/orders/${orderId}/tracking`)
      .set(authHeader(sellerOneId))
      .send({
        trackingHistoryEntry: { status: "Delivered" },
        deliveryStatus: "Delivered",
      });

    expect(reopenResponse.status).toBe(409);
    expect(deliverResponse.status).toBe(409);
    expect(order.fulfillments[0].status).toBe("Cancelled");
    expect(order.fulfillments[0].stockStatus).toBe("released");
    expect(order.save).toHaveBeenCalledOnce();
    expect(findOneAndUpdate).toHaveBeenCalledOnce();
  });

  it("restores buyer-cancelled reservations once, even when cancellation is retried", async () => {
    const order = createOrder();
    const activeTokens = new Set([
      productOneId.toString(),
      productTwoId.toString(),
    ]);
    const restoredStock = new Map<string, number>([
      [productOneId.toString(), 10],
      [productTwoId.toString(), 8],
    ]);
    vi.spyOn(ProductModel, "findOneAndUpdate").mockImplementation(
      async (filter: any, update: any) => {
        const productKey = String(filter._id);
        if (!activeTokens.has(productKey)) return null as never;
        activeTokens.delete(productKey);
        restoredStock.set(
          productKey,
          (restoredStock.get(productKey) || 0) + update.$inc.stock
        );
        return {} as never;
      }
    );
    const app = createApp(order, buyerId, "buyer");
    const cancelRequest = () =>
      request(app)
        .put(`/api/orders/${orderId}/cancel`)
        .set(authHeader(buyerId))
        .send({ cancelReason: "changed mind" });

    const firstResponse = await cancelRequest();
    const retryResponse = await cancelRequest();

    expect(firstResponse.status).toBe(200);
    expect(retryResponse.status).toBe(200);
    expect(activeTokens.size).toBe(0);
    expect(restoredStock.get(productOneId.toString())).toBe(12);
    expect(restoredStock.get(productTwoId.toString())).toBe(11);
  });
});
