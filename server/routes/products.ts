import { Router } from "express";
import type { RequestHandler } from "express";
import multer from "multer";
import mongoose from "mongoose";
import sharp from "sharp";
import { ProductModel } from "../models/Product.js";
import {
  requireAuth,
  requireVerifiedSeller,
  AuthRequest,
} from "../middleware/auth.js";
import { publishNotifications } from "../services/notifications.js";

const maxProductImageBytes = 5 * 1024 * 1024;
const allowedProductCategories = new Set(["Fruits", "Vegetables"]);
const allowedProductImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const productImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxProductImageBytes,
    files: 1,
    fieldSize: 16 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedProductImageTypes.has(file.mimetype)) {
      return callback(
        new Error("Choose a JPG, JPEG, PNG, or WEBP product image.")
      );
    }
    return callback(null, true);
  },
});
const parseProductImageUpload: RequestHandler = (req, res, next) => {
  productImageUpload.array("images", 1)(req, res, error => {
    if (!error) {
      const files = (req.files || []) as Express.Multer.File[];
      void Promise.all(
        files.map(async file => {
          const metadata = await sharp(file.buffer, {
            failOn: "error",
            limitInputPixels: 32_000_000,
          }).metadata();
          const actualMimeType =
            metadata.format === "jpeg"
              ? "image/jpeg"
              : metadata.format === "png"
                ? "image/png"
                : metadata.format === "webp"
                  ? "image/webp"
                  : undefined;
          return actualMimeType === file.mimetype;
        })
      )
        .then(validFiles => {
          if (validFiles.some(isValid => !isValid)) {
            return res.status(400).json({
              error: "The selected file is not a valid supported image.",
            });
          }
          return next();
        })
        .catch((validationError: unknown) => {
          if (validationError instanceof Error) {
            return res.status(400).json({
              error: "The selected file is not a readable supported image.",
            });
          }
          return next(validationError);
        });
      return;
    }

    if (error) {
      const message =
        error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
          ? "Product image must be 5 MB or smaller."
          : error instanceof multer.MulterError &&
              error.code === "LIMIT_UNEXPECTED_FILE"
            ? "Upload one product image at a time."
            : error instanceof Error
              ? error.message
              : "Unable to process the product image.";
      return res.status(400).json({ error: message });
    }
  });
};
const router = Router();

class ProductInputError extends Error {}

function getFiniteNumber(value: unknown): number | undefined {
  if (
    typeof value !== "number" &&
    (typeof value !== "string" || !value.trim())
  ) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function asyncProductHandler(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve()
      .then(() => handler(req, res, next))
      .catch((error: unknown) => {
        if (res.headersSent) {
          next(error);
          return;
        }

        const isInvalidData =
          error instanceof ProductInputError ||
          error instanceof mongoose.Error.ValidationError ||
          error instanceof mongoose.Error.CastError;
        if (!isInvalidData) {
          console.error("[Products] Request failed", {
            errorName: error instanceof Error ? error.name : "Error",
          });
        }
        res.status(isInvalidData ? 400 : 500).json({
          error: isInvalidData
            ? error instanceof Error
              ? error.message
              : "Invalid product data."
            : "Unable to process the product request.",
        });
      });
  };
}

function getProductBodyData(req: AuthRequest): Record<string, any> {
  const rawData = req.body?.productData;
  let bodyData = rawData === undefined ? req.body : rawData;
  if (typeof bodyData === "string") {
    try {
      bodyData = JSON.parse(bodyData);
    } catch {
      throw new ProductInputError("Product data must contain valid JSON.");
    }
  }
  if (!bodyData || typeof bodyData !== "object" || Array.isArray(bodyData)) {
    throw new ProductInputError("Product data must be a JSON object.");
  }
  return bodyData as Record<string, any>;
}

