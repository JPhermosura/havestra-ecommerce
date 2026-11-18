import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UserModel } from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import { getJwtSecret } from "../utils/jwtSecret.js";

const userId = "64b000000000000000000001";

function createApp() {
  const app = express();
  app.get("/private", requireAuth, (_req, res) => res.json({ ok: true }));
  return app;
}

function authHeader() {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET || getJwtSecret());
  return { Authorization: `Bearer ${token}` };
}

function mockUser(user: Record<string, unknown>) {
  vi.spyOn(UserModel, "findById").mockReturnValue({
    select: vi.fn().mockResolvedValue(user),
  } as never);
}

afterEach(() => vi.restoreAllMocks());

describe("authentication middleware", () => {
  it("rejects suspended users before calling protected routes", async () => {
    mockUser({ _id: userId, role: "buyer", isSuspended: true });

    const response = await request(createApp())
      .get("/private")
      .set(authHeader());

    expect(response.status).toBe(403);
    expect(response.body.error).toBe("Account is suspended. Contact support.");
  });

  it("returns a server error when the account lookup fails", async () => {
    vi.spyOn(UserModel, "findById").mockReturnValue({
      select: vi.fn().mockRejectedValue(new Error("database unavailable")),
    } as never);

    const response = await request(createApp())
      .get("/private")
      .set(authHeader());

    expect(response.status).toBe(500);
    expect(response.body.error).toBe(
      "Unable to verify your account right now"
    );
  });
});

describe("JWT secret configuration", () => {
  it("requires a configured secret outside development and test", () => {
    expect(() => getJwtSecret({ NODE_ENV: "production" })).toThrow(
      "JWT_SECRET must be configured outside development and test."
    );
  });

  it("uses the configured secret when provided", () => {
    expect(
      getJwtSecret({ NODE_ENV: "production", JWT_SECRET: "configured-secret" })
    ).toBe("configured-secret");
  });
});
