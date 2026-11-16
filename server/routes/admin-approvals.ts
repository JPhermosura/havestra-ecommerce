import express from "express";
import { UserModel } from "../models/User.js";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth.js";
import { sanitizeComplianceNotes } from "../utils/sanitizeComplianceNotes.js";
import {
  IdImageValidationError,
  readPrivateIdImage,
  validateAndNormalizeIdImage,
} from "../services/idDocuments.js";

const router = express.Router();

// List pending seller applications
router.get("/sellers", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const search = (req.query.search as string) || "";

    const filter: any = { role: "seller", isFarmer: true, isSellerApproved: false };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { farmName: { $regex: search, $options: "i" } },
      ];
    }

    const total = await UserModel.countDocuments(filter);
    const users = await UserModel.find(filter)
      .skip((page - 1) * limit)
      .limit(limit)
      .select("name phone farmName farmLocation farmType isIdVerified idVerificationStatus createdAt")
      .sort({ createdAt: -1 });

    res.json({ users, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch pending sellers" });
  }
});

// Get seller application details
router.get("/sellers/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const user = await UserModel.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ error: "Seller not found" });
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch seller details" });
  }
});

router.get("/ids", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const page = Number.isFinite(Number(req.query.page)) ? Math.max(1, Number(req.query.page)) : 1;
    const limit = Number.isFinite(Number(req.query.limit))
      ? Math.min(50, Math.max(1, Number(req.query.limit)))
      : 20;
    const search = String(req.query.search || "").trim();
    const filter: any = {
      role: { $in: ["buyer", "seller"] },
      isIdVerified: { $ne: true },
      $and: [
        {
          $or: [
            { idVerificationStatus: { $in: ["pending_review", "not_submitted"] } },
            { idVerificationStatus: { $exists: false } },
          ],
        },
        { $or: [{ idFrontDocumentId: { $exists: true, $ne: "" } }, { idFrontImage: { $exists: true, $ne: "" } }] },
        { $or: [{ idBackDocumentId: { $exists: true, $ne: "" } }, { idBackImage: { $exists: true, $ne: "" } }] },
      ],
    };

    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { name: { $regex: escapedSearch, $options: "i" } },
        { phone: { $regex: escapedSearch, $options: "i" } },
      ];
    }

    const total = await UserModel.countDocuments(filter);
    const users = await UserModel.find(filter)
      .select("name phone role idType idVerificationStatus idNameConsistent idSubmittedAt createdAt")
      .sort({ createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({ users, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch pending ID reviews" });
  }
});

router.get("/ids/:id/:side", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const side = req.params.side;
    if (side !== "front" && side !== "back") {
      return res.status(400).json({ error: "Invalid ID document side" });
    }

    const user = await UserModel.findById(req.params.id).select(
      "+idFrontDocumentId +idBackDocumentId +idFrontImage +idBackImage"
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.isIdVerified || !["pending_review", "not_submitted"].includes(user.idVerificationStatus)) {
      return res.status(409).json({ error: "This ID is not awaiting manual review." });
    }

    const documentId = side === "front" ? user.idFrontDocumentId : user.idBackDocumentId;
    const legacyImage = side === "front" ? user.idFrontImage : user.idBackImage;
    let image: Buffer;
    if (documentId) {
      image = await readPrivateIdImage(documentId);
    } else if (legacyImage) {
      const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(legacyImage);
      if (!match) return res.status(404).json({ error: "ID document is unavailable" });
      const decoded = Buffer.from(match[2], "base64");
      image = await validateAndNormalizeIdImage(decoded, match[1]);
    } else {
      return res.status(404).json({ error: "ID document is unavailable" });
    }

    res.set({
      "Cache-Control": "private, no-store",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Content-Type": "image/jpeg",
    });
    return res.send(image);
  } catch (err) {
    if (err instanceof IdImageValidationError) {
      return res.status(404).json({ error: "ID document is unavailable" });
    }
    console.error("[Admin.IDReview] Document fetch failed", {
      errorName: err instanceof Error ? err.name : "Error",
    });
    return res.status(500).json({ error: "Could not retrieve ID document" });
  }
});

