import { Router } from "express";
import type { RequestHandler } from "express";
import multer from "multer";
import mongoose from "mongoose";
import sharp, { type Metadata } from "sharp";
import { ReviewModel } from "../models/Review.js";
import { OrderModel } from "../models/Order.js";
import { ProductModel } from "../models/Product.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import { publishNotifications } from "../services/notifications.js";

const router = Router();
const maxReviewImageBytes = 5 * 1024 * 1024;
const allowedReviewImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const upload = multer({
  fileFilter: (_req, file, callback) => {
    if (!allowedReviewImageTypes.has(file.mimetype)) {
      return callback(
        new Error("Choose a JPG, JPEG, PNG, or WEBP review image.")
      );
    }
    return callback(null, true);
  },
  limits: {
    fileSize: maxReviewImageBytes,
    files: 3,
    fields: 8,
    parts: 12,
  },
});
const parseReviewImages: RequestHandler = (req, res, next) => {
  upload.array("images", 3)(req, res, error => {
    if (!error) return next();

    const message =
      error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
        ? "Each review image must be 5 MB or smaller."
        : error instanceof multer.MulterError &&
            (error.code === "LIMIT_UNEXPECTED_FILE" ||
              error.code === "LIMIT_FILE_COUNT")
          ? "Upload up to 3 review images."
          : error instanceof Error
            ? error.message
            : "Unable to process review images.";
    return res.status(400).json({ error: message });
  });
};

class ReviewImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewImageValidationError";
  }
}

async function normalizeReviewImage(file: Express.Multer.File) {
  const image = sharp(file.buffer, {
    failOn: "error",
    limitInputPixels: 32_000_000,
  });
  let metadata: Metadata;
  try {
    metadata = await image.metadata();
  } catch {
    throw new ReviewImageValidationError(
      "A review image could not be decoded."
    );
  }

  const actualMimeType =
    metadata.format === "jpeg"
      ? "image/jpeg"
      : metadata.format === "png"
        ? "image/png"
        : metadata.format === "webp"
        ? "image/webp"
        : undefined;
  if (!actualMimeType || actualMimeType !== file.mimetype) {
    throw new ReviewImageValidationError(
      "A review image is not a valid JPG, PNG, or WEBP file."
    );
  }
  if (!metadata.width || !metadata.height || metadata.width < 32 || metadata.height < 32) {
    throw new ReviewImageValidationError(
      "Review images must be at least 32 pixels wide and high."
    );
  }

  try {
    const normalized = await image
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    return `data:image/jpeg;base64,${normalized.toString("base64")}`;
  } catch {
    throw new ReviewImageValidationError(
      "A review image could not be normalized."
    );
  }
}

router.get(
  "/eligible/:productId",
  requireAuth,
  async (req: AuthRequest, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.productId)) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    const order = await OrderModel.findOne({
      buyerId: req.user._id,
      "items.productId": req.params.productId,
      status: "Delivered",
    });

    const existingReview = await ReviewModel.findOne({
      productId: req.params.productId,
      userId: req.user._id,
    });

    return res.json({
      eligible: !!order && !existingReview,
      alreadyReviewed: !!existingReview,
      delivered: !!order,
      orderId: order?._id,
    });
  }
);

router.get("/:productId", async (req, res) => {
  const reviews = await ReviewModel.find({
    productId: req.params.productId,
  }).sort({ createdAt: -1 });
  return res.json({ reviews });
});

