import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UserModel } from "../models/User.js";

vi.mock("../services/idDocuments.js", () => ({
  IdImageValidationError: class IdImageValidationError extends Error {},
  checkNameConsistency: vi.fn(async () => true),
  deletePrivateIdImage: vi.fn(async () => undefined),
  maxIdFileBytes: 5 * 1024 * 1024,
  savePrivateIdImage: vi.fn(async () => "private-passport-image"),
  validateAndNormalizeIdImage: vi.fn(async (image: Buffer) => image),
}));
vi.mock("../services/sumsubVerification.js", () => ({
  getSumsubSettings: vi.fn(() => null),
  submitSumsubVerification: vi.fn(),
}));

import { savePrivateIdImage } from "../services/idDocuments.js";
import authRouter from "../routes/auth.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRouter);
  return app;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Passport registration documents", () => {
  it("accepts a seller's single passport information page", async () => {
    vi.spyOn(UserModel, "findOne").mockResolvedValue(null as never);
    vi.spyOn(UserModel.prototype, "save").mockResolvedValue(undefined as never);

    const response = await request(createApp())
      .post("/api/auth/register")
      .field("phone", "09123456780")
      .field("password", "password1")
      .field("name", "Test Seller")
      .field("role", "seller")
      .field("farmName", "Test Farm")
      .field("farmLocation", "Test Location")
      .field("idType", "Passport")
      .field("idConsent", "true")
      .attach("idFront", Buffer.from("passport-image"), {
        filename: "passport.jpg",
        contentType: "image/jpeg",
      });

    expect(response.status).toBe(201);
    expect(response.body.user).toMatchObject({
      role: "seller",
      idType: "Passport",
      idVerificationStatus: "pending_review",
    });
    expect(savePrivateIdImage).toHaveBeenCalledTimes(1);
  });

  it("rejects a second image for a Passport submission", async () => {
    const response = await request(createApp())
      .post("/api/auth/register")
      .field("phone", "09123456781")
      .field("password", "password1")
      .field("name", "Test Seller")
      .field("role", "seller")
      .field("farmName", "Test Farm")
      .field("farmLocation", "Test Location")
      .field("idType", "Passport")
      .field("idConsent", "true")
      .attach("idFront", Buffer.from("passport-image"), {
        filename: "passport.jpg",
        contentType: "image/jpeg",
      })
      .attach("idBack", Buffer.from("not-a-passport-page"), {
        filename: "back.jpg",
        contentType: "image/jpeg",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      "A passport submission requires only its information/photo page."
    );
    expect(savePrivateIdImage).not.toHaveBeenCalled();
  });
});
