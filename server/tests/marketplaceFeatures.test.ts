import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotificationModel } from "../models/Notification.js";
import { OrderModel } from "../models/Order.js";
import { ProductModel } from "../models/Product.js";
import { ReviewModel } from "../models/Review.js";
import { UserModel } from "../models/User.js";
import notificationRouter from "../routes/notifications.js";
import orderRouter from "../routes/orders.js";
import productRouter from "../routes/products.js";
import reviewRouter from "../routes/reviews.js";
import adminProductsRouter from "../routes/admin-products.js";

const userId = "64b000000000000000000001";
const productId = "64b000000000000000000002";
const orderId = "64b000000000000000000003";
const buyerId = "64b000000000000000000004";
const jwtSecret = process.env.JWT_SECRET || "havestra_secret";

function authHeader() {
  const token = jwt.sign({ userId }, jwtSecret);
  return { Authorization: `Bearer ${token}` };
}

function mockAuthenticatedUser(role = "buyer") {
  vi.spyOn(UserModel, "findById").mockReturnValue({
    select: vi.fn().mockResolvedValue({
      _id: userId,
      name: "Test User",
      role,
      isIdVerified: role === "seller",
      idVerificationStatus: role === "seller" ? "verified" : "not_submitted",
      isSellerApproved: role === "seller",
    }),
  } as never);
}

afterEach(() => vi.restoreAllMocks());

describe("product discovery", () => {
  it("maps UI sorting values and treats search input as literal text", async () => {
    const cursor = {
      sort: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    };
    vi.spyOn(ProductModel, "find").mockReturnValue(cursor as never);

    const response = await request(
      express().use("/api/products", productRouter)
    ).get("/api/products?search=apple.%2B&sortBy=price-low&buyerOnly=true");

    expect(response.status).toBe(200);
    expect(cursor.sort).toHaveBeenCalledWith({ price: 1 });
    expect(vi.mocked(ProductModel.find).mock.calls[0][0]).toMatchObject({
      $or: expect.arrayContaining([
        { name: { $regex: "apple\\.\\+", $options: "i" } },
      ]),
    });
    expect(vi.mocked(ProductModel.find).mock.calls[0][0]).not.toHaveProperty(
      "availability"
    );
  });

  it("never exposes pending or rejected listings, including showAll requests", async () => {
    const cursor = {
      sort: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    };
    vi.spyOn(ProductModel, "find").mockReturnValue(cursor as never);

    await request(express().use("/api/products", productRouter)).get(
      "/api/products?showAll=true"
    );

    expect(vi.mocked(ProductModel.find).mock.calls[0][0]).toMatchObject({
      approvalStatus: { $nin: ["pending", "rejected"] },
    });
  });
});

describe("seller inventory", () => {
  function createSellerApp() {
    const app = express();
    app.use(express.json());
    app.use("/api/products", productRouter);
    mockAuthenticatedUser("seller");
    return app;
  }

  it("validates stock and emits a notification when stock becomes low", async () => {
    const product = {
      _id: productId,
      title: "Green beans",
      stock: 8,
      sellerId: userId,
      farmerId: userId,
      save: vi.fn().mockResolvedValue(undefined),
    };
    vi.spyOn(ProductModel, "findById").mockResolvedValue(product as never);
    const insertMany = vi
      .spyOn(NotificationModel, "insertMany")
      .mockResolvedValue([] as never);

    const response = await request(createSellerApp())
      .patch(`/api/products/${productId}/inventory`)
      .set(authHeader())
      .send({ stock: 5 });

    expect(response.status).toBe(200);
    expect(product.stock).toBe(5);
    expect(product.save).toHaveBeenCalled();
    expect(insertMany).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          userId,
          type: "inventory",
          title: "Low stock alert",
        }),
      ],
      { ordered: false }
    );
  });

  it("rejects fractional and negative stock quantities", async () => {
    const findProduct = vi.spyOn(ProductModel, "findById");
    const response = await request(createSellerApp())
      .patch(`/api/products/${productId}/inventory`)
      .set(authHeader())
      .send({ stock: -1 });

    expect(response.status).toBe(400);
    expect(findProduct).not.toHaveBeenCalled();
  });

  it("prevents a seller from updating another seller's inventory", async () => {
    vi.spyOn(ProductModel, "findById").mockResolvedValue({
      _id: productId,
      sellerId: buyerId,
      farmerId: buyerId,
      stock: 8,
      save: vi.fn(),
    } as never);

    const response = await request(createSellerApp())
      .patch(`/api/products/${productId}/inventory`)
      .set(authHeader())
      .send({ stock: 4 });

    expect(response.status).toBe(403);
  });

  it("submits newly created seller listings for review", async () => {
    const save = vi
      .spyOn(ProductModel.prototype, "save")
      .mockResolvedValue(undefined as never);

    const response = await request(createSellerApp())
      .post("/api/products")
      .set(authHeader())
      .send({
        name: "Green beans",
        title: "Green beans",
        price: 25,
        stock: 12,
        category: "Vegetables",
      });

    expect(response.status).toBe(201);
    expect(save).toHaveBeenCalled();
    expect(response.body.approvalStatus).toBe("pending");
  });
});

