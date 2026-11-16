import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrderModel } from "../models/Order.js";
import { NotificationModel } from "../models/Notification.js";
import { UserModel } from "../models/User.js";
import adminOrdersRouter from "../routes/admin-orders.js";

const userId = "64b000000000000000000001";
const orderId = "64b000000000000000000002";
const jwtSecret = process.env.JWT_SECRET || "havestra_secret";

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
