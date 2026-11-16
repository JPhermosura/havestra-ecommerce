import { Router } from "express";
import multer from "multer";
import mongoose from "mongoose";
import { ProductModel } from "../models/Product.js";
import {
  requireAuth,
  requireVerifiedSeller,
  AuthRequest,
} from "../middleware/auth.js";
import { publishNotifications } from "../services/notifications.js";

const upload = multer();
const router = Router();

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

router.get("/", async (req, res) => {
  const { category, search, sortBy, limit, farmerId } = req.query;
  const query: Record<string, any> = {};

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

  let cursor = ProductModel.find(query);
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
});

router.get("/:id", async (req, res) => {
  const product = await ProductModel.findOne({
    _id: req.params.id,
    status: { $ne: "inactive" },
    approvalStatus: { $nin: ["pending", "rejected"] },
  });
  if (!product) {
    return res.status(404).json({ error: "Product not found" });
  }
  return res.json(product);
});

router.get("/seller/:sellerId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { sellerId } = req.params;
    if (req.user._id.toString() !== sellerId && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Not authorized to view this seller's products" });
    }
    // Try to convert to ObjectId if valid, otherwise use string
    let sellerIdQuery: any = sellerId;
    if (mongoose.Types.ObjectId.isValid(sellerId)) {
      sellerIdQuery = new mongoose.Types.ObjectId(sellerId);
    }

    const products = await ProductModel.find({
      $or: [{ sellerId: sellerIdQuery }, { farmerId: sellerIdQuery }],
      status: { $ne: "inactive" },
    });
    return res.json({ products });
  } catch (error) {
    console.error("Error fetching seller products:", error);
    return res.status(500).json({ error: "Failed to fetch products" });
  }
});

router.post(
  "/",
  requireAuth,
  requireVerifiedSeller,
  upload.array("images"),
  async (req: AuthRequest, res) => {
    const { user } = req;

    const bodyData = req.body.productData
      ? JSON.parse(String(req.body.productData))
      : req.body;
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
    if (!name || !title || price === undefined) {
      return res
        .status(400)
        .json({ error: "Name, title, and price are required" });
    }
    const stockValue = Number(stock ?? 0);
    if (!Number.isSafeInteger(stockValue) || stockValue < 0) {
      return res
        .status(400)
        .json({ error: "Stock must be a non-negative whole number" });
    }

    const product = new ProductModel({
      name,
      title,
      description: description || "",
      price: Number(price),
      originalPrice: bodyData.originalPrice ?? Number(price),
      image: image || "",
      images: Array.isArray(images) ? images : image ? [image] : [],
      category: category || "",
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
    });
    await product.save();
    return res.status(201).json(product);
  }
);

router.put(
  "/:id",
  requireAuth,
  requireVerifiedSeller,
  upload.array("images"),
  async (req: AuthRequest, res) => {
    const product = await ProductModel.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    const bodyData = req.body.productData
      ? JSON.parse(String(req.body.productData))
      : req.body;
    const {
      name,
      title,
      description,
      price,
      originalPrice,
      image,
      category,
      stock,
      unit,
      season,
      weightBased,
      weightOptions,
      availability,
      bulkPricing,
      isOrganic,
      certifications,
      farmingMethod,
      harvestDate,
      status,
      images,
    } = bodyData;
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
  }
);

router.patch(
  "/:id/inventory",
  requireAuth,
  requireVerifiedSeller,
  async (req: AuthRequest, res) => {
    const stock = req.body?.stock;
    if (!Number.isSafeInteger(stock) || stock < 0) {
      return res
        .status(400)
        .json({ error: "Stock must be a non-negative whole number" });
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
  }
);

router.delete("/:id", requireAuth, async (req: AuthRequest, res) => {
  const product = await ProductModel.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ error: "Product not found" });
  }
  const { user } = req;
  if (product.sellerId?.toString() !== user._id.toString()) {
    return res
      .status(403)
      .json({ error: "Not authorized to delete this product" });
  }
  await product.deleteOne();
  return res.json({ success: true });
});

export default router;