describe("admin listing moderation", () => {
  function createAdminApp() {
    const app = express();
    app.use(express.json());
    app.use("/api/admin/products", adminProductsRouter);
    mockAuthenticatedUser("admin");
    return app;
  }

  it("does not allow generic edits to bypass listing moderation", async () => {
    const updateProduct = vi.spyOn(ProductModel, "findById");
    const response = await request(createAdminApp())
      .put(`/api/admin/products/${productId}`)
      .set(authHeader())
      .send({ approvalStatus: "approved" });

    expect(response.status).toBe(400);
    expect(updateProduct).not.toHaveBeenCalled();
  });

  it("requires a reason and records a rejection decision", async () => {
    const product = {
      _id: productId,
      title: "Green beans",
      sellerId: userId,
      approvalStatus: "pending",
      save: vi.fn().mockResolvedValue(undefined),
    };
    vi.spyOn(ProductModel, "findById").mockResolvedValue(product as never);
    vi.spyOn(NotificationModel, "insertMany").mockResolvedValue([] as never);

    const response = await request(createAdminApp())
      .put(`/api/admin/products/${productId}/reject`)
      .set(authHeader())
      .send({ reason: "Missing harvest details" });

    expect(response.status).toBe(200);
    expect(product.approvalStatus).toBe("rejected");
    expect(product.moderationReason).toBe("Missing harvest details");
    expect(product.save).toHaveBeenCalled();
  });
});

describe("verified product reviews", () => {
  function createReviewApp() {
    const app = express();
    app.use(express.json());
    app.use("/api/reviews", reviewRouter);
    mockAuthenticatedUser();
    return app;
  }

  it("recognizes the persisted Delivered status for review eligibility", async () => {
    mockAuthenticatedUser();
    const findDeliveredOrder = vi
      .spyOn(OrderModel, "findOne")
      .mockResolvedValue(null);
    vi.spyOn(ReviewModel, "findOne").mockResolvedValue(null);
    const app = express();
    app.use("/api/reviews", reviewRouter);

    const response = await request(app)
      .get(`/api/reviews/eligible/${productId}`)
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(findDeliveredOrder).toHaveBeenCalledWith({
      buyerId: userId,
      "items.productId": productId,
      status: "Delivered",
    });
  });

  it("rejects a review unless the specified order is delivered and belongs to the buyer", async () => {
    vi.spyOn(ProductModel, "findById").mockResolvedValue({
      _id: productId,
    } as never);
    vi.spyOn(OrderModel, "findOne").mockResolvedValue(null);
    const saveReview = vi
      .spyOn(ReviewModel.prototype, "save")
      .mockResolvedValue(undefined as never);

    const response = await request(createReviewApp())
      .post("/api/reviews")
      .set(authHeader())
      .field("productId", productId)
      .field("orderId", orderId)
      .field("rating", "5")
      .field("title", "Fresh")
      .field("comment", "Fresh produce");

    expect(response.status).toBe(403);
    expect(saveReview).not.toHaveBeenCalled();
  });

  it("marks an eligible review verified and updates the product rating aggregate", async () => {
    vi.spyOn(ProductModel, "findById").mockResolvedValue({
      _id: productId,
    } as never);
    vi.spyOn(OrderModel, "findOne").mockResolvedValue({
      _id: orderId,
    } as never);
    vi.spyOn(ReviewModel, "findOne").mockResolvedValue(null);
    vi.spyOn(ReviewModel.prototype, "save").mockResolvedValue(
      undefined as never
    );
    vi.spyOn(ReviewModel, "aggregate").mockResolvedValue([
      { average: 4.5, count: 2 },
    ] as never);
    const updateProduct = vi
      .spyOn(ProductModel, "updateOne")
      .mockResolvedValue({ acknowledged: true } as never);

    const response = await request(createReviewApp())
      .post("/api/reviews")
      .set(authHeader())
      .field("productId", productId)
      .field("orderId", orderId)
      .field("rating", "5")
      .field("title", "Fresh")
      .field("comment", "Fresh produce");

    expect(response.status).toBe(201);
    expect(response.body.isVerified).toBe(true);
    expect(updateProduct).toHaveBeenCalledWith(
      { _id: expect.anything() },
      { $set: { rating: 4.5, reviews: 2 } }
    );
  });
});

describe("order status notifications", () => {
  it("notifies the buyer when a seller advances delivery status", async () => {
    mockAuthenticatedUser("seller");
    const order = {
      _id: orderId,
      orderId: "ORD-TEST1234",
      buyerId,
      deliveryStatus: "Pending",
      status: "Order Placed",
      items: [{ sellerId: userId }],
      trackingHistory: [],
      save: vi.fn().mockResolvedValue(undefined),
    };
    vi.spyOn(OrderModel, "findById").mockResolvedValue(order as never);
    const insertMany = vi
      .spyOn(NotificationModel, "insertMany")
      .mockResolvedValue([] as never);
    const app = express();
    app.use(express.json());
    app.use("/api/orders", orderRouter);

    const response = await request(app)
      .put(`/api/orders/${orderId}/status`)
      .set(authHeader())
      .send({ status: "In Transit" });

    expect(response.status).toBe(200);
    expect(insertMany).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          userId: buyerId,
          type: "delivery",
          title: "Delivery update",
          message: "Order ORD-TEST1234 is now in transit.",
        }),
      ],
      { ordered: false }
    );
  });
});

describe("notification ownership", () => {
  it("scopes read updates to the authenticated user", async () => {
    mockAuthenticatedUser();
    const findOneAndUpdate = vi
      .spyOn(NotificationModel, "findOneAndUpdate")
      .mockResolvedValue({ _id: orderId } as never);
    const app = express();
    app.use("/api/notifications", notificationRouter);

    const response = await request(app)
      .patch(`/api/notifications/${orderId}/read`)
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { _id: orderId, userId },
      expect.any(Object),
      { new: true }
    );
  });
});