router.put("/ids/:id/verify", requireAuth, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const user = await UserModel.findById(req.params.id).select(
      "+idFrontDocumentId +idBackDocumentId +idFrontImage +idBackImage"
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.isIdVerified || !["pending_review", "not_submitted"].includes(user.idVerificationStatus)) {
      return res.status(409).json({ error: "This ID is not awaiting manual review." });
    }
    const hasFront = Boolean(user.idFrontDocumentId || user.idFrontImage);
    const hasBack = Boolean(user.idBackDocumentId || user.idBackImage);
    if (!hasFront || !hasBack) {
      return res.status(400).json({ error: "Both ID photos are required before verification" });
    }

    user.isIdVerified = true;
    user.idVerificationStatus = "verified";
    user.idVerifiedAt = new Date();
    user.idRetryAllowed = false;
    user.latestReasonCode = undefined;
    user.latestReasonNote = undefined;
    user.idVerificationReviews.push({
      status: "verified",
      reviewerId: req.user._id,
      reviewedAt: user.idVerifiedAt,
    });
    await user.save();
    res.json({ success: true, userId: user._id, isIdVerified: user.isIdVerified });
  } catch (err) {
    console.error("[Admin.IDReview] Verification update failed", {
      errorName: err instanceof Error ? err.name : "Error",
    });
    res.status(500).json({ error: "Failed to verify ID" });
  }
});

router.put("/ids/:id/reject", requireAuth, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const validReasons = ["blurry_image", "name_mismatch", "expired_document", "unsupported_document", "other"] as const;
    const reasonCode = req.body?.reasonCode;
    const reasonNote = typeof req.body?.reasonNote === "string"
      ? sanitizeComplianceNotes(req.body.reasonNote)
      : "";
    if (!validReasons.includes(reasonCode)) {
      return res.status(400).json({ error: "Choose a valid reason code before rejecting." });
    }
    if (reasonNote.length > 1000) {
      return res.status(400).json({ error: "Reason note must be 1000 characters or fewer." });
    }
    const user = await UserModel.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.isIdVerified || !["pending_review", "not_submitted"].includes(user.idVerificationStatus)) {
      return res.status(409).json({ error: "This ID is not awaiting manual review." });
    }
    user.isIdVerified = false;
    user.idVerificationStatus = "rejected";
    user.idVerifiedAt = undefined;
    user.idRetryAllowed = true;
    user.latestReasonCode = reasonCode;
    user.latestReasonNote = reasonNote || undefined;
    user.idVerificationReviews.push({
      status: "rejected",
      reasonCode,
      reasonNote: reasonNote || undefined,
      reviewerId: req.user._id,
      reviewedAt: new Date(),
    });
    await user.save();
    res.json({ success: true, userId: user._id, idVerificationStatus: user.idVerificationStatus });
  } catch (err) {
    console.error("[Admin.IDReview] Rejection update failed", {
      errorName: err instanceof Error ? err.name : "Error",
    });
    res.status(500).json({ error: "Failed to reject ID" });
  }
});

// Approve seller application
router.put("/sellers/:id/approve", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const user = await UserModel.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "Seller not found" });
    if (!user.isIdVerified) {
      return res.status(409).json({ error: "Verify the seller's identity before approving the seller application." });
    }
    user.isSellerApproved = true;
    user.role = "seller";
    user.isFarmer = true;
    await user.save();
    res.json({ user: { id: user._id, name: user.name, role: user.role, isSellerApproved: user.isSellerApproved } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to approve seller" });
  }
});

// Reject seller application
router.put("/sellers/:id/reject", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const user = await UserModel.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "Seller not found" });
    // Mark as not a farmer / not approved and clear farm details
    user.isSellerApproved = false;
    user.isFarmer = false;
    user.farmName = undefined;
    user.farmLocation = undefined;
    user.farmType = undefined;
    user.farmImages = [];
    user.farmDescription = undefined;
    await user.save();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to reject seller" });
  }
});

export default router;
