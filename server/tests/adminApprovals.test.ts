import { getJwtSecret } from "../utils/jwtSecret.js";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UserModel } from "../models/User.js";
import adminApprovalsRouter from "../routes/admin-approvals.js";

const reviewerId = "64b000000000000000000001";
const targetId = "64b000000000000000000002";
const jwtSecret = process.env.JWT_SECRET || getJwtSecret();

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/admin/approvals", adminApprovalsRouter);
  return app;
}

function authHeader() {
  const token = jwt.sign({ userId: reviewerId }, jwtSecret);
  return { Authorization: `Bearer ${token}` };
}

afterEach(() => vi.restoreAllMocks());

describe("legacy admin ID approvals", () => {
  it("includes single-page passports in the pending review queue", async () => {
    vi.spyOn(UserModel, "findById").mockReturnValue({
      select: vi.fn().mockResolvedValue({ _id: reviewerId, role: "admin" }),
    } as never);
    vi.spyOn(UserModel, "countDocuments").mockResolvedValue(0 as never);
    const query = {
      select: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    const findSpy = vi.spyOn(UserModel, "find").mockReturnValue(query as never);

    const response = await request(createApp())
      .get("/api/admin/approvals/ids")
      .set(authHeader());

    expect(response.status).toBe(200);
    const filter = findSpy.mock.calls[0][0] as {
      $and: Array<{ $or?: Array<{ idType?: string }> }>;
    };
    expect(
      filter.$and.some(condition =>
        condition.$or?.some(branch => branch.idType === "Passport")
      )
    ).toBe(true);
  });

  it("allows approval of a passport with only its information page", async () => {
    const passportUser = {
      _id: targetId,
      role: "seller",
      idType: "Passport",
      idVerificationStatus: "pending_review",
      idFrontDocumentId: "passport.jpg",
      isIdVerified: false,
      idVerificationReviews: [] as Array<Record<string, unknown>>,
      save: vi.fn(async () => undefined),
    };
    const findById = vi.spyOn(UserModel, "findById");
    findById
      .mockReturnValueOnce({
        select: vi.fn().mockResolvedValue({ _id: reviewerId, role: "admin" }),
      } as never)
      .mockReturnValueOnce({
        select: vi.fn().mockResolvedValue(passportUser),
      } as never);

    const response = await request(createApp())
      .put(`/api/admin/approvals/ids/${targetId}/verify`)
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(passportUser.isIdVerified).toBe(true);
    expect(passportUser.save).toHaveBeenCalledOnce();
  });
});
