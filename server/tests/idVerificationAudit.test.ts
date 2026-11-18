import { getJwtSecret } from "../utils/jwtSecret.js";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { UserModel } from "../models/User.js";
import adminVerificationsRouter from "../routes/admin-verifications.js";
import { flushIdReviewAuditWrites } from "../middleware/audit.js";
import { sanitizeComplianceNotes } from "../utils/sanitizeComplianceNotes.js";

const reviewerId = "64b000000000000000000001";
const targetId = "64b000000000000000000002";
const jwtSecret = process.env.JWT_SECRET || getJwtSecret();
const auditFile = path.join(process.cwd(), "logs", "id-reviews.log");

function createApp(role: "admin" | "buyer" | "seller") {
  const app = express();
  app.use(express.json());
  app.use("/api/admin/verifications", adminVerificationsRouter);

  vi.spyOn(UserModel, "findById").mockReturnValue({
    select: vi.fn().mockResolvedValue({
      _id: reviewerId,
      role,
      name: "Private test name",
      phone: "09123456789",
    }),
  } as never);
  return app;
}

function authHeader(role: "admin" | "buyer" | "seller" = "admin") {
  const token = jwt.sign({ userId: reviewerId, role }, jwtSecret);
  return { Authorization: `Bearer ${token}` };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("admin ID verification API and audit", () => {
  it.each([
    ["pending", { isIdVerified: { $ne: true }, idVerificationStatus: { $in: ["pending", "pending_review"] } }],
    ["approved", { $or: [{ isIdVerified: true }, { idVerificationStatus: "verified" }] }],
    ["rejected", { isIdVerified: { $ne: true }, idVerificationStatus: "rejected" }],
  ] as const)("filters the admin submission queue by %s status", async (status, expectedFilter) => {
    const query = {
      select: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    };
    vi.spyOn(UserModel, "countDocuments").mockResolvedValue(0 as never);
    const findSpy = vi.spyOn(UserModel, "find").mockReturnValue(query as never);

    const response = await request(createApp("admin"))
      .get(`/api/admin/verifications/pending?status=${status}`)
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      items: [],
      total: 0,
      totalPages: 0,
    });
    expect(findSpy).toHaveBeenCalledWith(expect.objectContaining(expectedFilter));
  });

  it.each(["buyer", "seller"] as const)(
    "rejects an authenticated %s from the admin queue",
    async role => {
      const response = await request(createApp(role))
        .get("/api/admin/verifications/pending")
        .set(authHeader(role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: "Access denied" });
    }
  );

  it("writes a VIEW audit entry after an admin reads verification details", async () => {
    vi.spyOn(UserModel, "findOne").mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          _id: targetId,
          name: "Sensitive applicant name",
          phone: "09987654321",
          role: "buyer",
          idType: "National ID",
          isIdVerified: true,
          idNameConsistent: true,
          idSubmittedAt: new Date("2026-01-01T00:00:00.000Z"),
          createdAt: new Date("2025-12-31T00:00:00.000Z"),
          idVerificationReviews: [],
          idFrontDocumentId: "front.jpg",
          idBackDocumentId: "back.jpg",
        }),
      }),
    } as never);

    const response = await request(createApp("admin"))
      .get(`/api/admin/verifications/${targetId}`)
      .set(authHeader());
    await flushIdReviewAuditWrites();

    expect(response.status).toBe(200);
    expect(response.body.verification.status).toBe("verified");
    const lines = await readFile(auditFile, "utf8");
    const entries = lines
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map(line => JSON.parse(line) as Record<string, unknown>);
    const entry = entries.find(
      candidate =>
        candidate.action === "VIEW" &&
        candidate.reviewerUserId === reviewerId &&
        candidate.targetUserId === targetId
    );

    expect(entry).toMatchObject({
      action: "VIEW",
      reviewerUserId: reviewerId,
      targetUserId: targetId,
    });
    expect(entry?.timestamp).toEqual(expect.any(String));
    expect(JSON.stringify(entry)).not.toContain("Sensitive applicant name");
    expect(JSON.stringify(entry)).not.toContain("09987654321");
  });

  it("allows an admin to review a Passport with its single information page", async () => {
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
    vi.spyOn(UserModel, "findOne").mockReturnValue({
      select: vi.fn().mockResolvedValue(passportUser),
    } as never);

    const response = await request(createApp("admin"))
      .put(`/api/admin/verifications/${targetId}/review`)
      .set(authHeader())
      .send({ decision: "approve" });
    await flushIdReviewAuditWrites();

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("verified");
    expect(passportUser.save).toHaveBeenCalledOnce();
  });

  it.each([
    [{}, "Decision must be approve or reject."],
    [{ decision: "erase-all-records" }, "Decision must be approve or reject."],
    [{ decision: "reject", reasonCode: "erase-all-records" }, "Choose a valid reason code before rejecting."],
  ])("returns 400 for invalid review payloads", async (payload, message) => {
    const response = await request(createApp("admin"))
      .put(`/api/admin/verifications/${targetId}/review`)
      .set(authHeader())
      .send(payload);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(message);
  });
});

describe("compliance note sanitization", () => {
  it("removes markup and scripts, masks Philippine mobile numbers, and keeps safe text", () => {
    expect(
      sanitizeComplianceNotes(
        'Please update <b>the image</b>. <script>alert("x")</script> Call 0912-345-6789.'
      )
    ).toBe("Please update the image. Call [PHONE_MASKED].");
  });

  it("masks compact and parenthesized mobile number formats", () => {
    expect(sanitizeComplianceNotes("Numbers: 09123456789, (09) 12 345 6789."))
      .toBe("Numbers: [PHONE_MASKED], [PHONE_MASKED].");
  });

  it("sanitizes review notes when assigned to the UserModel", () => {
    const user = new UserModel({
      phone: "09111111111",
      password: "hashed",
      name: "Test user",
      latestReasonNote: "Call 0912-345-6789 <img src=x onerror=alert(1)>",
      idVerificationReviews: [{
        status: "rejected",
        reasonCode: "other",
        reasonNote: "Contact 09987654321 <script>bad()</script>",
        reviewerId,
        reviewedAt: new Date(),
      }],
    });

    expect(user.latestReasonNote).toBe("Call [PHONE_MASKED]");
    expect(user.idVerificationReviews[0].reasonNote).toBe("Contact [PHONE_MASKED]");
  });
});
