import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrderModel } from "../models/Order.js";
import { ProductModel } from "../models/Product.js";
import { ReviewModel } from "../models/Review.js";
import { UserModel } from "../models/User.js";
import dashboardRouter from "../routes/dashboard.js";

const sellerId = "64b000000000000000000001";
const buyerId = "64b000000000000000000002";
const jwtSecret = process.env.JWT_SECRET || "havestra_secret";

function createApp() {
  const app = express();
  app.use("/api", dashboardRouter);
  vi.spyOn(UserModel, "findById").mockReturnValue({
    select: vi.fn().mockResolvedValue({
      _id: sellerId,
      role: "seller",
    }),
  } as never);
  return app;
}

function authHeader() {
  const token = jwt.sign({ userId: sellerId }, jwtSecret);
  return { Authorization: `Bearer ${token}` };
}

afterEach(() => vi.restoreAllMocks());

describe("seller dashboard metrics", () => {
  it("calculates seller sales from seller-owned line items, not whole mixed carts", async () => {
    const createdAt = new Date();
    const orderQuery = {
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    vi.spyOn(OrderModel, "countDocuments")
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    vi.spyOn(ProductModel, "find").mockResolvedValue([] as never);
    vi.spyOn(OrderModel, "find")
      .mockReturnValueOnce(orderQuery as never)
      .mockResolvedValueOnce([
        {
          createdAt,
          items: [
            {
              sellerId,
              totalPrice: 40,
              quantity: 2,
            },
            {
              farmerId: sellerId,
              totalPrice: 35,
              quantity: 1,
            },
            {
              sellerId: buyerId,
              totalPrice: 120,
              quantity: 4,
            },
          ],
        },
      ] as never);
    vi.spyOn(OrderModel, "aggregate")
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ _id: buyerId, orders: 1, spent: 75 }])
      .mockResolvedValueOnce([]);
    vi.spyOn(ReviewModel, "countDocuments").mockResolvedValue(0);
    vi.spyOn(ReviewModel, "aggregate").mockResolvedValue([]);

    const response = await request(createApp())
      .get("/api/seller/dashboard")
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body.stats.totalSales).toBe(75);
    expect(response.body.stats.totalOrders).toBe(2);
    expect(response.body.customerMetrics.averageOrderValue).toBe(37.5);

    const todayLabel = createdAt.toLocaleDateString("en-US", {
      weekday: "short",
    });
    const todaySales = response.body.revenueHistory.find(
      (entry: { date: string }) => entry.date === todayLabel
    );
    expect(todaySales).toEqual({
      date: todayLabel,
      revenue: 75,
      orders: 1,
      productsSold: 3,
    });

    const customerAggregation = vi.mocked(OrderModel.aggregate).mock
      .calls[1][0];
    expect(customerAggregation).toContainEqual({
      $group: expect.objectContaining({
        spent: expect.objectContaining({
          $sum: expect.objectContaining({
            $ifNull: expect.arrayContaining(["$items.totalPrice"]),
          }),
        }),
      }),
    });
    expect(JSON.stringify(customerAggregation)).not.toContain("$totalAmount");
  });
});
