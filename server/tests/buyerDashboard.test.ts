import { getJwtSecret } from "../utils/jwtSecret.js";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrderModel } from "../models/Order.js";
import { ProductModel } from "../models/Product.js";
import { UserModel } from "../models/User.js";
import dashboardRouter from "../routes/dashboard.js";

const buyerId = "64b000000000000000000002";
const jwtSecret = process.env.JWT_SECRET || getJwtSecret();

function createApp() {
  const app = express();
  app.use("/api", dashboardRouter);
  vi.spyOn(UserModel, "findById").mockReturnValue({
    select: vi.fn().mockResolvedValue({
      _id: buyerId,
      role: "buyer",
      cart: [],
    }),
  } as never);
  return app;
}

function authHeader() {
  const token = jwt.sign({ userId: buyerId }, jwtSecret);
  return { Authorization: `Bearer ${token}` };
}

afterEach(() => vi.restoreAllMocks());

describe("buyer dashboard metrics", () => {
  it("returns buyer-scoped order counts and delivered-order spending", async () => {
    const productQuery = {
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    const countResults = [4, 2, 1];
    const countDocuments = vi
      .spyOn(OrderModel, "countDocuments")
      .mockImplementation(
        () => Promise.resolve(countResults.shift() ?? 0) as never
      );
    const aggregate = vi
      .spyOn(OrderModel, "aggregate")
      .mockResolvedValue([{ _id: null, total: 875 }] as never);
    vi.spyOn(ProductModel, "find").mockReturnValue(productQuery as never);

    const response = await request(createApp())
      .get("/api/buyer")
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body.stats).toMatchObject({
      totalOrders: 4,
      pendingOrders: 2,
      inTransitOrders: 1,
      totalSpent: 875,
    });

    expect(countDocuments).toHaveBeenNthCalledWith(1, {
      buyerId,
    });
    expect(countDocuments).toHaveBeenNthCalledWith(2, {
      buyerId,
      $or: [{ deliveryStatus: "Pending" }, { status: "Pending" }],
    });
    expect(countDocuments).toHaveBeenNthCalledWith(3, {
      buyerId,
      $or: [{ deliveryStatus: "In Transit" }, { status: "In Transit" }],
    });

    const spendingMatch = vi.mocked(OrderModel.aggregate).mock.calls[0][0][0];
    expect(spendingMatch).toEqual({
      $match: {
        buyerId,
        $or: [{ status: "Delivered" }, { deliveryStatus: "Delivered" }],
      },
    });
    expect(aggregate).toHaveBeenCalledOnce();
  });

  it("returns zero spending and counts when there are no buyer orders", async () => {
    const productQuery = {
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    vi.spyOn(OrderModel, "countDocuments").mockResolvedValue(0);
    vi.spyOn(OrderModel, "aggregate").mockResolvedValue([]);
    vi.spyOn(ProductModel, "find").mockReturnValue(productQuery as never);

    const response = await request(createApp())
      .get("/api/buyer")
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body.stats).toMatchObject({
      totalOrders: 0,
      pendingOrders: 0,
      inTransitOrders: 0,
      totalSpent: 0,
    });
  });
});
