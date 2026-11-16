import { createHmac } from "node:crypto";
import type { NextFunction, Response } from "express";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { requireRole, requireVerifiedSeller, type AuthRequest } from "../middleware/auth.js";
import { checkNameConsistency, maxIdFileBytes, validateAndNormalizeIdImage } from "../services/idDocuments.js";
import { verifySumsubWebhookDigest } from "../services/sumsubVerification.js";
import {
  canResubmitIdDocuments,
  isFreshProviderEvent,
  mapSumsubReviewState,
  pickUserEditableProfileFields,
} from "../services/verificationPolicy.js";

describe("ID image validation", () => {
  it("decodes and normalizes supported image bytes", async () => {
    const png = await sharp({
      create: { width: 800, height: 500, channels: 3, background: "white" },
    }).png().toBuffer();

    const normalized = await validateAndNormalizeIdImage(png, "image/png");
    const metadata = await sharp(normalized).metadata();
    expect(metadata.format).toBe("jpeg");
    expect(metadata.width).toBe(800);
  });

  it("rejects unreadable data and MIME mismatches", async () => {
    await expect(validateAndNormalizeIdImage(Buffer.from("not an image"), "image/png"))
      .rejects.toThrow("not a readable image");

    const jpeg = await sharp({
      create: { width: 800, height: 500, channels: 3, background: "white" },
    }).jpeg().toBuffer();
    await expect(validateAndNormalizeIdImage(jpeg, "image/png"))
      .rejects.toThrow("Use a JPEG, PNG, or WebP");
  });

  it("rejects images too small to read as identity documents", async () => {
    const tiny = await sharp({
      create: { width: 120, height: 100, channels: 3, background: "white" },
    }).jpeg().toBuffer();
    await expect(validateAndNormalizeIdImage(tiny, "image/jpeg"))
      .rejects.toThrow("too small to review");
  });

  it("rejects files over the configured size limit", async () => {
    await expect(validateAndNormalizeIdImage(Buffer.alloc(maxIdFileBytes + 1), "image/jpeg"))
      .rejects.toThrow("5 MB or smaller");
  });

  it("runs the bundled English OCR model without a remote data download", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="500"><rect width="100%" height="100%" fill="white"/><text x="50" y="270" font-family="Arial" font-size="120" fill="black">Maria Santos</text></svg>'
    );
    const image = await sharp(svg).jpeg().toBuffer();
    await expect(checkNameConsistency([image, image], "Maria Santos")).resolves.toBe(true);
  }, 120_000);
});

describe("verification state and permissions", () => {
  it("maps only completed provider decisions to verified or rejected", () => {
    expect(mapSumsubReviewState("completed", "GREEN", "")?.status).toBe("verified");
    expect(mapSumsubReviewState("completed", "RED", "RETRY")).toMatchObject({
      status: "rejected",
      isVerified: false,
      retryAllowed: true,
    });
    expect(mapSumsubReviewState("completed", "RED", "FINAL")?.retryAllowed).toBe(false);
    expect(mapSumsubReviewState("pending", "", "")?.status).toBe("pending");
    expect(mapSumsubReviewState("onHold", "", "")?.status).toBe("pending_review");
    expect(mapSumsubReviewState("completed", "UNKNOWN", "")).toBeNull();
  });

  it("allows retries only after rejection or an explicit provider retryable fallback", () => {
    expect(canResubmitIdDocuments("rejected", false)).toBe(false);
    expect(canResubmitIdDocuments("rejected", true)).toBe(true);
    expect(canResubmitIdDocuments("pending_review", true)).toBe(true);
    expect(canResubmitIdDocuments("pending_review", false)).toBe(false);
    expect(canResubmitIdDocuments("verified", true)).toBe(false);
  });

  it("rejects stale, repeated, and invalid provider event timestamps", () => {
    const previous = new Date("2026-01-02T00:00:00.000Z");
    expect(isFreshProviderEvent(new Date("2026-01-03T00:00:00.000Z"), previous)).toBe(true);
    expect(isFreshProviderEvent(previous, previous)).toBe(false);
    expect(isFreshProviderEvent(new Date("invalid"), previous)).toBe(false);
  });

  it("ignores client attempts to set verification fields", () => {
    expect(pickUserEditableProfileFields({
      name: "Buyer",
      isIdVerified: true,
      idVerificationStatus: "verified",
      idFrontDocumentId: "public-key",
    })).toEqual({ name: "Buyer" });
  });

  it("denies non-admin users from admin-only identity actions", () => {
    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;

    requireRole("admin")(
      { user: { role: "buyer" } } as AuthRequest,
      response,
      next
    );

    expect(response.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("blocks sellers from publishing until identity and seller approval both pass", () => {
    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;

    requireVerifiedSeller(
      { user: { role: "seller", isIdVerified: false, idVerificationStatus: "pending_review", isSellerApproved: false } } as AuthRequest,
      response,
      next
    );

    expect(response.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("Sumsub webhook signature", () => {
  it("accepts only a matching raw-body HMAC digest", () => {
    const rawBody = Buffer.from('{"type":"applicantReviewed"}');
    const secret = "test-webhook-secret";
    const digest = createHmac("sha256", secret).update(rawBody).digest("hex");

    expect(verifySumsubWebhookDigest(rawBody, digest, "HMAC_SHA256_HEX", secret)).toBe(true);
    expect(verifySumsubWebhookDigest(rawBody, digest, "HMAC_SHA256_HEX", "wrong-secret")).toBe(false);
    expect(verifySumsubWebhookDigest(rawBody, digest, "UNSUPPORTED", secret)).toBe(false);
  });
});