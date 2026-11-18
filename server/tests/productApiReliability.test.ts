import { getJwtSecret } from "../utils/jwtSecret.js";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import sharp from "sharp";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import apiErrorHandler from "../middleware/apiErrorHandler.js";
import { ProductModel } from "../models/Product.js";
import { UserModel } from "../models/User.js";
import productRouter from "../routes/products.js";

const sellerId = "64b000000000000000000001";
const productId = "64b000000000000000000002";
const jwtSecret = process.env.JWT_SECRET || getJwtSecret();
let imageData = "";
let pngBuffer = Buffer.alloc(0);

function authHeader(userId = sellerId) {
  const token = jwt.sign({ userId }, jwtSecret);
  return { Authorization: `Bearer ${token}` };
}

function createApp() {
  const app = express();
  app.use(express.json({ limit: "20mb" }));
  app.use(express.urlencoded({ extended: true, limit: "20mb" }));
  app.use("/api/products", productRouter);
  app.use(apiErrorHandler);
  return app;
}

function mockSeller(
  overrides: Record<string, unknown> = {},
  userId = sellerId
) {
  vi.spyOn(UserModel, "findById").mockReturnValue({
    select: vi.fn().mockResolvedValue({
      _id: userId,
      role: "seller",
      isIdVerified: true,
      idVerificationStatus: "verified",
      isSellerApproved: true,
      name: "QA Seller",
      ...overrides,
    }),
  } as never);
}

function validProductData() {
  return {
    name: "QA Test Beans",
    title: "QA Test Beans",
    description: "Synthetic API test product",
    category: "Vegetables",
    price: 42,
    stock: 5,
    image: imageData,
  };
}

beforeAll(async () => {
  pngBuffer = await sharp({
    create: {
      width: 32,
      height: 24,
      channels: 3,
      background: { r: 30, g: 120, b: 60 },
    },
  })
    .png()
    .toBuffer();
  imageData = `data:image/png;base64,${pngBuffer.toString("base64")}`;
});

afterEach(() => vi.restoreAllMocks());

