import mongoose, { Schema, model } from "mongoose";
import { sanitizeComplianceNotes } from "../utils/sanitizeComplianceNotes.js";

const ContactInfoSchema = new Schema(
  {
    phone: { type: String },
    whatsapp: { type: String },
    email: { type: String },
  },
  { _id: false }
);

const CartItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true },
    productImage: { type: String, required: true },
    unitPrice: { type: Number, required: true },
    category: { type: String, default: "" },
    quantity: { type: Number, default: 1 },
    sellerId: { type: Schema.Types.ObjectId, ref: "User" },
    farmerId: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { _id: false }
);

const IdVerificationReviewSchema = new Schema(
  {
    status: { type: String, enum: ["verified", "rejected"], required: true },
    reasonCode: {
      type: String,
      enum: ["blurry_image", "name_mismatch", "expired_document", "unsupported_document", "other"],
    },
    reasonNote: { type: String, maxlength: 1000, set: sanitizeComplianceNotes },
    reviewerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reviewedAt: { type: Date, required: true },
  },
  { _id: true }
);

const UserSchema = new Schema(
  {
    email: {
      type: String,
      lowercase: true,
      trim: true,
      sparse: true,
    },
    password: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, enum: ["buyer", "seller", "admin"], default: "buyer" },
    phone: { type: String, required: true, unique: true, trim: true },
    address: { type: String },
    city: { type: String },
    country: { type: String },
    zipCode: { type: String },
    isFarmer: { type: Boolean, default: false },
    // Whether the seller/farm application has been approved by an admin
    isSellerApproved: { type: Boolean, default: false },
    farmName: { type: String },
    farmLocation: { type: String },
    idType: { type: String },
    idFrontDocumentId: { type: String, select: false },
    idBackDocumentId: { type: String, select: false },
    idFrontImage: { type: String, select: false },
    idBackImage: { type: String, select: false },
    isIdVerified: { type: Boolean, default: false },
    idVerificationStatus: {
      type: String,
      enum: ["not_submitted", "pending", "verified", "pending_review", "rejected"],
      default: "not_submitted",
    },
    idProviderApplicantId: { type: String, select: false },
    idProviderLastEventAt: { type: Date, select: false },
    idRetryAllowed: { type: Boolean, default: false },
    idConsentAt: { type: Date, select: false },
    idConsentVersion: { type: String, select: false },
    idNameConsistent: { type: Boolean, default: null },
    idSubmittedAt: { type: Date },
    idVerifiedAt: { type: Date },
    idDocumentsExpiresAt: { type: Date },
    idVerificationReviews: { type: [IdVerificationReviewSchema], default: [] },
    latestReasonCode: {
      type: String,
      enum: ["blurry_image", "name_mismatch", "expired_document", "unsupported_document", "other"],
    },
    latestReasonNote: { type: String, maxlength: 1000, set: sanitizeComplianceNotes },
    farmType: { type: String },
    certifications: [{ type: String }],
    farmDescription: { type: String },
    farmImages: [{ type: String }],
    yearsOfExperience: { type: Number },
    isSuspended: { type: Boolean, default: false },
    contactInfo: { type: ContactInfoSchema },
    cart: { type: [CartItemSchema], default: [] },
    wishlist: [{ type: Schema.Types.ObjectId, ref: "Product" }],
  },
  { timestamps: true }
);

export const UserModel = mongoose.models.User || model("User", UserSchema);
