import { getJwtSecret } from "../utils/jwtSecret.js";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProductModel } from "../models/Product.js";
import { UserModel } from "../models/User.js";
import productRouter from "../routes/products.js";

const userId = "64b000000000000000000001";
const productId = "64b000000000000000000002";
const jwtSecret = process.env.JWT_SECRET || getJwtSecret();

function authHeader() {
  const token = jwt.sign({ userId }, jwtSecret);
  return { Authorization: `Bearer ${token}` };
}

function createSellerApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/products", productRouter);
  vi.spyOn(UserModel, "findById").mockReturnValue({
    select: vi.fn().mockResolvedValue({
      _id: userId,
      role: "seller",
    }),
  } as never);
  return app;
}

afterEach(() => vi.restoreAllMocks());

describe("legacy seller product ownership", () => {
  it("allows a seller to delete a legacy product owned through farmerId", async () => {
    const deleteOne = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(ProductModel, "findById").mockResolvedValue({
      _id: productId,
      farmerId: userId,
      deleteOne,
    } as never);

    const response = await request(createSellerApp())
      .delete(`/api/products/${productId}`)
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(deleteOne).toHaveBeenCalledOnce();
  });

  it("does not allow a seller to delete another farmer's product", async () => {
    const deleteOne = vi.fn();
    vi.spyOn(ProductModel, "findById").mockResolvedValue({
      _id: productId,
      farmerId: "64b000000000000000000004",
      deleteOne,
    } as never);

    const response = await request(createSellerApp())
      .delete(`/api/products/${productId}`)
      .set(authHeader());

    expect(response.status).toBe(403);
    expect(deleteOne).not.toHaveBeenCalled();
  });
});
