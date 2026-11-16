import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import authRouter from "../routes/auth.js";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRouter);
  return app;
}

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
});
