import { getJwtSecret } from "../utils/jwtSecret.js";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotificationModel } from "../models/Notification.js";
import { OrderModel } from "../models/Order.js";
import { ProductModel } from "../models/Product.js";
import { UserModel } from "../models/User.js";
import orderRouter from "../routes/orders.js";

const userId = "64b000000000000000000001";
const productId = "64b000000000000000000002";
const jwtSecret = process.env.JWT_SECRET || getJwtSecret();

function authHeader() {
  const token = jwt.sign({ userId }, jwtSecret);
  return { Authorization: `Bearer ${token}` };
}

function createApp(role = "buyer") {
  const app = express();
  app.use(express.json());
  app.use("/api/orders", orderRouter);

  const user = {
    _id: userId,
    name: "Test Buyer",
    phone: "09123456789",
    role,
  };
  vi.spyOn(UserModel, "findById")
    .mockReturnValueOnce({
      select: vi.fn().mockResolvedValue(user),
    } as never)
    .mockResolvedValue(user as never);

  return app;
}

function orderRequest(
  app: express.Express,
  body: Record<string, unknown> = {
    items: [{ productId, quantity: 1 }],
    shippingAddress: { street: "1 Farm Road", city: "Quezon City" },
  }
) {
  return request(app).post("/api/orders").set(authHeader()).send(body);
}

function availableProduct(stock = 5) {
  return {
    _id: productId,
    name: "Green beans",
    image: "green-beans.png",
    price: 25,
    stock,
    status: stock > 0 ? "Available" : "Out of Stock",
    isActive: true,
    approvalStatus: "approved",
    sellerId: "64b000000000000000000003",
    farmerId: "64b000000000000000000003",
  };
}

afterEach(() => vi.restoreAllMocks());

describe("checkout validation", () => {
  it("prevents sellers and admins from placing buyer orders", async () => {
    const findProduct = vi.spyOn(ProductModel, "findById");

    const response = await orderRequest(createApp("seller"));

    expect(response.status).toBe(403);
    expect(findProduct).not.toHaveBeenCalled();
  });

  it("accepts only Cash on Delivery", async () => {
    const findProduct = vi.spyOn(ProductModel, "findById");

    const response = await orderRequest(createApp(), {
      items: [{ productId, quantity: 1 }],
      shippingAddress: { street: "1 Farm Road" },
      paymentMethod: "card",
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      "Cash on Delivery is the only supported payment method"
    );
    expect(findProduct).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5, "not-a-number"])(
    "rejects invalid order quantity %s",
    async quantity => {
      const findProduct = vi.spyOn(ProductModel, "findById");

      const response = await orderRequest(createApp(), {
        items: [{ productId, quantity }],
        shippingAddress: { street: "1 Farm Road" },
      });

      expect(response.status).toBe(400);
      expect(findProduct).not.toHaveBeenCalled();
    }
  );

  it("rejects quantities exceeding current stock, including duplicate lines", async () => {
    vi.spyOn(ProductModel, "findById").mockResolvedValue(
      availableProduct(3) as never
    );

    const response = await orderRequest(createApp(), {
      items: [
        { productId, quantity: 2 },
        { productId, quantity: 2 },
      ],
      shippingAddress: { street: "1 Farm Road" },
    });

    expect(response.status).toBe(409);
    expect(response.body.error).toContain("does not have enough stock");
  });

  it("rejects unapproved listings at checkout", async () => {
    vi.spyOn(ProductModel, "findById").mockResolvedValue({
      ...availableProduct(),
      approvalStatus: "pending",
    } as never);

    const response = await orderRequest(createApp());

    expect(response.status).toBe(409);
    expect(response.body.error).toContain("no longer available");
  });

  it("derives totals from the current product price and normalizes COD", async () => {
    vi.spyOn(ProductModel, "findById").mockResolvedValue(
      availableProduct() as never
    );
    vi.spyOn(ProductModel, "findOneAndUpdate").mockResolvedValue(
      availableProduct(3) as never
    );
    vi.spyOn(OrderModel.prototype, "save").mockResolvedValue(
      undefined as never
    );
    vi.spyOn(NotificationModel, "insertMany").mockResolvedValue([] as never);

    const response = await orderRequest(createApp(), {
      items: [{ productId, quantity: 2 }],
      shippingAddress: { street: "1 Farm Road" },
      paymentMethod: "COD",
    });

    expect(response.status).toBe(201);
    expect(response.body.paymentMethod).toBe("cod");
    expect(response.body.totalAmount).toBe(50);
  });

  it("rejects checkout when atomic reservation finds stock changed after validation", async () => {
    let remainingStock = 1;
    vi.spyOn(ProductModel, "findById").mockResolvedValue(
      availableProduct(1) as never
    );
    vi.spyOn(ProductModel, "findOneAndUpdate").mockImplementation(
      async (filter: any, update: any) => {
        expect(filter.stock.$gte).toBe(1);
        if (remainingStock < -update.$inc.stock) return null as never;
        remainingStock += update.$inc.stock;
        return availableProduct(remainingStock) as never;
      }
    );
    vi.spyOn(OrderModel.prototype, "save").mockResolvedValue(
      undefined as never
    );
    vi.spyOn(NotificationModel, "insertMany").mockResolvedValue([] as never);

    const app = createApp();
    const buyer = {
      _id: userId,
      name: "Test Buyer",
      phone: "09123456789",
      role: "buyer",
    };
    let userLookups = 0;
    vi.spyOn(UserModel, "findById").mockImplementation(() => {
      userLookups += 1;
      return userLookups % 2 === 1
        ? ({
            select: vi.fn().mockResolvedValue(buyer),
          } as never)
        : (Promise.resolve(buyer) as never);
    });

    const first = await orderRequest(app);
    const second = await orderRequest(app);

    expect([first.status, second.status].sort()).toEqual([201, 409]);
    expect(remainingStock).toBe(0);
  });

  it("restores atomically reserved stock if saving the order fails", async () => {
    vi.spyOn(ProductModel, "findById").mockResolvedValue(
      availableProduct(5) as never
    );
    const findOneAndUpdate = vi
      .spyOn(ProductModel, "findOneAndUpdate")
      .mockResolvedValue(availableProduct(3) as never);
    vi.spyOn(OrderModel.prototype, "save").mockRejectedValue(
      new Error("order write failed")
    );

    const response = await orderRequest(createApp(), {
      items: [{ productId, quantity: 2 }],
      shippingAddress: { street: "1 Farm Road" },
    });

    expect(response.status).toBe(500);
    expect(response.body.error).toContain("stock was restored");
    expect(findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(findOneAndUpdate.mock.calls[1][1]).toMatchObject({
      $inc: { stock: 2 },
      $pull: { stockReservations: { orderId: expect.anything() } },
    });
  });
});