async function isValidProductImageReference(value: unknown): Promise<boolean> {
  if (typeof value !== "string" || !value.trim()) return false;
  const image = value.trim();
  if (image.startsWith("/") && !image.startsWith("//")) {
    try {
      return (
        new URL(image, "https://havestra.invalid").origin ===
        "https://havestra.invalid"
      );
    } catch {
      return false;
    }
  }
  if (/^https?:\/\//i.test(image)) {
    try {
      const url = new URL(image);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }

  const dataUri =
    /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(
      image
    );
  if (!dataUri) return false;
  const imageBuffer = Buffer.from(dataUri[2], "base64");
  if (
    imageBuffer.length === 0 ||
    imageBuffer.length > maxProductImageBytes ||
    imageBuffer.toString("base64").replace(/=+$/, "") !==
      dataUri[2].replace(/=+$/, "")
  ) {
    return false;
  }
  try {
    const metadata = await sharp(imageBuffer, {
      failOn: "error",
      limitInputPixels: 32_000_000,
    }).metadata();
    const actualMimeType =
      metadata.format === "jpeg"
        ? "image/jpeg"
        : metadata.format === "png"
          ? "image/png"
          : metadata.format === "webp"
            ? "image/webp"
            : undefined;
    return actualMimeType === dataUri[1];
  } catch {
    return false;
  }
}

async function hasValidProductImages(images: unknown[]): Promise<boolean> {
  if (images.length === 0 || images.some(image => typeof image !== "string")) {
    return false;
  }
  return (await Promise.all(images.map(isValidProductImageReference))).every(
    Boolean
  );
}

function getUploadedProductImages(req: AuthRequest) {
  const files = (req.files || []) as Express.Multer.File[];
  return files.map(
    file => `data:${file.mimetype};base64,${file.buffer.toString("base64")}`
  );
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

router.get(
  "/",
  asyncProductHandler(async (req, res) => {
    const { category, search, sortBy, limit, farmerId } = req.query;
    const query: Record<string, any> = { isActive: { $ne: false } };

    if (category && category !== "all") {
      query.category = String(category).trim();
    }
    if (search) {
      const safeSearch = escapeRegex(String(search).trim());
      query.$or = [
        { name: { $regex: safeSearch, $options: "i" } },
        { title: { $regex: safeSearch, $options: "i" } },
        { description: { $regex: safeSearch, $options: "i" } },
      ];
    }
    query.status = { $ne: "inactive" };
    query.approvalStatus = { $nin: ["pending", "rejected"] };
    if (farmerId) {
      query.farmerId = farmerId;
    }

    let cursor = ProductModel.find(query).select("-stockReservations");
    if (sortBy === "price-low" || sortBy === "price") {
      cursor = cursor.sort({ price: 1 });
    } else if (sortBy === "price-high" || sortBy === "priceDesc") {
      cursor = cursor.sort({ price: -1 });
    } else if (sortBy === "rating") {
      cursor = cursor.sort({ rating: -1 });
    } else {
      cursor = cursor.sort({ createdAt: -1 });
    }

    if (limit) {
      const max = parseInt(String(limit), 10);
      if (!Number.isNaN(max)) {
        cursor = cursor.limit(max);
      }
    }

    const products = await cursor.exec();
    return res.json({ products });
  })
);

router.get(
  "/:id",
  asyncProductHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid product ID." });
    }
    const product = await ProductModel.findOne({
      _id: req.params.id,
      isActive: { $ne: false },
      status: { $ne: "inactive" },
      approvalStatus: { $nin: ["pending", "rejected"] },
    }).select("-stockReservations");
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    return res.json(product);
  })
);

router.get(
  "/seller/:sellerId",
  requireAuth,
  asyncProductHandler(async (req: AuthRequest, res) => {
    const { sellerId } = req.params;
    if (req.user._id.toString() !== sellerId && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Not authorized to view this seller's products" });
    }
    const sellerIdQuery = mongoose.isValidObjectId(sellerId)
      ? new mongoose.Types.ObjectId(sellerId)
      : sellerId;

    const products = await ProductModel.find({
      $or: [{ sellerId: sellerIdQuery }, { farmerId: sellerIdQuery }],
    });
    return res.json({ products });
  })
);

