import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrderModel } from "../models/Order.js";
import { UserModel } from "../models/User.js";
import adminReportsRouter from "../routes/admin-reports.js";

const userId = "64b000000000000000000001";
const jwtSecret = process.env.JWT_SECRET || "havestra_secret";

function createApp() {
  const app = express();
  app.use("/api/admin/reports", adminReportsRouter);
  vi.spyOn(UserModel, "findById").mockReturnValue({
    select: vi.fn().mockResolvedValue({ _id: userId, role: "admin" }),
  } as never);
  return app;
}

function authHeader() {
  return { Authorization: `Bearer ${jwt.sign({ userId }, jwtSecret)}` };
}

afterEach(() => vi.restoreAllMocks());

describe("admin reports date filters", () => {
  it("rejects incomplete date ranges", async () => {
    const aggregate = vi.spyOn(OrderModel, "aggregate");
    const response = await request(createApp())
      .get("/api/admin/reports/summary?startDate=2026-01-01")
      .set(authHeader());

    expect(response.status).toBe(400);
    expect(aggregate).not.toHaveBeenCalled();
  });

  it("rejects impossible calendar dates", async () => {
    const aggregate = vi.spyOn(OrderModel, "aggregate");
    const response = await request(createApp())
      .get("/api/admin/reports/summary?startDate=2026-02-30&endDate=2026-03-01")
      .set(authHeader());

    expect(response.status).toBe(400);
    expect(aggregate).not.toHaveBeenCalled();
  });

  it("applies inclusive date boundaries to both report queries", async () => {
    const aggregate = vi.spyOn(OrderModel, "aggregate").mockResolvedValue([]);
    const range = "startDate=2026-01-01&endDate=2026-01-31";
    const app = createApp();

    const summary = await request(app)
      .get(`/api/admin/reports/summary?${range}`)
      .set(authHeader());
    const sellers = await request(app)
      .get(`/api/admin/reports/by-seller?${range}`)
      .set(authHeader());

    expect(summary.status).toBe(200);
    expect(sellers.status).toBe(200);
    const start = new Date("2026-01-01T00:00:00.000Z");
    const endExclusive = new Date("2026-02-01T00:00:00.000Z");
    expect(aggregate).toHaveBeenCalledTimes(3);
    expect(aggregate.mock.calls[0][0][0]).toEqual({
      $match: {
        status: "Delivered",
        $or: [
          { deliveredAt: { $gte: start, $lt: endExclusive } },
          { deliveredAt: null, createdAt: { $gte: start, $lt: endExclusive } },
        ],
      },
    });
    expect(aggregate.mock.calls[2][0][1]).toEqual({
      $match: {
        status: "Delivered",
        $or: [
          { deliveredAt: { $gte: start, $lt: endExclusive } },
          { deliveredAt: null, createdAt: { $gte: start, $lt: endExclusive } },
        ],
      },
    });
  });
});
