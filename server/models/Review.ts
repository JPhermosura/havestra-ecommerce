import mongoose, { Schema, model } from "mongoose";

const ReviewSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order" },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    userName: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, default: "" },
    comment: { type: String, default: "" },
    images: [{ type: String }],
    isVerified: { type: Boolean, default: false },
    helpful: { type: Number, default: 0 },
    reported: { type: Boolean, default: false },
    sellerResponse: {
      comment: { type: String },
      respondedAt: { type: Date },
      sellerId: { type: Schema.Types.ObjectId, ref: "User" },
      sellerName: { type: String },
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const ReviewModel = mongoose.models.Review || model("Review", ReviewSchema);