router.post(
  "/",
  requireAuth,
  requireVerifiedSeller,
  parseProductImageUpload,
  asyncProductHandler(async (req: AuthRequest, res) => {
    const { user } = req;
    const bodyData = getProductBodyData(req);
    const {
      name,
      title,
      description,
      price,
      category,
      image,
      stock,
      season,
      weightBased,
      weightOptions,
      availability,
      bulkPricing,
      isOrganic,
      certifications,
      farmingMethod,
      harvestDate,
      images,
    } = bodyData;
    const uploadedImages = getUploadedProductImages(req);
    if (images !== undefined && !Array.isArray(images)) {
      throw new ProductInputError("Product images must be an array.");
    }
    const productImages = uploadedImages.length
      ? uploadedImages
      : Array.isArray(images) && images.length > 0
        ? images
        : typeof image === "string" && image.trim()
          ? [image]
          : [];
    const productImage = productImages[0] || "";
    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof title !== "string" ||
      !title.trim()
    ) {
      throw new ProductInputError("Product name and title are required.");
    }
    const priceValue = getFiniteNumber(price);
    if (priceValue === undefined || priceValue <= 0) {
      throw new ProductInputError(
        "Price must be a valid amount greater than zero."
      );
    }
    const originalPriceValue =
      bodyData.originalPrice === undefined
        ? priceValue
        : getFiniteNumber(bodyData.originalPrice);
    if (originalPriceValue === undefined || originalPriceValue <= 0) {
      throw new ProductInputError(
        "Original price must be a valid amount greater than zero."
      );
    }
    if (
      typeof category !== "string" ||
      !allowedProductCategories.has(category)
    ) {
      throw new ProductInputError("Category must be Fruits or Vegetables.");
    }
    if (!(await hasValidProductImages(productImages))) {
      throw new ProductInputError(
        "Provide a valid JPG, PNG, or WEBP product image."
      );
    }
    const stockValue = stock === undefined ? 0 : getFiniteNumber(stock);
    if (
      stockValue === undefined ||
      !Number.isSafeInteger(stockValue) ||
      stockValue < 0
    ) {
      throw new ProductInputError("Stock must be a non-negative whole number.");
    }

    const product = new ProductModel({
      name: name.trim(),
      title: title.trim(),
      description: description || "",
      price: priceValue,
      originalPrice: originalPriceValue,
      image: productImage,
      images: productImages,
      category,
      stock: stockValue,
      season: season || "",
      weightBased: Boolean(weightBased),
      weightOptions: Array.isArray(weightOptions) ? weightOptions : [],
      availability: availability || "available",
      bulkPricing: Array.isArray(bulkPricing) ? bulkPricing : [],
      isOrganic: Boolean(isOrganic),
      certifications: Array.isArray(certifications) ? certifications : [],
      farmingMethod: farmingMethod || "",
      harvestDate: harvestDate || "",
      sellerId: user._id,
      sellerName: user.name,
      farmerId: user._id,
      farmerName: user.name,
      status: stockValue > 0 ? "Available" : "Out of Stock",
      approvalStatus: "pending",
      moderationReason: "",
      isActive: true,
    });
    await product.save();
    return res.status(201).json(product);
  })
);

