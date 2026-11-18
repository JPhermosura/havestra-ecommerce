import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UserModel } from "../models/User.js";
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

describe("registration API validation", () => {
  it("rejects public attempts to register an admin account", async () => {
    const response = await request(createApp())
      .post("/api/auth/register")
      .send({ role: "admin" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Choose Buyer or Seller to register.");
  });

  it("rejects passwords shorter than the registration minimum on the server", async () => {
    const response = await request(createApp())
      .post("/api/auth/register")
      .send({
        phone: "09123456789",
        password: "12345",
        name: "Test Applicant",
        role: "buyer",
        idType: "National ID",
        idConsent: "true",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Password must be at least 6 characters.");
  });

  it("allows a buyer to register without submitting ID documents", async () => {
    vi.spyOn(UserModel, "findOne").mockResolvedValue(null as never);
    vi.spyOn(UserModel.prototype, "save").mockResolvedValue(undefined as never);

    const response = await request(createApp())
      .post("/api/auth/register")
      .field("phone", "09123456780")
      .field("password", "password1")
      .field("name", "Test Buyer")
      .field("role", "buyer");

    expect(response.status).toBe(201);
    expect(response.body.user).toMatchObject({
      role: "buyer",
      idVerificationStatus: "not_submitted",
      isIdVerified: false,
    });
  });

  it("requires sellers to submit both ID images", async () => {
    const response = await request(createApp())
      .post("/api/auth/register")
      .field("phone", "09123456781")
      .field("password", "password1")
      .field("name", "Test Seller")
      .field("role", "seller")
      .field("farmName", "Test Farm")
      .field("farmLocation", "Test Location");

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      "Seller registration requires both sides of a government ID."
    );
  });

  it("rejects partial buyer ID submissions", async () => {
    const response = await request(createApp())
      .post("/api/auth/register")
      .field("phone", "09123456782")
      .field("password", "password1")
      .field("name", "Test Buyer")
      .field("role", "buyer")
      .attach("idFront", Buffer.from("not-an-image"), {
        filename: "front.jpg",
        contentType: "image/jpeg",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      "Upload both the front and back sides of your ID."
    );
  });
});
