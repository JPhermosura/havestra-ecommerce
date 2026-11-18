import { Router } from "express";
import { ProductModel } from "../models/Product.js";
import { UserModel } from "../models/User.js";
import { requireAuth, AuthRequest } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const user = await UserModel.findById(req.user._id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  return res.json({ items: user.cart || [] });
});

router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const user = await UserModel.findById(req.user._id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  const { productId, quantity = 1 } = req.body;
  const product = await ProductModel.findById(productId);
  if (!product) {
    return res.status(404).json({ error: "Product not found" });
  }
  if (product.isActive === false || product.status === "inactive") {
    return res
      .status(409)
      .json({ error: "This product is no longer available" });
  }

  const existingIndex = (user.cart || []).findIndex(
    (item: any) => item.productId.toString() === productId
  );

  if (existingIndex >= 0) {
    user.cart[existingIndex].quantity += Number(quantity);
    user.cart[existingIndex].quantity = Math.max(
      1,
      user.cart[existingIndex].quantity
    );
  } else {
    user.cart.push({
      productId: product._id,
      productName: product.name,
      productImage: product.image,
      unitPrice: product.price,
      category: product.category,
      quantity: Number(quantity),
      sellerId: product.sellerId,
      farmerId: product.farmerId,
    });
  }

  await user.save();
  return res.json({ items: user.cart });
});

router.delete("/:id", requireAuth, async (req: AuthRequest, res) => {
  const user = await UserModel.findById(req.user._id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  user.cart = (user.cart || []).filter(
    (item: any) => item.productId.toString() !== req.params.id
  );
  await user.save();
  return res.json({ items: user.cart });
});

router.put("/:id", requireAuth, async (req: AuthRequest, res) => {
  const user = await UserModel.findById(req.user._id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  const quantity = Number(req.body.quantity ?? 1);
  if (quantity <= 0) {
    user.cart = (user.cart || []).filter(
      (item: any) => item.productId.toString() !== req.params.id
    );
  } else {
    const item = (user.cart || []).find(
      (item: any) => item.productId.toString() === req.params.id
    );
    if (!item) {
      return res.status(404).json({ error: "Cart item not found" });
    }
    item.quantity = quantity;
  }
  await user.save();
  return res.json({ items: user.cart });
});

router.post("/clear", requireAuth, async (req: AuthRequest, res) => {
  const user = await UserModel.findById(req.user._id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  user.cart = [];
  await user.save();
  return res.json({ items: [] });
});

export default router;
