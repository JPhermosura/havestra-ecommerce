import bcrypt from "bcryptjs";
import { Router, type Request, type RequestHandler, type Response } from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import { UserModel } from "../models/User.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import {
  checkNameConsistency,
  deletePrivateIdImage,
  IdImageValidationError,
  maxIdFileBytes,
  savePrivateIdImage,
  validateAndNormalizeIdImage,
} from "../services/idDocuments.js";
import { getSumsubSettings, submitSumsubVerification } from "../services/sumsubVerification.js";
import { canResubmitIdDocuments, pickUserEditableProfileFields } from "../services/verificationPolicy.js";
import { ID_DOCUMENT_RETENTION_DAYS } from "../../shared/const.js";
import { getJwtSecret } from "../utils/jwtSecret.js";
import { IdDocumentStorageUnavailableError } from "../services/supabaseIdDocumentStorage.js";

const JWT_SECRET = getJwtSecret();
const JWT_EXPIRES_IN = "7d";

function createJwtToken(userId: string) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function sanitizeUser(user: any) {
  const idVerificationStatus = user.idVerificationStatus ||
    (user.isIdVerified ? "verified" : user.idFrontImage || user.idFrontDocumentId ? "pending_review" : "not_submitted");
  return {
    id: user._id,
    email: user.email,
    name: user.name,
    role: user.role,
    phone: user.phone,
    address: user.address,
    city: user.city,
    country: user.country,
    zipCode: user.zipCode,
    isFarmer: user.isFarmer,
    farmName: user.farmName,
    farmLocation: user.farmLocation,
    idType: user.idType,
    isIdVerified: user.isIdVerified,
    idVerificationStatus,
    idNameConsistent: user.idNameConsistent ?? null,
    farmType: user.farmType,
    certifications: user.certifications,
    farmDescription: user.farmDescription,
    farmImages: user.farmImages,
    yearsOfExperience: user.yearsOfExperience,
    contactInfo: user.contactInfo,
    cart: user.cart,
    wishlist: user.wishlist,
  };
}

const router = Router();
const identityRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many registration attempts. Please try again later." },
});
const retryRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many ID resubmissions. Please try again later." },
});
const idUploadParser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxIdFileBytes, fieldSize: 16 * 1024, fields: 12, files: 2, parts: 14 },
}).fields([
  { name: "idFront", maxCount: 1 },
  { name: "idBack", maxCount: 1 },
]);

const parseIdUpload: RequestHandler = (req, res, next) => {
  idUploadParser(req, res, error => {
    if (!error) return next();
    const maximumSizeMb = Math.floor(maxIdFileBytes / (1024 * 1024));
    const message = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
      ? `Each ID photo must be ${maximumSizeMb} MB or smaller.`
      : "Upload exactly one front and one back ID image.";
    return res.status(400).json({ error: message });
  });
};

function getUploadedIdDocuments(req: Request, idType?: string) {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  const front = files?.idFront?.[0];
  const back = files?.idBack?.[0];
  if (!front && !back) {
    return null;
  }
  const isPassport = String(idType || "").trim().toLowerCase() === "passport";
  if (!front || (!isPassport && !back)) {
    throw new IdImageValidationError(
      isPassport
        ? "Upload the passport information/photo page."
        : "Upload both the front and back sides of your ID."
    );
  }
  if (isPassport && back) {
    throw new IdImageValidationError(
      "A passport submission requires only its information/photo page."
    );
  }
  return { front, back };
}

async function normalizeIdDocuments(req: Request, idType?: string) {
  const uploadedDocuments = getUploadedIdDocuments(req, idType);
  if (!uploadedDocuments) {
    throw new IdImageValidationError("ID document images are required.");
  }
  const frontBuffer = await validateAndNormalizeIdImage(
    uploadedDocuments.front.buffer,
    uploadedDocuments.front.mimetype
  );
  const backBuffer = uploadedDocuments.back
    ? await validateAndNormalizeIdImage(
        uploadedDocuments.back.buffer,
        uploadedDocuments.back.mimetype
      )
    : undefined;
  return { frontBuffer, backBuffer };
}