router.post(
  "/",
  requireAuth,
  parseReviewImages,
  async (req: AuthRequest, res) => {
    const { productId, orderId, rating, title, comment } = req.body;
    const numericRating = Number(rating);
    if (
      !mongoose.Types.ObjectId.isValid(productId) ||
      !mongoose.Types.ObjectId.isValid(orderId) ||
      !Number.isInteger(numericRating) ||
      numericRating < 1 ||
      numericRating > 5
    ) {
      return res.status(400).json({
        error: "Valid product, delivered order, and 1-5 rating are required",
      });
    }
    if (
      typeof title !== "string" ||
      !title.trim() ||
      title.trim().length > 120 ||
      typeof comment !== "string" ||
      !comment.trim() ||
      comment.trim().length > 2000
    ) {
      return res.status(400).json({
        error:
          "Review title and comment are required and must be within the allowed length",
      });
    }

    const product = await ProductModel.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const deliveredOrder = await OrderModel.findOne({
      _id: orderId,
      buyerId: req.user._id,
      status: "Delivered",
      "items.productId": product._id,
    });
    if (!deliveredOrder) {
      return res.status(403).json({
        error:
          "A delivered order containing this product is required to review it",
      });
    }

    const existingReview = await ReviewModel.findOne({
      productId,
      userId: req.user._id,
    });
    if (existingReview) {
      return res
        .status(400)
        .json({ error: "You have already reviewed this product" });
    }

    let imagePaths: string[];
    try {
      imagePaths = await Promise.all(
        ((req.files || []) as Express.Multer.File[]).map(normalizeReviewImage)
      );
    } catch (error) {
      if (error instanceof ReviewImageValidationError) {
        return res.status(400).json({ error: error.message });
      }
      console.error("[Reviews] Image processing failed", {
        errorName: error instanceof Error ? error.name : "Error",
      });
      return res.status(500).json({ error: "Review images could not be processed." });
    }
    const review = new ReviewModel({
      productId: product._id,
      orderId: deliveredOrder._id,
      userId: req.user._id,
      userName: req.user.name,
      rating: numericRating,
      title: title.trim(),
      comment: comment.trim(),
      images: imagePaths,
      isVerified: true,
    });

    await review.save();
    const [ratingSummary] = await ReviewModel.aggregate([
      { $match: { productId: product._id } },
      {
        $group: {
          _id: null,
          average: { $avg: "$rating" },
          count: { $sum: 1 },
        },
      },
    ]);
    if (!ratingSummary) {
      throw new Error("Unable to calculate product rating after saving review");
    }
    await ProductModel.updateOne(
      { _id: product._id },
      {
        $set: {
          rating: Math.round(ratingSummary.average * 10) / 10,
          reviews: ratingSummary.count,
        },
      }
    );
    const sellerId = product.sellerId || product.farmerId;
    if (sellerId) {
      await publishNotifications([
        {
          userId: sellerId,
          type: "review",
          title: "New product review",
          message: `${req.user.name} left a ${numericRating}-star review for ${product.title}.`,
          link: "/seller/reviews",
        },
      ]);
    }
    return res.status(201).json(review);
  }
);

router.post("/reply", requireAuth, async (req: AuthRequest, res) => {
  const { reviewId, reply } = req.body;
  if (
    !mongoose.Types.ObjectId.isValid(reviewId) ||
    typeof reply !== "string" ||
    !reply.trim() ||
    reply.trim().length > 2000
  ) {
    return res.status(400).json({ error: "reviewId and reply are required" });
  }
  if (req.user.role !== "seller") {
    return res
      .status(403)
      .json({ error: "Only the product's seller can reply to reviews" });
  }

  const review = await ReviewModel.findById(reviewId);
  if (!review) {
    return res.status(404).json({ error: "Review not found" });
  }
  const product = await ProductModel.findById(review.productId);
  if (
    !product ||
    (product.sellerId?.toString() !== req.user._id.toString() &&
      product.farmerId?.toString() !== req.user._id.toString())
  ) {
    return res
      .status(403)
      .json({ error: "You are not authorized to reply to this review" });
  }

  review.sellerResponse = {
    comment: reply.trim(),
    respondedAt: new Date(),
    sellerId: req.user._id,
    sellerName: req.user.name,
  };
  await review.save();
  return res.json(review);
});

export default router;