describe("product API request validation", () => {
  it("omits stock reservations from public product responses", async () => {
    const storedProduct = {
      _id: productId,
      name: "QA Test Beans",
      title: "QA Test Beans",
      stockReservations: [
        { orderId: "64b000000000000000000003", quantity: 2 },
      ],
    };
    const { stockReservations, ...publicProduct } = storedProduct;
    expect(stockReservations).toHaveLength(1);

    const listSelect = vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue([publicProduct]),
      }),
    });
    const detailSelect = vi.fn().mockResolvedValue(publicProduct);

    vi.spyOn(ProductModel, "find").mockReturnValue({
      select: listSelect,
    } as never);
    vi.spyOn(ProductModel, "findOne").mockReturnValue({
      select: detailSelect,
    } as never);

    const app = createApp();
    const [list, detail] = await Promise.all([
      request(app).get("/api/products"),
      request(app).get(`/api/products/${productId}`),
    ]);

    expect(list.status).toBe(200);
    expect(detail.status).toBe(200);
    expect(listSelect).toHaveBeenCalledWith("-stockReservations");
    expect(detailSelect).toHaveBeenCalledWith("-stockReservations");
    expect(list.body.products[0]).not.toHaveProperty("stockReservations");
    expect(detail.body).not.toHaveProperty("stockReservations");
  });

  it.each([
    [
      "missing name",
      (data: Record<string, unknown>) => ({ ...data, name: " " }),
    ],
    [
      "missing category",
      (data: Record<string, unknown>) => ({ ...data, category: undefined }),
    ],
    [
      "invalid price",
      (data: Record<string, unknown>) => ({ ...data, price: -1 }),
    ],
    [
      "negative stock",
      (data: Record<string, unknown>) => ({ ...data, stock: -1 }),
    ],
    [
      "missing image",
      (data: Record<string, unknown>) => ({ ...data, image: undefined }),
    ],
    [
      "unsupported image data",
      (data: Record<string, unknown>) => ({
        ...data,
        image: "data:image/svg+xml;base64,PHN2Zy8+",
      }),
    ],
  ])("returns 400 for %s", async (_label, makeInvalid) => {
    mockSeller();
    const response = await request(createApp())
      .post("/api/products")
      .set(authHeader())
      .send(makeInvalid(validProductData()));

    expect(response.status).toBe(400);
    expect(response.body.error).toEqual(expect.any(String));
    expect(response.body.stack).toBeUndefined();
  });

  it("returns 400 for malformed multipart productData without crashing", async () => {
    mockSeller();
    const response = await request(createApp())
      .post("/api/products")
      .set(authHeader())
      .field("productData", "{broken");

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/valid JSON/i);
  });

  it("returns a safe 400 response for malformed JSON bodies", async () => {
    const response = await request(createApp())
      .post("/api/products")
      .set("Content-Type", "application/json")
      .send('{"productData":');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Malformed request body." });
    expect(JSON.stringify(response.body)).not.toMatch(/stack|node_modules/i);
  });

  it("rejects image bytes that do not match the declared image type", async () => {
    mockSeller();
    const response = await request(createApp())
      .post("/api/products")
      .set(authHeader())
      .field(
        "productData",
        JSON.stringify({
          ...validProductData(),
          image: undefined,
        })
      )
      .attach("images", Buffer.from("not an image"), {
        filename: "test.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/readable supported image/i);
  });

  it("accepts a valid synthetic image upload and returns 201", async () => {
    mockSeller();
    vi.spyOn(ProductModel.prototype, "save").mockResolvedValue(
      undefined as never
    );
    const response = await request(createApp())
      .post("/api/products")
      .set(authHeader())
      .field(
        "productData",
        JSON.stringify({ ...validProductData(), image: undefined })
      )
      .attach("images", pngBuffer, {
        filename: "test.png",
        contentType: "image/png",
      });

    expect(response.status).toBe(201);
    expect(response.body.title).toBe("QA Test Beans");
  });

  it("rejects invalid IDs before querying and returns 404 for missing products", async () => {
    mockSeller();
    const findById = vi.spyOn(ProductModel, "findById");
    const findOne = vi.spyOn(ProductModel, "findOne");
    const app = createApp();

    const invalidIdResponses = await Promise.all([
      request(app).get("/api/products/not-an-id"),
      request(app)
        .put("/api/products/not-an-id")
        .set(authHeader())
        .send({ price: 20 }),
      request(app)
        .patch("/api/products/not-an-id/active")
        .set(authHeader())
        .send({ isActive: false }),
      request(app)
        .patch("/api/products/not-an-id/inventory")
        .set(authHeader())
        .send({ stock: 5 }),
      request(app).delete("/api/products/not-an-id").set(authHeader()),
    ]);

    expect(invalidIdResponses.map(response => response.status)).toEqual([
      400, 400, 400, 400, 400,
    ]);
    expect(findById).not.toHaveBeenCalled();
    expect(findOne).not.toHaveBeenCalled();

    findById.mockResolvedValue(null);
    const missing = await request(app)
      .put(`/api/products/${productId}`)
      .set(authHeader())
      .send({ price: 20 });
    expect(missing.status).toBe(404);
  });

  it("denies product creation to buyers", async () => {
    mockSeller({ role: "buyer" });
    const save = vi.spyOn(ProductModel.prototype, "save");
    const response = await request(createApp())
      .post("/api/products")
      .set(authHeader())
      .send(validProductData());

    expect(response.status).toBe(403);
    expect(save).not.toHaveBeenCalled();
  });

  it("rejects invalid update values and prevents updates by another seller", async () => {
    mockSeller();
    const save = vi.fn().mockResolvedValue(undefined);
    const product = {
      _id: productId,
      sellerId,
      farmerId: sellerId,
      approvalStatus: "approved",
      save,
    };
    vi.spyOn(ProductModel, "findById").mockResolvedValue(product as never);
    const app = createApp();

    const invalidPrice = await request(app)
      .put(`/api/products/${productId}`)
      .set(authHeader())
      .send({ price: true });
    expect(invalidPrice.status).toBe(400);
    expect(save).not.toHaveBeenCalled();

    const otherOwnerProduct = {
      ...product,
      sellerId: "64b000000000000000000004",
      farmerId: "64b000000000000000000004",
    };
    vi.spyOn(ProductModel, "findById").mockResolvedValue(
      otherOwnerProduct as never
    );
    const forbidden = await request(app)
      .put(`/api/products/${productId}`)
      .set(authHeader())
      .send({ price: 20 });
    expect(forbidden.status).toBe(403);
    expect(save).not.toHaveBeenCalled();
  });

  it("returns safe 500 responses for unexpected persistence failures", async () => {
    mockSeller();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(ProductModel.prototype, "save").mockRejectedValue(
      new Error("private database detail")
    );
    const response = await request(createApp())
      .post("/api/products")
      .set(authHeader())
      .send(validProductData());

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: "Unable to process the product request.",
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /private database detail/i
    );
  });

  it("returns 401 for missing and expired authentication tokens", async () => {
    const app = createApp();
    const missing = await request(app)
      .post("/api/products")
      .send(validProductData());
    expect(missing.status).toBe(401);

    mockSeller();
    const expiredToken = jwt.sign({ userId: sellerId }, jwtSecret, {
      expiresIn: -1,
    });
    const expired = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${expiredToken}`)
      .send(validProductData());
    expect(expired.status).toBe(401);
  });
});