router.post("/login", async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ error: "Phone number and password are required" });
    }

    const normalizedPhone = String(phone).trim();
    if (!/^09\d{9}$/.test(normalizedPhone)) {
      return res.status(400).json({ error: "Phone number must start with 09 and contain 11 digits" });
    }

    const user = await UserModel.findOne({ phone: normalizedPhone });
    if (!user) {
      return res.status(401).json({ error: "Invalid phone number or password" });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid phone number or password" });
    }

    const token = createJwtToken(user._id.toString());
    return res.json({
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    console.error("[Auth.Login] Unexpected error:", err);
    return res.status(500).json({ error: "Internal server error during login" });
  }
});

router.post("/register", identityRateLimit, parseIdUpload, async (req, res) => {
  const savedDocumentKeys: string[] = [];
  let createdUserId: string | undefined;
  try {
    const {
      phone,
      password,
      name,
      role = "buyer",
      email,
      farmName,
      farmLocation,
      idType,
      idConsent,
    } = req.body;

    const normalizedRole = String(role || "buyer").trim().toLowerCase();
    if (normalizedRole !== "buyer" && normalizedRole !== "seller") {
      return res.status(400).json({ error: "Choose Buyer or Seller to register." });
    }
    const uploadedIdDocuments = getUploadedIdDocuments(req, String(idType || ""));
    if (!phone || !password || !name) {
      return res.status(400).json({ error: "Name, phone, and password are required." });
    }
    if (normalizedRole === "seller" && !uploadedIdDocuments) {
      return res.status(400).json({
        error:
          String(idType || "").trim().toLowerCase() === "passport"
            ? "Seller registration requires the passport information/photo page."
            : "Seller registration requires both sides of a government ID.",
      });
    }
    if (uploadedIdDocuments && (!idType || idConsent !== "true")) {
      return res.status(400).json({
        error: "ID type and consent are required when submitting ID photos.",
      });
    }
    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }
    if (String(name).trim().length < 2 || String(name).trim().length > 100) {
      return res.status(400).json({ error: "Name must be between 2 and 100 characters." });
    }
    const supportedIdTypes = new Set([
      "Driver's License",
      "Passport",
      "National ID",
      "Company ID",
      "Other",
    ]);
    if (uploadedIdDocuments && !supportedIdTypes.has(String(idType).trim())) {
      return res.status(400).json({ error: "Choose a supported ID type." });
    }
    if (normalizedRole === "seller" && (!String(farmName || "").trim() || !String(farmLocation || "").trim())) {
      return res.status(400).json({ error: "Seller registration requires a farm name and location." });
    }

    const normalizedPhone = String(phone).trim();
    if (!/^09\d{9}$/.test(normalizedPhone)) {
      return res.status(400).json({ error: "Phone number must start with 09 and contain 11 digits" });
    }

    const existingPhone = await UserModel.findOne({ phone: normalizedPhone });
    if (existingPhone) {
      return res.status(409).json({ error: "Phone number already registered." });
    }

    let normalizedEmail: string | undefined;
    if (email) {
      normalizedEmail = String(email).toLowerCase().trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return res.status(400).json({ error: "Please enter a valid email address" });
      }

      const existingEmail = await UserModel.findOne({ email: normalizedEmail });
      if (existingEmail) {
        return res.status(409).json({ error: "Email is already registered." });
      }
    }

    let frontBuffer: Buffer | undefined;
    let backBuffer: Buffer | undefined;
    let idNameConsistent: boolean | null = null;
    let frontDocumentId: string | undefined;
    let backDocumentId: string | undefined;
    if (uploadedIdDocuments) {
      ({ frontBuffer, backBuffer } = await normalizeIdDocuments(
        req,
        String(idType)
      ));
      idNameConsistent = await checkNameConsistency(
        [frontBuffer, ...(backBuffer ? [backBuffer] : [])],
        String(name).trim()
      );
      frontDocumentId = await savePrivateIdImage(frontBuffer);
      savedDocumentKeys.push(frontDocumentId);
      if (backBuffer) {
        backDocumentId = await savePrivateIdImage(backBuffer);
        savedDocumentKeys.push(backDocumentId);
      }
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const now = new Date();

    const user = new UserModel({
      phone: normalizedPhone,
      email: normalizedEmail,
      password: hashedPassword,
      name: String(name).trim(),
      role: normalizedRole,
      isFarmer: normalizedRole === "seller",
      isSellerApproved: normalizedRole !== "seller",
      farmName: normalizedRole === "seller" ? String(farmName).trim() : undefined,
      farmLocation: normalizedRole === "seller" ? String(farmLocation).trim() : undefined,
      idType: uploadedIdDocuments ? String(idType).trim() : undefined,
      idFrontDocumentId: frontDocumentId,
      idBackDocumentId: backDocumentId,
      isIdVerified: false,
      idVerificationStatus: uploadedIdDocuments ? "pending_review" : "not_submitted",
      idNameConsistent,
      idRetryAllowed: uploadedIdDocuments ? Boolean(getSumsubSettings()) : false,
      ...(uploadedIdDocuments
        ? {
            idSubmittedAt: now,
            idConsentAt: now,
            idConsentVersion: "id-processing-v1",
            idDocumentsExpiresAt: new Date(
              now.getTime() + ID_DOCUMENT_RETENTION_DAYS * 24 * 60 * 60 * 1000
            ),
          }
        : {}),
      cart: [],
      wishlist: [],
    });

    await user.save();
    createdUserId = user._id.toString();
    const sumsubSettings = getSumsubSettings();
    let identityMessage = uploadedIdDocuments
      ? "Identity review is pending."
      : "ID submission is optional for buyer accounts.";
    if (sumsubSettings && uploadedIdDocuments && frontBuffer) {
      try {
        const applicantId = await submitSumsubVerification(sumsubSettings, {
          externalUserId: user._id.toString(),
          name: user.name,
          phone: normalizedPhone,
          idType: String(idType).trim(),
          front: frontBuffer,
          ...(backBuffer ? { back: backBuffer } : {}),
          onApplicantId: async id => {
            user.idProviderApplicantId = id;
            await user.save();
          },
        });
        user.idProviderApplicantId = applicantId;
        user.idVerificationStatus = "pending";
        user.idRetryAllowed = false;
        await user.save();
        identityMessage = "Identity documents were submitted to the configured verification provider.";
      } catch (providerError) {
        user.idVerificationStatus = "pending_review";
        user.idRetryAllowed = true;
        await user.save();
        console.error("[Auth.Register] Identity provider submission failed", {
          errorName: providerError instanceof Error ? providerError.name : "Error",
        });
        identityMessage = "Your account was created. Identity verification is pending; you can retry or wait for review.";
      }
    }
    return res.status(201).json({
      user: sanitizeUser(user),
      message: `Account created. ${identityMessage}`,
    });
  } catch (err: any) {
    if (createdUserId) {
      try {
        const persistedUser = await UserModel.findById(createdUserId);
        if (persistedUser) {
          return res.status(201).json({
            user: sanitizeUser(persistedUser),
            message: "Account created. Identity review is pending and can be retried.",
          });
        }
      } catch {
        // Leave stored documents in place when account persistence is uncertain.
      }
      return res.status(500).json({
        error: "Account processing is incomplete. Contact support before trying to register again.",
      });
    }
    await Promise.all(savedDocumentKeys.map(deletePrivateIdImage)).catch(() => undefined);
    if (err?.code === 11000) {
      return res.status(409).json({ error: "Phone number or email already registered." });
    }
    if (err instanceof IdImageValidationError) {
      return res.status(400).json({ error: err.message });
    }
    if (err instanceof IdDocumentStorageUnavailableError) {
      return res.status(503).json({
        error: "Secure ID document storage is unavailable. ID submission is temporarily disabled.",
      });
    }
    console.error("[Auth.Register] Registration failed", { errorName: err?.name || "Error" });
    return res.status(500).json({ error: "Internal server error during registration" });
  }
});

