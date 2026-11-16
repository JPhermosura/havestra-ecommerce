import mongoose, { Schema, model } from "mongoose";

const WeightOptionSchema = new Schema(
  {
    weight: { type: Number },
    price: { type: Number },
  },
  { _id: false }
);

const ProductSchema = new Schema(
  {
    name: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true, default: 0 },
    originalPrice: { type: Number },
    image: { type: String, default: "" },
    images: [{ type: String }],
    category: {
      type: String,
      enum: ["Fruits", "Vegetables"],
      default: "Fruits",
    },
    unit: { type: String, enum: ["Piece", "Bundle"], default: "Piece" },
    rating: { type: Number, default: 0 },
    reviews: { type: Number, default: 0 },
    stock: { type: Number, default: 0 },
    season: { type: String },
    weightBased: { type: Boolean, default: false },
    weightOptions: { type: [WeightOptionSchema], default: [] },
    farmerId: { type: Schema.Types.ObjectId, ref: "User" },
    farmerName: { type: String, default: "" },
    farmLocation: { type: String, default: "" },
    availability: {
      type: String,
      enum: ["available", "pre-order", "out-of-season"],
      default: "available",
    },
    bulkPricing: [
      {
        minQuantity: { type: Number },
        discountPercent: { type: Number },
      },
    ],
    isOrganic: { type: Boolean, default: false },
    certifications: [{ type: String }],
    farmingMethod: { type: String },
    harvestDate: { type: String },
    status: {
      type: String,
      enum: ["Available", "Out of Stock"],
      default: "Available",
    },
    sellerId: { type: Schema.Types.ObjectId, ref: "User" },
    sellerName: { type: String, default: "" },
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "approved",
    },
    moderationReason: { type: String, default: "" },
    moderationUpdatedAt: { type: Date },
  },
  { timestamps: true }
);

export const ProductModel =
  mongoose.models.Product || model("Product", ProductSchema);