router.put(
  "/:id",
  requireAuth,
  requireVerifiedSeller,
  parseProductImageUpload,
  asyncProductHandler(async (req: AuthRequest, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid product ID." });
    }
    const product = await ProductModel.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    const { user } = req;
    if (
      product.sellerId?.toString() !== user._id.toString() &&
      product.farmerId?.toString() !== user._id.toString()
    ) {
      return res
        .status(403)
        .json({ error: "Not authorized to update this product" });
    }
    const bodyData = getProductBodyData(req);
    const uploadedImages = getUploadedProductImages(req);
    if (uploadedImages.length) {
      bodyData.image = uploadedImages[0];
      bodyData.images = uploadedImages;
    }
    if (
      bodyData.name !== undefined &&
      (typeof bodyData.name !== "string" || !bodyData.name.trim())
    ) {
      throw new ProductInputError("Product name cannot be empty.");
    }
    if (
      bodyData.title !== undefined &&
      (typeof bodyData.title !== "string" || !bodyData.title.trim())
    ) {
      throw new ProductInputError("Product title cannot be empty.");
    }
    for (const field of ["price", "originalPrice"]) {
      const value = bodyData[field];
      if (value !== undefined) {
        const numericValue = getFiniteNumber(value);
        if (numericValue === undefined || numericValue <= 0) {
          throw new ProductInputError(
            `${field === "price" ? "Price" : "Original price"} must be greater than zero.`
          );
        }
      }
    }
    if (bodyData.stock !== undefined) {
      const stock = getFiniteNumber(bodyData.stock);
      if (stock === undefined || !Number.isSafeInteger(stock) || stock < 0) {
        throw new ProductInputError(
          "Stock must be a non-negative whole number."
        );
      }
    }
    if (
      bodyData.category !== undefined &&
      (typeof bodyData.category !== "string" ||
        !allowedProductCategories.has(bodyData.category))
    ) {
      throw new ProductInputError("Category must be Fruits or Vegetables.");
    }
    if (bodyData.images !== undefined && !Array.isArray(bodyData.images)) {
      throw new ProductInputError("Product images must be an array.");
    }
    const imageWasProvided =
      uploadedImages.length > 0 ||
      bodyData.image !== undefined ||
      bodyData.images !== undefined;
    if (imageWasProvided) {
      const imagesToValidate = uploadedImages.length
        ? uploadedImages
        : Array.isArray(bodyData.images) && bodyData.images.length > 0
          ? bodyData.images
          : typeof bodyData.image === "string" && bodyData.image.trim()
            ? [bodyData.image]
            : [];
      if (!(await hasValidProductImages(imagesToValidate))) {
        throw new ProductInputError(
          "Provide a valid JPG, PNG, or WEBP product image."
        );
      }
    }

    const listingFields = [
      "name",
      "title",
      "description",
      "price",
      "originalPrice",
      "image",
      "images",
      "category",
      "unit",
      "season",
      "weightBased",
      "weightOptions",
      "availability",
      "bulkPricing",
      "isOrganic",
      "certifications",
      "farmingMethod",
      "harvestDate",
      "status",
    ];
    listingFields.forEach(field => {
      if (bodyData[field] !== undefined) {
        (product as any)[field] = bodyData[field];
      }
    });
    if (
      listingFields.some(field => bodyData[field] !== undefined) &&
      product.approvalStatus !== "pending"
    ) {
      product.approvalStatus = "pending";
      product.moderationReason = "";
      product.moderationUpdatedAt = undefined;
    }

    await product.save();
    return res.json(product);
  })
);

router.patch(
  "/:id/active",
  requireAuth,
  requireVerifiedSeller,
  asyncProductHandler(async (req: AuthRequest, res) => {
    if (typeof req.body?.isActive !== "boolean") {
      return res.status(400).json({ error: "isActive must be a boolean" });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid product ID." });
    }
    const product = await ProductModel.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    if (
      product.sellerId?.toString() !== req.user._id.toString() &&
      product.farmerId?.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ error: "Not authorized to update this product" });
    }

    product.isActive = req.body.isActive;
    await product.save();
    return res.json({ product });
  })
);

router.patch(
  "/:id/inventory",
  requireAuth,
  requireVerifiedSeller,
  asyncProductHandler(async (req: AuthRequest, res) => {
    const stock = req.body?.stock;
    if (!Number.isSafeInteger(stock) || stock < 0) {
      return res
        .status(400)
        .json({ error: "Stock must be a non-negative whole number" });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid product ID." });
    }
    const product = await ProductModel.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    if (
      product.sellerId?.toString() !== req.user._id.toString() &&
      product.farmerId?.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ error: "Not authorized to update this inventory" });
    }

    const previousStock = product.stock;
    product.stock = stock;
    product.status = stock > 0 ? "Available" : "Out of Stock";
    await product.save();

    if (previousStock > 5 && stock <= 5 && stock > 0) {
      await publishNotifications([
        {
          userId: req.user._id,
          type: "inventory",
          title: "Low stock alert",
          message: `${product.title} has only ${stock} unit(s) remaining.`,
          link: "/seller/products",
        },
      ]);
    }

    return res.json({ product });
  })
);

router.delete(
  "/:id",
  requireAuth,
  asyncProductHandler(async (req: AuthRequest, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid product ID." });
    }
    const product = await ProductModel.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    const { user } = req;
    if (
      product.sellerId?.toString() !== user._id.toString() &&
      product.farmerId?.toString() !== user._id.toString()
    ) {
      return res
        .status(403)
        .json({ error: "Not authorized to delete this product" });
    }
    await product.deleteOne();
    return res.json({ success: true });
  })
);

export default router;
