import { isValidObjectId } from "mongoose";
import { Router } from "express";
import { UserModel } from "../models/User.js";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth.js";
import { auditIdReviewAction } from "../middleware/audit.js";
import { IdImageValidationError, readPrivateIdImage, validateAndNormalizeIdImage } from "../services/idDocuments.js";
import { IdDocumentStorageUnavailableError } from "../services/supabaseIdDocumentStorage.js";
import { sanitizeComplianceNotes } from "../utils/sanitizeComplianceNotes.js";

const router = Router();
const rejectionReasons = [
  "blurry_image",
  "name_mismatch",
  "expired_document",
  "unsupported_document",
  "other",
] as const;

function getPagination(query: { page?: unknown; limit?: unknown }) {
  const pageValue = Number(query.page ?? 1);
  const limitValue = Number(query.limit ?? 20);
  if (!Number.isInteger(pageValue) || pageValue < 1) return null;
  if (!Number.isInteger(limitValue) || limitValue < 1 || limitValue > 50) return null;
  return { page: pageValue, limit: limitValue };
}

function hasIdDocuments(user: {
  idType?: string;
  idFrontDocumentId?: string;
  idBackDocumentId?: string;
  idFrontImage?: string;
  idBackImage?: string;
}) {
  const hasFront = Boolean(user.idFrontDocumentId || user.idFrontImage);
  const hasBack = Boolean(user.idBackDocumentId || user.idBackImage);
  return Boolean(
    hasFront && (user.idType === "Passport" || hasBack)
  );
}

router.use(requireAuth, requireRole("admin"));

