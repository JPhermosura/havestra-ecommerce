import { Router } from "express";
import { UserModel } from "../models/User.js";
import { ProductModel } from "../models/Product.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const user = await UserModel.findById(req.user._id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const products = await ProductModel.find({
    _id: { $in: user.wishlist || [] },
    isActive: { $ne: false },
    status: { $ne: "inactive" },
    approvalStatus: { $nin: ["pending", "rejected"] },
  });
  return res.json({ wishlist: products });
});

router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const { productId } = req.body;
  if (!productId) {
    return res.status(400).json({ error: "productId is required" });
  }

  const product = await ProductModel.findOne({
    _id: productId,
    isActive: { $ne: false },
    status: { $ne: "inactive" },
    approvalStatus: { $nin: ["pending", "rejected"] },
  });
  if (!product) {
    return res.status(404).json({ error: "Product not found" });
  }

  const user = await UserModel.findById(req.user._id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  if (!(user.wishlist || []).includes(productId)) {
    user.wishlist.push(productId);
  }
  await user.save();
  return res.json({ product });
});

router.delete("/:productId", requireAuth, async (req: AuthRequest, res) => {
  const user = await UserModel.findById(req.user._id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  user.wishlist = (user.wishlist || []).filter(
    (id: any) => id.toString() !== req.params.productId
  );
  await user.save();
  return res.json({ success: true });
});

router.delete("/", requireAuth, async (req: AuthRequest, res) => {
  const user = await UserModel.findById(req.user._id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  user.wishlist = [];
  await user.save();
  return res.json({ success: true });
});

export default router;
