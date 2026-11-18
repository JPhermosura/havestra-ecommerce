import { getJwtSecret } from "../utils/jwtSecret.js";
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
const jwtSecret = process.env.JWT_SECRET || getJwtSecret();

function createApp(role = "seller") {
  const app = express();
  app.use("/api", dashboardRouter);
  vi.spyOn(UserModel, "findById").mockReturnValue({
    select: vi.fn().mockResolvedValue({
      _id: sellerId,
      role,
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
  it("counts seller products, excludes cancelled orders, and totals delivered seller items", async () => {
    const createdAt = new Date();
    const orderQuery = {
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    vi.spyOn(OrderModel, "countDocuments")
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    vi.spyOn(ProductModel, "find").mockResolvedValue([
      { _id: "active-product" },
      { _id: "inactive-product" },
    ] as never);
    vi.spyOn(OrderModel, "find")
      .mockReturnValueOnce(orderQuery as never)
      .mockResolvedValueOnce([
        {
          createdAt,
          status: "Delivered",
          deliveryStatus: "Delivered",
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
      .mockResolvedValueOnce([{ _id: null, totalSales: 75 }])
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
    expect(response.body.stats.totalProducts).toBe(2);
    expect(response.body.stats.pendingOrders).toBe(1);
    expect(response.body.stats.inTransitOrders).toBe(0);
    expect(response.body.stats.deliveredOrders).toBe(1);
    expect(response.body.stats.cancelledOrders).toBe(1);
    expect(response.body.orderStatusSummary).toEqual([
      { status: "Pending", count: 1 },
      { status: "In Transit", count: 0 },
      { status: "Delivered", count: 1 },
      { status: "Cancelled", count: 1 },
    ]);
    expect(response.body.stats).toMatchObject({
      totalSales: 75,
      totalOrders: 2,
      totalProducts: 2,
      pendingOrders: 1,
      inTransitOrders: 0,
      deliveredOrders: 1,
      cancelledOrders: 1,
    });
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

    const salesAggregation = vi.mocked(OrderModel.aggregate).mock.calls[0][0];
    expect(JSON.stringify(salesAggregation)).toContain(
      '"deliveryStatus":{"$in":["Delivered"]}'
    );
    expect(JSON.stringify(salesAggregation)).toContain('"items.sellerId"');
    expect(JSON.stringify(salesAggregation)).not.toContain("$totalAmount");

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

    expect(vi.mocked(ProductModel.find).mock.calls[0][0]).toMatchObject({
      $or: expect.arrayContaining([{ sellerId }, { farmerId: sellerId }]),
    });
    expect(vi.mocked(ProductModel.find).mock.calls[0][0]).not.toHaveProperty(
      "status"
    );

    const totalOrdersQuery = vi.mocked(OrderModel.countDocuments).mock
      .calls[0][0];
    expect(JSON.stringify(totalOrdersQuery)).toContain(
      '"status":{"$ne":"Cancelled"}'
    );
    expect(JSON.stringify(totalOrdersQuery)).toContain(
      '"deliveryStatus":{"$ne":"Cancelled"}'
    );
  });

  it("returns all dashboard metrics and status counts as zero when the seller has no records", async () => {
    vi.spyOn(OrderModel, "countDocuments").mockResolvedValue(0);
    vi.spyOn(ProductModel, "find").mockResolvedValue([] as never);
    vi.spyOn(OrderModel, "find")
      .mockReturnValueOnce({
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      } as never)
      .mockResolvedValueOnce([] as never);
    vi.spyOn(OrderModel, "aggregate").mockResolvedValue([]);
    vi.spyOn(ReviewModel, "countDocuments").mockResolvedValue(0);
    vi.spyOn(ReviewModel, "aggregate").mockResolvedValue([]);

    const response = await request(createApp())
      .get("/api/seller/dashboard")
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body.stats).toMatchObject({
      totalSales: 0,
      totalOrders: 0,
      totalProducts: 0,
      pendingOrders: 0,
      inTransitOrders: 0,
      deliveredOrders: 0,
      cancelledOrders: 0,
    });
    expect(response.body.orderStatusSummary).toEqual([
      { status: "Pending", count: 0 },
      { status: "In Transit", count: 0 },
      { status: "Delivered", count: 0 },
      { status: "Cancelled", count: 0 },
    ]);
  });

  it("restricts seller dashboard metrics to seller accounts", async () => {
    const countDocuments = vi.spyOn(OrderModel, "countDocuments");
    const response = await request(createApp("buyer"))
      .get("/api/seller/dashboard")
      .set(authHeader());

    expect(response.status).toBe(403);
    expect(countDocuments).not.toHaveBeenCalled();
  });
});