router.get("/pending", async (req, res) => {
  try {
    const pagination = getPagination(req.query);
    if (!pagination) {
      return res.status(400).json({ error: "Page must be positive and limit must be between 1 and 50." });
    }
    const role = req.query.role;
    if (role !== undefined && role !== "buyer" && role !== "seller") {
      return res.status(400).json({ error: "Role filter must be buyer or seller." });
    }
    const status = req.query.status ?? "pending";
    if (
      status !== "pending" &&
      status !== "approved" &&
      status !== "rejected"
    ) {
      return res.status(400).json({
        error: "Status filter must be pending, approved, or rejected.",
      });
    }
    const submissionHistory = req.query.submissionHistory;
    if (
      submissionHistory !== undefined &&
      submissionHistory !== "all" &&
      submissionHistory !== "first" &&
      submissionHistory !== "resubmitted"
    ) {
      return res.status(400).json({ error: "Submission history filter is invalid." });
    }

    const filter: Record<string, any> = {
      role: { $in: ["buyer", "seller"] },
      $and: [
        { $or: [{ idFrontDocumentId: { $exists: true, $ne: "" } }, { idFrontImage: { $exists: true, $ne: "" } }] },
        {
          $or: [
            { idType: "Passport" },
            {
              $and: [
                { idType: { $ne: "Passport" } },
                {
                  $or: [
                    { idBackDocumentId: { $exists: true, $ne: "" } },
                    { idBackImage: { $exists: true, $ne: "" } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    if (status === "pending") {
      filter.isIdVerified = { $ne: true };
      filter.idVerificationStatus = { $in: ["pending", "pending_review"] };
    } else if (status === "approved") {
      filter.$or = [
        { isIdVerified: true },
        { idVerificationStatus: "verified" },
      ];
    } else {
      filter.isIdVerified = { $ne: true };
      filter.idVerificationStatus = "rejected";
    }
    if (role) filter.role = role;
    if (submissionHistory === "resubmitted") {
      filter["idVerificationReviews.status"] = "rejected";
    } else if (submissionHistory === "first") {
      filter.idVerificationReviews = { $not: { $elemMatch: { status: "rejected" } } };
    }
    const [total, users] = await Promise.all([
      UserModel.countDocuments(filter),
      UserModel.find(filter)
        .select("name phone role idType idVerificationStatus idNameConsistent idSubmittedAt createdAt idVerificationReviews.status")
        .sort({ idSubmittedAt: 1, _id: 1 })
        .skip((pagination.page - 1) * pagination.limit)
        .limit(pagination.limit)
        .lean(),
    ]);

    return res.json({
      items: users.map(user => ({
        _id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        idType: user.idType,
        idVerificationStatus: user.isIdVerified
          ? "verified"
          : user.idVerificationStatus || "pending_review",
        idNameConsistent: user.idNameConsistent,
        idSubmittedAt: user.idSubmittedAt,
        createdAt: user.createdAt,
        hasPriorRejection:
          user.idVerificationReviews?.some((review: { status?: string }) => review.status === "rejected") || false,
      })),
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    });
  } catch (error) {
    console.error("[Admin.Verifications] Pending queue failed", {
      errorName: error instanceof Error ? error.name : "Error",
    });
    return res.status(500).json({ error: "Could not load pending verifications." });
  }
});

router.get("/:id/document/:docId", auditIdReviewAction("VIEW"), async (req, res) => {
  try {
    const { id, docId } = req.params;
    if (!isValidObjectId(id) || !["front", "back"].includes(docId)) {
      return res.status(400).json({ error: "Invalid verification document reference." });
    }

    const user = await UserModel.findOne({
      _id: id,
      role: { $in: ["buyer", "seller"] },
      idVerificationStatus: {
        $in: ["pending", "pending_review", "verified", "rejected"],
      },
    }).select("+idFrontDocumentId +idBackDocumentId +idFrontImage +idBackImage");
    if (!user) return res.status(404).json({ error: "Verification was not found." });

    const isFront = docId === "front";
    const documentId = isFront ? user.idFrontDocumentId : user.idBackDocumentId;
    const legacyImage = isFront ? user.idFrontImage : user.idBackImage;
    let image: Buffer;
    if (documentId) {
      image = await readPrivateIdImage(documentId);
    } else if (legacyImage) {
      const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(legacyImage);
      if (!match) return res.status(404).json({ error: "ID document is unavailable." });
      image = await validateAndNormalizeIdImage(Buffer.from(match[2], "base64"), match[1]);
    } else {
      return res.status(404).json({ error: "ID document is unavailable." });
    }

    res.set({
      "Cache-Control": "private, no-store",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Content-Type": "image/jpeg",
    });
    return res.send(image);
  } catch (error) {
    if (error instanceof IdImageValidationError) {
      return res.status(404).json({ error: "ID document is unavailable." });
    }
    if (error instanceof IdDocumentStorageUnavailableError) {
      return res.status(503).json({ error: "Private ID document storage is unavailable." });
    }
    console.error("[Admin.Verifications] Document read failed", {
      errorName: error instanceof Error ? error.name : "Error",
    });
    return res.status(500).json({ error: "Could not retrieve verification document." });
  }
});

router.get("/:id", auditIdReviewAction("VIEW"), async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid verification reference." });
    }
    const user = await UserModel.findOne({
      _id: req.params.id,
      role: { $in: ["buyer", "seller"] },
    })
      .select("name phone role idType idVerificationStatus idNameConsistent idSubmittedAt createdAt idVerificationReviews latestReasonCode latestReasonNote +idFrontDocumentId +idBackDocumentId +idFrontImage +idBackImage")
      .lean();
    if (!user) return res.status(404).json({ error: "Verification was not found." });
    const reviews = [...(user.idVerificationReviews || [])].sort(
      (a, b) => new Date(a.reviewedAt).getTime() - new Date(b.reviewedAt).getTime()
    );

    return res.json({
      verification: {
        id: user._id,
        status: user.isIdVerified
          ? "verified"
          : user.idVerificationStatus || "pending_review",
        idType: user.idType,
        idNameConsistent: user.idNameConsistent,
        submittedAt: user.idSubmittedAt,
        createdAt: user.createdAt,
        latestReasonCode: user.latestReasonCode,
        latestReasonNote: user.latestReasonNote,
        documents: [
          {
            id: "front",
            side: user.idType === "Passport" ? "information/photo page" : "front",
            available: Boolean(user.idFrontDocumentId || user.idFrontImage),
          },
          ...(user.idType === "Passport"
            ? []
            : [
                {
                  id: "back" as const,
                  side: "back",
                  available: Boolean(
                    user.idBackDocumentId || user.idBackImage
                  ),
                },
              ]),
        ],
        reviews,
      },
      user: { id: user._id, name: user.name, phone: user.phone, role: user.role },
    });
  } catch (error) {
    console.error("[Admin.Verifications] Detail read failed", {
      errorName: error instanceof Error ? error.name : "Error",
    });
    return res.status(500).json({ error: "Could not load verification details." });
  }
});

router.put("/:id/review", auditIdReviewAction("REVIEW"), async (req: AuthRequest, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid verification reference." });
    }
    const body = req.body ?? {};
    const { decision, reasonCode } = body as {
      decision?: unknown;
      reasonCode?: unknown;
      reasonNote?: unknown;
    };
    const reasonNote = typeof body.reasonNote === "string"
      ? sanitizeComplianceNotes(body.reasonNote)
      : "";
    if (decision !== "approve" && decision !== "reject") {
      return res.status(400).json({ error: "Decision must be approve or reject." });
    }
    res.locals.idReviewAction = decision === "reject" ? "REJECT" : "APPROVE";
    if (decision === "reject" && !rejectionReasons.includes(reasonCode as (typeof rejectionReasons)[number])) {
      return res.status(400).json({ error: "Choose a valid reason code before rejecting." });
    }
    if (reasonNote.length > 1000) {
      return res.status(400).json({ error: "Reason note must be 1000 characters or fewer." });
    }

    const user = await UserModel.findOne({
      _id: req.params.id,
      role: { $in: ["buyer", "seller"] },
      isIdVerified: { $ne: true },
      idVerificationStatus: "pending_review",
    }).select("+idFrontDocumentId +idBackDocumentId +idFrontImage +idBackImage");
    if (!user) return res.status(404).json({ error: "Pending verification was not found." });
    if (!hasIdDocuments(user)) {
      return res.status(409).json({
        error:
          user.idType === "Passport"
            ? "The passport information/photo page must be available before review."
            : "Both ID photos must be available before review.",
      });
    }

    const reviewedAt = new Date();
    const approved = decision === "approve";
    const normalizedReasonCode = approved ? undefined : reasonCode as (typeof rejectionReasons)[number];
    user.idVerificationStatus = approved ? "verified" : "rejected";
    user.isIdVerified = approved;
    user.idVerifiedAt = approved ? reviewedAt : undefined;
    user.idRetryAllowed = !approved;
    user.latestReasonCode = normalizedReasonCode;
    user.latestReasonNote = approved ? undefined : reasonNote || undefined;
    user.idVerificationReviews.push({
      status: approved ? "verified" : "rejected",
      reasonCode: normalizedReasonCode,
      reasonNote: approved ? undefined : reasonNote || undefined,
      reviewerId: req.user._id,
      reviewedAt,
    });
    await user.save();

    return res.json({
      success: true,
      status: user.idVerificationStatus,
      latestReasonCode: user.latestReasonCode,
      latestReasonNote: user.latestReasonNote,
    });
  } catch (error) {
    console.error("[Admin.Verifications] Review decision failed", {
      errorName: error instanceof Error ? error.name : "Error",
    });
    return res.status(500).json({ error: "Could not save the review decision." });
  }
});

export default router;
