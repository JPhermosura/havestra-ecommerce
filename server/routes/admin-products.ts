import express from "express";
import { ProductModel } from "../models/Product.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { publishNotifications } from "../services/notifications.js";

const router = express.Router();

// List products with optional search and seller filter
router.get("/", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const search = (req.query.search as string) || "";
    const seller = (req.query.seller as string) || "";
    const approvalStatus = (req.query.approvalStatus as string) || "";

    const filter: any = {};
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }
    if (seller) filter.sellerId = seller;
    if (approvalStatus === "approved") {
      filter.$and = [
        ...(filter.$and || []),
        {
          $or: [
            { approvalStatus: "approved" },
            { approvalStatus: { $exists: false } },
          ],
        },
      ];
    } else if (
      approvalStatus &&
      ["pending", "rejected"].includes(approvalStatus)
    ) {
      filter.approvalStatus = approvalStatus;
    }

    const total = await ProductModel.countDocuments(filter);
    const products = await ProductModel.find(filter)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("sellerId", "name phone")
      .sort({ createdAt: -1 });

    res.json({ products, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// Get product details
router.get("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const product = await ProductModel.findById(req.params.id).populate(
      "sellerId",
      "name phone email"
    );
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json({ product });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

// Update product
router.put("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const updates = req.body;
    const allowedFields = ["title", "description", "price", "stock"];
    if (
      !updates ||
      typeof updates !== "object" ||
      Array.isArray(updates) ||
      Object.keys(updates).length === 0 ||
      Object.keys(updates).some(field => !allowedFields.includes(field))
    ) {
      return res.status(400).json({
        error: "Only title, description, price, or stock may be updated.",
      });
    }
    if (
      updates.title !== undefined &&
      (typeof updates.title !== "string" ||
        !updates.title.trim() ||
        updates.title.trim().length > 120)
    ) {
      return res.status(400).json({ error: "Title must be 1-120 characters." });
    }
    if (
      updates.description !== undefined &&
      (typeof updates.description !== "string" ||
        updates.description.length > 5000)
    ) {
      return res
        .status(400)
        .json({ error: "Description must be at most 5000 characters." });
    }
    if (
      updates.price !== undefined &&
      (typeof updates.price !== "number" ||
        !Number.isFinite(updates.price) ||
        updates.price < 0)
    ) {
      return res
        .status(400)
        .json({ error: "Price must be a non-negative number." });
    }
    if (
      updates.stock !== undefined &&
      (!Number.isSafeInteger(updates.stock) || updates.stock < 0)
    ) {
      return res
        .status(400)
        .json({ error: "Stock must be a non-negative whole number." });
    }
    const product = await ProductModel.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    Object.assign(product, updates);
    if (updates.stock !== undefined) {
      product.status = updates.stock > 0 ? "Available" : "Out of Stock";
    }
    await product.save();
    res.json({ product });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update product" });
  }
});

// Delete product
router.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const product = await ProductModel.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

// Approve product listing
router.put(
  "/:id/approve",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const product = await ProductModel.findById(req.params.id);
      if (!product) return res.status(404).json({ error: "Product not found" });
      product.approvalStatus = "approved";
      product.moderationReason = "";
      product.moderationUpdatedAt = new Date();
      await product.save();
      const sellerId = product.sellerId || product.farmerId;
      if (sellerId) {
        await publishNotifications([
          {
            userId: sellerId,
            type: "inventory",
            title: "Product listing approved",
            message: `${product.title} has been approved and is visible in the marketplace.`,
            link: "/seller/products",
          },
        ]);
      }
      res.json({ product });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to approve product" });
    }
  }
);

router.put(
  "/:id/reject",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const reason =
        typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
      if (!reason || reason.length > 500) {
        return res.status(400).json({
          error: "A rejection reason of 1-500 characters is required.",
        });
      }
      const product = await ProductModel.findById(req.params.id);
      if (!product) return res.status(404).json({ error: "Product not found" });
      product.approvalStatus = "rejected";
      product.moderationReason = reason;
      product.moderationUpdatedAt = new Date();
      await product.save();
      const sellerId = product.sellerId || product.farmerId;
      if (sellerId) {
        await publishNotifications([
          {
            userId: sellerId,
            type: "inventory",
            title: "Product listing needs changes",
            message: `${product.title} was rejected: ${reason}`,
            link: "/seller/products",
          },
        ]);
      }
      res.json({ product });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to reject product" });
    }
  }
);

export default router;
