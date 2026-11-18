import { getJwtSecret } from "../utils/jwtSecret.js";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotificationModel } from "../models/Notification.js";
import { OrderModel } from "../models/Order.js";
import { ProductModel } from "../models/Product.js";
import { ReviewModel } from "../models/Review.js";
import { UserModel } from "../models/User.js";
import notificationRouter from "../routes/notifications.js";
import orderRouter from "../routes/orders.js";
import productRouter from "../routes/products.js";
import cartRouter from "../routes/cart.js";
import reviewRouter from "../routes/reviews.js";
import adminProductsRouter from "../routes/admin-products.js";

const userId = "64b000000000000000000001";
const productId = "64b000000000000000000002";
const orderId = "64b000000000000000000003";
const buyerId = "64b000000000000000000004";
const jwtSecret = process.env.JWT_SECRET || getJwtSecret();

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
      select: vi.fn().mockReturnThis(),
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
      isActive: { $ne: false },
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
      select: vi.fn().mockReturnThis(),
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

  describe("deactivated product purchases", () => {
    function createBuyerApp() {
      const app = express();
      app.use(express.json());
      app.use("/api/cart", cartRouter);
      app.use("/api/orders", orderRouter);
      const buyer = {
        _id: userId,
        name: "Test Buyer",
        role: "buyer",
        cart: [],
        save: vi.fn().mockResolvedValue(undefined),
      };
      vi.spyOn(UserModel, "findById")
        .mockReturnValueOnce({
          select: vi.fn().mockResolvedValue(buyer),
        } as never)
        .mockResolvedValue(buyer as never);
      return app;
    }

    it("prevents adding a deactivated product to the cart", async () => {
      vi.spyOn(ProductModel, "findById").mockResolvedValue({
        _id: productId,
        name: "Green beans",
        isActive: false,
      } as never);

      const response = await request(createBuyerApp())
        .post("/api/cart")
        .set(authHeader())
        .send({ productId, quantity: 1 });

      expect(response.status).toBe(409);
    });

    it("prevents checkout of a product deactivated after it entered the cart", async () => {
      vi.spyOn(ProductModel, "findById").mockResolvedValue({
        _id: productId,
        name: "Green beans",
        isActive: false,
      } as never);

      const response = await request(createBuyerApp())
        .post("/api/orders")
        .set(authHeader())
        .send({
          items: [{ productId, quantity: 1 }],
          shippingAddress: { street: "1 Farm Road" },
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain("no longer available");
    });
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
    const imageBytes = await sharp({
      create: {
        width: 32,
        height: 24,
        channels: 3,
        background: { r: 30, g: 120, b: 60 },
      },
    })
      .png()
      .toBuffer();

    const response = await request(createSellerApp())
      .post("/api/products")
      .set(authHeader())
      .send({
        name: "Green beans",
        title: "Green beans",
        price: 25,
        stock: 12,
        category: "Vegetables",
        image: `data:image/png;base64,${imageBytes.toString("base64")}`,
      });

    expect(response.status).toBe(201);
    expect(save).toHaveBeenCalled();
    expect(response.body.approvalStatus).toBe("pending");
  });

  it("persists uploaded image bytes and assigns the authenticated seller", async () => {
    vi.spyOn(ProductModel.prototype, "save").mockResolvedValue(
      undefined as never
    );
    const imageBytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lvsAAAAASUVORK5CYII=",
      "base64"
    );

    const response = await request(createSellerApp())
      .post("/api/products")
      .set(authHeader())
      .field(
        "productData",
        JSON.stringify({
          name: "Green beans",
          title: "Green beans",
          price: 25,
          stock: 12,
          category: "Vegetables",
          sellerId: buyerId,
        })
      )
      .attach("images", imageBytes, {
        filename: "green-beans.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(201);
    expect(response.body.image).toBe(
      `data:image/png;base64,${imageBytes.toString("base64")}`
    );
    expect(String(response.body.sellerId)).toBe(userId);
  });

  it("rejects unsupported product image types", async () => {
    const response = await request(createSellerApp())
      .post("/api/products")
      .set(authHeader())
      .field(
        "productData",
        JSON.stringify({
          name: "Green beans",
          title: "Green beans",
          price: 25,
          stock: 12,
          category: "Vegetables",
        })
      )
      .attach("images", Buffer.from("not an image"), {
        filename: "document.txt",
        contentType: "text/plain",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/JPG, JPEG, PNG, or WEBP/);
  });

  it("rejects files that claim an image MIME type but are not valid images", async () => {
    const response = await request(createSellerApp())
      .post("/api/products")
      .set(authHeader())
      .field(
        "productData",
        JSON.stringify({
          name: "Green beans",
          title: "Green beans",
          price: 25,
          stock: 12,
          category: "Vegetables",
        })
      )
      .attach("images", Buffer.from("not actually an image"), {
        filename: "green-beans.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/readable supported image/);
  });

  it("rejects product images larger than 5 MB", async () => {
    const response = await request(createSellerApp())
      .post("/api/products")
      .set(authHeader())
      .field(
        "productData",
        JSON.stringify({
          name: "Green beans",
          title: "Green beans",
          price: 25,
          stock: 12,
          category: "Vegetables",
        })
      )
      .attach("images", Buffer.alloc(5 * 1024 * 1024 + 1), {
        filename: "green-beans.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/5 MB or smaller/);
  });

  it("allows the listing owner to deactivate a product", async () => {
    const product = {
      _id: productId,
      isActive: true,
      sellerId: userId,
      farmerId: userId,
      save: vi.fn().mockResolvedValue(undefined),
    };
    vi.spyOn(ProductModel, "findById").mockResolvedValue(product as never);

    const response = await request(createSellerApp())
      .patch(`/api/products/${productId}/active`)
      .set(authHeader())
      .send({ isActive: false });

    expect(response.status).toBe(200);
    expect(product.isActive).toBe(false);
    expect(product.save).toHaveBeenCalled();
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
      moderationReason: "",
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

  it("limits the number of buffered review images", async () => {
    const response = await request(createReviewApp())
      .post("/api/reviews")
      .set(authHeader())
      .field("productId", productId)
      .field("orderId", orderId)
      .field("rating", "5")
      .field("title", "Fresh")
      .field("comment", "Fresh produce")
      .attach("images", Buffer.from("image-1"), {
        filename: "image-1.jpg",
        contentType: "image/jpeg",
      })
      .attach("images", Buffer.from("image-2"), {
        filename: "image-2.jpg",
        contentType: "image/jpeg",
      })
      .attach("images", Buffer.from("image-3"), {
        filename: "image-3.jpg",
        contentType: "image/jpeg",
      })
      .attach("images", Buffer.from("image-4"), {
        filename: "image-4.jpg",
        contentType: "image/jpeg",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Upload up to 3 review images.");
  });

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
    const reviewImage = await sharp({
      create: {
        width: 64,
        height: 64,
        channels: 3,
        background: { r: 60, g: 120, b: 70 },
      },
    })
      .png()
      .toBuffer();
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
      .field("comment", "Fresh produce")
      .attach("images", reviewImage, {
        filename: "fresh-produce.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(201);
    expect(response.body.isVerified).toBe(true);
    expect(response.body.images).toHaveLength(1);
    expect(response.body.images[0]).toMatch(/^data:image\/jpeg;base64,/);
    expect(updateProduct).toHaveBeenCalledWith(
      { _id: expect.anything() },
      { $set: { rating: 4.5, reviews: 2 } }
    );
  });

  it("rejects malformed image content before creating a review", async () => {
    vi.spyOn(ProductModel, "findById").mockResolvedValue({
      _id: productId,
    } as never);
    vi.spyOn(OrderModel, "findOne").mockResolvedValue({
      _id: orderId,
    } as never);
    vi.spyOn(ReviewModel, "findOne").mockResolvedValue(null);
    const saveReview = vi.spyOn(ReviewModel.prototype, "save");

    const response = await request(createReviewApp())
      .post("/api/reviews")
      .set(authHeader())
      .field("productId", productId)
      .field("orderId", orderId)
      .field("rating", "5")
      .field("title", "Fresh")
      .field("comment", "Fresh produce")
      .attach("images", Buffer.from("not actually an image"), {
        filename: "fresh-produce.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/could not be decoded/);
    expect(saveReview).not.toHaveBeenCalled();
  });

  it("rejects unsupported review image types", async () => {
    const saveReview = vi.spyOn(ReviewModel.prototype, "save");

    const response = await request(createReviewApp())
      .post("/api/reviews")
      .set(authHeader())
      .field("productId", productId)
      .field("orderId", orderId)
      .field("rating", "5")
      .field("title", "Fresh")
      .field("comment", "Fresh produce")
      .attach("images", Buffer.from("not an image"), {
        filename: "notes.txt",
        contentType: "text/plain",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/JPG, JPEG, PNG, or WEBP/);
    expect(saveReview).not.toHaveBeenCalled();
  });

  it("rejects review images larger than 5 MB", async () => {
    const response = await request(createReviewApp())
      .post("/api/reviews")
      .set(authHeader())
      .field("productId", productId)
      .field("orderId", orderId)
      .field("rating", "5")
      .field("title", "Fresh")
      .field("comment", "Fresh produce")
      .attach("images", Buffer.alloc(5 * 1024 * 1024 + 1), {
        filename: "fresh-produce.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      "Each review image must be 5 MB or smaller."
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
          message: "A seller's items in order ORD-TEST1234 are now in transit.",
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
