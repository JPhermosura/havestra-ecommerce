import { getJwtSecret } from "../utils/jwtSecret.js";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrderModel } from "../models/Order.js";
import { NotificationModel } from "../models/Notification.js";
import { UserModel } from "../models/User.js";
import { ProductModel } from "../models/Product.js";
import mongoose from "mongoose";
import adminOrdersRouter from "../routes/admin-orders.js";

const userId = "64b000000000000000000001";
const orderId = "64b000000000000000000002";
const jwtSecret = process.env.JWT_SECRET || getJwtSecret();

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/admin/orders", adminOrdersRouter);
  vi.spyOn(UserModel, "findById").mockReturnValue({
    select: vi.fn().mockResolvedValue({ _id: userId, role: "admin" }),
  } as never);
  return app;
}

function authHeader() {
  return { Authorization: `Bearer ${jwt.sign({ userId }, jwtSecret)}` };
}

afterEach(() => vi.restoreAllMocks());

describe("admin order updates", () => {
  it("rejects arbitrary fields instead of passing them to MongoDB", async () => {
    const update = vi.spyOn(OrderModel, "findByIdAndUpdate");
    const response = await request(createApp())
      .put(`/api/admin/orders/${orderId}`)
      .set(authHeader())
      .send({ status: "Delivered", totalAmount: 0 });

    expect(response.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("accepts only a valid order status and records delivery time", async () => {
    const deliveredAt = new Date();
    vi.spyOn(OrderModel, "findById").mockResolvedValue({
      _id: orderId,
      orderId: "ORD-ADMIN1",
      status: "Packed",
      deliveryStatus: "In Transit",
      buyerId: "64b000000000000000000003",
    } as never);
    const update = vi.spyOn(OrderModel, "findByIdAndUpdate").mockResolvedValue({
      _id: orderId,
      orderId: "ORD-ADMIN1",
      status: "Delivered",
      deliveredAt,
      buyerId: "64b000000000000000000003",
    } as never);
    const insertMany = vi
      .spyOn(NotificationModel, "insertMany")
      .mockResolvedValue([] as never);
    const response = await request(createApp())
      .put(`/api/admin/orders/${orderId}`)
      .set(authHeader())
      .send({ status: "Delivered" });

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      orderId,
      expect.objectContaining({
        status: "Delivered",
        deliveredAt: expect.any(Date),
        $push: {
          trackingHistory: {
            status: "Delivered",
            timestamp: expect.any(Date),
          },
        },
      }),
      { new: true, runValidators: true }
    );
    expect(insertMany).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          userId: "64b000000000000000000003",
          type: "order",
          title: "Order status update",
        }),
      ],
      { ordered: false }
    );
  });

  it("updates every seller fulfillment when an admin completes a multi-seller order", async () => {
    const order = {
      _id: new mongoose.Types.ObjectId(orderId),
      orderId: "ORD-MULTI1",
      status: "Packed",
      deliveryStatus: "In Transit",
      buyerId: "64b000000000000000000003",
      items: [
        {
          productId: new mongoose.Types.ObjectId("64b000000000000000000004"),
          quantity: 2,
        },
        {
          productId: new mongoose.Types.ObjectId("64b000000000000000000005"),
          quantity: 1,
        },
      ],
      fulfillments: [
        {
          sellerId: new mongoose.Types.ObjectId("64b000000000000000000006"),
          itemIndexes: [0],
          status: "In Transit",
          stockStatus: "reserved",
          trackingHistory: [],
        },
        {
          sellerId: new mongoose.Types.ObjectId("64b000000000000000000007"),
          itemIndexes: [1],
          status: "In Transit",
          stockStatus: "reserved",
          trackingHistory: [],
        },
      ],
      trackingHistory: [],
      save: vi.fn().mockResolvedValue(undefined),
    };
    vi.spyOn(OrderModel, "findById").mockResolvedValue(order as never);
    const updateLegacyOrder = vi.spyOn(OrderModel, "findByIdAndUpdate");
    const updateProduct = vi
      .spyOn(ProductModel, "updateOne")
      .mockResolvedValue({} as never);
    vi.spyOn(NotificationModel, "insertMany").mockResolvedValue([] as never);

    const response = await request(createApp())
      .put(`/api/admin/orders/${orderId}`)
      .set(authHeader())
      .send({ status: "Delivered" });

    expect(response.status).toBe(200);
    expect(order.fulfillments.map(item => item.status)).toEqual([
      "Delivered",
      "Delivered",
    ]);
    expect(order.fulfillments.map(item => item.stockStatus)).toEqual([
      "consumed",
      "consumed",
    ]);
    expect(updateLegacyOrder).not.toHaveBeenCalled();
    expect(updateProduct).toHaveBeenCalledTimes(2);
  });

  it("does not reactivate cancelled fulfillment or restore stock twice", async () => {
    const order = {
      _id: new mongoose.Types.ObjectId(orderId),
      orderId: "ORD-CANCELLED1",
      status: "Cancelled",
      deliveryStatus: "Cancelled",
      buyerId: "64b000000000000000000003",
      items: [
        {
          productId: new mongoose.Types.ObjectId(
            "64b000000000000000000004"
          ),
          quantity: 1,
        },
      ],
      fulfillments: [
        {
          sellerId: new mongoose.Types.ObjectId(
            "64b000000000000000000006"
          ),
          itemIndexes: [0],
          status: "Cancelled",
          stockStatus: "released",
          trackingHistory: [],
        },
      ],
      trackingHistory: [],
      save: vi.fn().mockResolvedValue(undefined),
    };
    vi.spyOn(OrderModel, "findById").mockResolvedValue(order as never);
    const updateLegacyOrder = vi.spyOn(OrderModel, "findByIdAndUpdate");
    const updateProduct = vi
      .spyOn(ProductModel, "updateOne")
      .mockResolvedValue({} as never);
    const app = createApp();

    const statusResponse = await request(app)
      .put(`/api/admin/orders/${orderId}`)
      .set(authHeader())
      .send({ status: "Delivered" });
    const deliveryResponse = await request(app)
      .put(`/api/admin/orders/${orderId}`)
      .set(authHeader())
      .send({
        trackingHistoryEntry: { status: "Reset to pending" },
        deliveryStatus: "Pending",
      });

    expect(statusResponse.status).toBe(409);
    expect(deliveryResponse.status).toBe(409);
    expect(order.fulfillments[0]).toMatchObject({
      status: "Cancelled",
      stockStatus: "released",
    });
    expect(order.save).not.toHaveBeenCalled();
    expect(updateLegacyOrder).not.toHaveBeenCalled();
    expect(updateProduct).not.toHaveBeenCalled();
  });

  it("rejects backward admin delivery transitions", async () => {
    const order = {
      _id: new mongoose.Types.ObjectId(orderId),
      orderId: "ORD-INTRANSIT1",
      status: "Shipped",
      deliveryStatus: "In Transit",
      buyerId: "64b000000000000000000003",
      items: [],
      fulfillments: [
        {
          sellerId: new mongoose.Types.ObjectId(
            "64b000000000000000000006"
          ),
          itemIndexes: [],
          status: "In Transit",
          stockStatus: "reserved",
          trackingHistory: [],
        },
      ],
      trackingHistory: [],
      save: vi.fn().mockResolvedValue(undefined),
    };
    vi.spyOn(OrderModel, "findById").mockResolvedValue(order as never);

    const response = await request(createApp())
      .put(`/api/admin/orders/${orderId}`)
      .set(authHeader())
      .send({
        trackingHistoryEntry: { status: "Reset to pending" },
        deliveryStatus: "Pending",
      });

    expect(response.status).toBe(409);
    expect(order.fulfillments[0].status).toBe("In Transit");
    expect(order.save).not.toHaveBeenCalled();
  });

  it("rejects invalid tracking statuses", async () => {
    const lookup = vi.spyOn(OrderModel, "findById");
    const response = await request(createApp())
      .put(`/api/admin/orders/${orderId}`)
      .set(authHeader())
      .send({
        trackingHistoryEntry: { status: "made-up-status" },
        deliveryStatus: "Made Up",
      });

    expect(response.status).toBe(400);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("rejects malformed order identifiers", async () => {
    const response = await request(createApp())
      .put("/api/admin/orders/not-an-id")
      .set(authHeader())
      .send({ status: "Packed" });

    expect(response.status).toBe(400);
  });
});
