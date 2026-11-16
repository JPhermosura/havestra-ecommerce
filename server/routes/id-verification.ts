import express, { Router } from "express";
import mongoose from "mongoose";
import { UserModel } from "../models/User.js";
import { getSumsubSettings, verifySumsubWebhookDigest } from "../services/sumsubVerification.js";
import { isFreshProviderEvent, mapSumsubReviewState } from "../services/verificationPolicy.js";

const router = Router();

router.post(
  "/sumsub",
  express.raw({ type: "application/json", limit: "64kb" }),
  async (req, res) => {
    const settings = getSumsubSettings();
    if (!settings) {
      return res.status(503).json({ error: "Identity provider is not configured" });
    }

    if (!Buffer.isBuffer(req.body)) {
      return res.status(400).json({ error: "Expected a raw JSON webhook body" });
    }

    const signatureIsValid = verifySumsubWebhookDigest(
      req.body,
      req.get("x-payload-digest"),
      req.get("x-payload-digest-alg"),
      settings.webhookSecret
    );
    if (!signatureIsValid) {
      return res.status(401).json({ error: "Invalid webhook signature" });
    }

    let payload: any;
    try {
      payload = JSON.parse(req.body.toString("utf8"));
    } catch {
      return res.status(400).json({ error: "Invalid webhook payload" });
    }

    if (payload.testMode === true) return res.json({ received: true });
    if (payload.type !== "applicantReviewed") return res.json({ received: true });

    try {
      let user = payload.applicantId
        ? await UserModel.findOne({ idProviderApplicantId: String(payload.applicantId) }).select("+idProviderLastEventAt")
        : null;
      if (!user && mongoose.Types.ObjectId.isValid(String(payload.externalUserId || ""))) {
        user = await UserModel.findById(payload.externalUserId).select("+idProviderLastEventAt");
      }
      if (!user) return res.status(404).json({ error: "Applicant is not associated with an account" });

      const eventAt = new Date(payload.createdAtMs);
      if (!isFreshProviderEvent(eventAt, user.idProviderLastEventAt)) {
        return res.status(400).json({ error: "Invalid or stale provider event" });
      }

      const stateUpdate = mapSumsubReviewState(
        String(payload.reviewStatus || ""),
        String(payload.reviewResult?.reviewAnswer || ""),
        String(payload.reviewResult?.reviewRejectType || "")
      );
      if (!stateUpdate) {
        return res.json({ received: true });
      }

      user.isIdVerified = stateUpdate.isVerified;
      user.idVerificationStatus = stateUpdate.status;
      user.idRetryAllowed = stateUpdate.retryAllowed;
      user.idVerifiedAt = stateUpdate.verifiedAt;
      user.idProviderLastEventAt = eventAt;

      await user.save();
      return res.json({ received: true });
    } catch (error) {
      console.error("[Sumsub.Webhook] Result processing failed", {
        errorName: error instanceof Error ? error.name : "Error",
      });
      return res.status(500).json({ error: "Could not process verification result" });
    }
  }
);

export default router;