import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuditModel } from "../models/Audit.js";
import { ComplaintModel } from "../models/Complaint.js";
import { OrderModel } from "../models/Order.js";
import { ProductModel } from "../models/Product.js";
import { UserModel } from "../models/User.js";
import adminRouter from "../routes/admin.js";

const userId = "64b000000000000000000001";
const jwtSecret = process.env.JWT_SECRET || "havestra_secret";

function createApp(role: "admin" | "buyer" | "seller") {
  const app = express();
  app.use("/api/admin", adminRouter);

  vi.spyOn(UserModel, "findById").mockReturnValue({
    select: vi.fn().mockResolvedValue({ _id: userId, role }),
  } as never);

  return app;
}

function authHeader() {
  const token = jwt.sign({ userId }, jwtSecret);
  return { Authorization: `Bearer ${token}` };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("admin dashboard API", () => {
  it("requires authentication", async () => {
    const response = await request(createApp("admin")).get(
      "/api/admin/dashboard"
    );

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Authentication token missing");
  });

  it.each(["buyer", "seller"] as const)(
    "denies %s accounts access to admin dashboard data",
    async role => {
      const response = await request(createApp(role))
        .get("/api/admin/dashboard")
        .set(authHeader());

      expect(response.status).toBe(403);
      expect(response.body.error).toBe("Access denied");
    }
  );

  it("returns the dashboard summary and safe recent activity for admins", async () => {
    const createdAt = new Date("2026-10-14T00:00:00.000Z");
    vi.spyOn(UserModel, "countDocuments")
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(3);
    vi.spyOn(ProductModel, "countDocuments").mockResolvedValue(8);
    vi.spyOn(OrderModel, "countDocuments")
      .mockResolvedValueOnce(19)
      .mockResolvedValueOnce(4);
    vi.spyOn(OrderModel, "aggregate").mockResolvedValue([{ total: 1250 }]);
    vi.spyOn(ComplaintModel, "countDocuments").mockResolvedValue(2);
    vi.spyOn(AuditModel, "find").mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      lean: vi
        .fn()
        .mockResolvedValue([{ action: "seller_approved", createdAt }]),
    } as never);

    const response = await request(createApp("admin"))
      .get("/api/admin/dashboard")
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      stats: {
        users: 12,
        sellersPending: 3,
        products: 8,
        orders: 19,
        totalSales: 1250,
        complaints: 2,
        deliveriesActive: 4,
      },
      recentActivity: [
        { description: "seller_approved", createdAt: createdAt.toISOString() },
      ],
    });
  });

  describe("admin audit API", () => {
    it("returns only allowlisted audit fields to administrators", async () => {
      const createdAt = new Date("2026-10-14T00:00:00.000Z");
      vi.spyOn(AuditModel, "find").mockReturnValue({
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue([
          {
            _id: "64b000000000000000000099",
            action: "seller_approved",
            createdAt,
            actorEmail: "private@example.com",
            targetEmail: "target@example.com",
            details: { phone: "private" },
          },
        ]),
      } as never);

      const response = await request(createApp("admin"))
        .get("/api/admin/audit?action=seller_approved")
        .set(authHeader());

      expect(response.status).toBe(200);
      const event = response.body.entries.find(
        (entry: { action: string }) => entry.action === "seller_approved"
      );
      expect(event).toEqual({
        id: "admin-64b000000000000000000099",
        timestamp: createdAt.toISOString(),
        action: "seller_approved",
        source: "admin_activity",
      });
      expect(JSON.stringify(response.body)).not.toContain(
        "private@example.com"
      );
      expect(JSON.stringify(response.body)).not.toContain("target@example.com");
      expect(response.body.totalPages).toBe(1);
    });

    it("validates pagination bounds", async () => {
      const response = await request(createApp("admin"))
        .get("/api/admin/audit?page=0&limit=101")
        .set(authHeader());

      expect(response.status).toBe(400);
    });
  });
});