router.get("/verification-status", requireAuth, async (req: AuthRequest, res) => {
  const user = await UserModel.findById(req.user._id).select(
    "+idFrontDocumentId +idBackDocumentId +idFrontImage +idBackImage"
  );
  if (!user) return res.status(404).json({ error: "User not found" });
  const hasDocuments = Boolean(
    user.idFrontDocumentId || user.idBackDocumentId || user.idFrontImage || user.idBackImage
  );
  const status = user.isIdVerified
    ? "verified"
    : user.idVerificationStatus === "not_submitted" && hasDocuments
      ? "pending_review"
      : user.idVerificationStatus || (hasDocuments ? "pending_review" : "not_submitted");
  return res.json({
    status,
    submittedAt: user.idSubmittedAt || null,
    nameConsistent: user.idNameConsistent ?? null,
    retryAllowed: Boolean(user.idRetryAllowed),
    latestReasonCode: user.latestReasonCode || null,
    latestReasonNote: user.latestReasonNote || null,
  });
});

router.put("/id-documents", requireAuth, retryRateLimit, parseIdUpload, async (req: AuthRequest, res) => {
  const savedDocumentKeys: string[] = [];
  let replacementDocumentsPersisted = false;
  try {
    const user = await UserModel.findById(req.user._id).select(
      "+idProviderApplicantId +idFrontDocumentId +idBackDocumentId"
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    if (!canResubmitIdDocuments(user.idVerificationStatus, Boolean(user.idRetryAllowed))) {
      return res.status(409).json({ error: "ID documents cannot be resubmitted in the current verification status." });
    }
    if (req.body.idConsent !== "true") {
      return res.status(400).json({ error: "Consent is required to submit ID documents for review." });
    }

    const { frontBuffer, backBuffer } = await normalizeIdDocuments(
      req,
      user.idType
    );
    const idNameConsistent = await checkNameConsistency(
      [frontBuffer, ...(backBuffer ? [backBuffer] : [])],
      user.name
    );
    const frontDocumentId = await savePrivateIdImage(frontBuffer);
    savedDocumentKeys.push(frontDocumentId);
    const backDocumentId = backBuffer
      ? await savePrivateIdImage(backBuffer)
      : undefined;
    if (backDocumentId) savedDocumentKeys.push(backDocumentId);

    const oldDocumentIds = [user.idFrontDocumentId, user.idBackDocumentId];
    user.idFrontDocumentId = frontDocumentId;
    user.idBackDocumentId = backDocumentId;
    user.idVerificationStatus = "pending_review";
    user.isIdVerified = false;
    user.latestReasonCode = undefined;
    user.latestReasonNote = undefined;
    user.idNameConsistent = idNameConsistent;
    user.idSubmittedAt = new Date();
    user.idConsentAt = user.idSubmittedAt;
    user.idConsentVersion = "id-processing-v1";
    user.idRetryAllowed = Boolean(getSumsubSettings());
    user.idDocumentsExpiresAt = new Date(Date.now() + ID_DOCUMENT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    await user.save();
    replacementDocumentsPersisted = true;

    const sumsubSettings = getSumsubSettings();
    let message = "Your new ID photos were submitted for review.";
    if (sumsubSettings) {
      try {
        const applicantId = await submitSumsubVerification(sumsubSettings, {
          externalUserId: user._id.toString(),
          name: user.name,
          phone: user.phone,
          idType: user.idType || "Other",
          front: frontBuffer,
          ...(backBuffer ? { back: backBuffer } : {}),
          applicantId: user.idProviderApplicantId,
          onApplicantId: async id => {
            user.idProviderApplicantId = id;
            await user.save();
          },
        });
        user.idProviderApplicantId = applicantId;
        user.idVerificationStatus = "pending";
        message = "Your new ID photos were sent to the verification provider.";
      } catch (providerError) {
        user.idVerificationStatus = "pending_review";
        user.idRetryAllowed = true;
        console.error("[Auth.IDRetry] Identity provider submission failed", {
          errorName: providerError instanceof Error ? providerError.name : "Error",
        });
        message = "Your photos were saved securely, but provider submission needs a retry or manual review.";
      }
    }
    await user.save();
    await Promise.all(oldDocumentIds.map(deletePrivateIdImage));
    return res.json({
      status: user.idVerificationStatus,
      message,
    });
  } catch (err) {
    if (replacementDocumentsPersisted) {
      try {
        req.user.idVerificationStatus = "pending_review";
        req.user.isIdVerified = false;
        req.user.idRetryAllowed = Boolean(getSumsubSettings());
        await req.user.save();
      } catch {
        // Keep persisted replacement files even if state recovery needs later attention.
      }
      console.error("[Auth.IDRetry] Follow-up processing failed", {
        errorName: err instanceof Error ? err.name : "Error",
      });
      return res.status(202).json({
        status: "pending_review",
        retryAllowed: Boolean(getSumsubSettings()),
        message: "Your new photos were saved securely. Verification is pending and can be retried.",
      });
    }
    await Promise.all(savedDocumentKeys.map(deletePrivateIdImage)).catch(() => undefined);
    if (err instanceof IdImageValidationError) {
      return res.status(400).json({ error: err.message });
    }
    if (err instanceof IdDocumentStorageUnavailableError) {
      return res.status(503).json({
        error: "Private ID document storage is unavailable. ID resubmission is temporarily disabled.",
      });
    }
    console.error("[Auth.IDRetry] ID resubmission failed", {
      errorName: err instanceof Error ? err.name : "Error",
    });
    return res.status(500).json({ error: "Could not resubmit ID documents." });
  }
});

router.get("/profile", requireAuth, async (req: AuthRequest, res) => {
  const user = req.user;
  return res.json(sanitizeUser(user));
});

router.put("/profile", requireAuth, async (req: AuthRequest, res) => {
  const user = req.user;
  const updateData: any = pickUserEditableProfileFields(req.body);

  if (updateData.email !== undefined) {
    if (updateData.email) {
      const normalizedEmail = String(updateData.email).toLowerCase().trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return res.status(400).json({ error: "Please enter a valid email address" });
      }
      const existingEmail = await UserModel.findOne({ email: normalizedEmail });
      if (existingEmail && existingEmail._id.toString() !== user._id.toString()) {
        return res.status(400).json({ error: "Email is already registered" });
      }
      updateData.email = normalizedEmail;
    } else {
      updateData.email = undefined;
    }
  }

  if (updateData.phone !== undefined) {
    const normalizedPhone = String(updateData.phone).trim();
    if (!/^09\d{9}$/.test(normalizedPhone)) {
      return res.status(400).json({ error: "Phone number must start with 09 and contain 11 digits" });
    }
    const existingPhone = await UserModel.findOne({ phone: normalizedPhone });
    if (existingPhone && existingPhone._id.toString() !== user._id.toString()) {
      return res.status(400).json({ error: "Phone number already registered." });
    }
    updateData.phone = normalizedPhone;
  }

  const updatedUser = await UserModel.findByIdAndUpdate(user._id, updateData, {
    new: true,
    runValidators: true,
  }).select("-password");

  if (!updatedUser) {
    return res.status(404).json({ error: "User not found" });
  }
  return res.json(sanitizeUser(updatedUser));
});

router.put("/change-password", requireAuth, async (req: AuthRequest, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current and new passwords are required" });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters" });
  }

  const user = req.user;

  // Verify current password
  const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
  if (!isPasswordValid) {
    return res.status(401).json({ error: "Current password is incorrect" });
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Update password
  const updatedUser = await UserModel.findByIdAndUpdate(user._id, { password: hashedPassword }, { new: true }).select("-password");

  if (!updatedUser) {
    return res.status(404).json({ error: "User not found" });
  }

  return res.json({ message: "Password changed successfully", user: sanitizeUser(updatedUser) });
});

export default router;
