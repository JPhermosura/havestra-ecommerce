import { Router } from "express";
import { UserModel } from "../models/User.js";
import { requireAuth, requireRole, AuthRequest } from "../middleware/auth.js";

const router = Router();

// List users with search, role filter and pagination
router.get("/", requireAuth, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const { page = "1", limit = "20", search, role, suspended } = req.query as any;
    const p = Math.max(1, parseInt(String(page), 10) || 1);
    const l = Math.min(200, Math.max(1, parseInt(String(limit), 10) || 20));

    const query: any = {};
    if (search) {
      const q = String(search);
      query.$or = [
        { name: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
      ];
    }
    if (role) {
      query.role = String(role);
    }
    if (suspended !== undefined) {
      query.isSuspended = suspended === "true";
    }

    const total = await UserModel.countDocuments(query);
    const users = await UserModel.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip((p - 1) * l)
      .limit(l)
      .lean();

    return res.json({ users, total, page: p, pages: Math.ceil(total / l) });
  } catch (err) {
    console.error("/api/admin/users GET error", err);
    return res.status(500).json({ error: "Failed to list users" });
  }
});

// Get user details
router.get("/:id", requireAuth, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const user = await UserModel.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json(user);
  } catch (err) {
    console.error("/api/admin/users/:id GET error", err);
    return res.status(500).json({ error: "Failed to fetch user" });
  }
});

// Suspend account
router.put("/:id/suspend", requireAuth, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const user = await UserModel.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    user.isSuspended = true;
    await user.save();
    return res.json({ success: true });
  } catch (err) {
    console.error("/api/admin/users/:id/suspend PUT error", err);
    return res.status(500).json({ error: "Failed to suspend user" });
  }
});

// Reactivate account
router.put("/:id/reactivate", requireAuth, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const user = await UserModel.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    user.isSuspended = false;
    await user.save();
    return res.json({ success: true });
  } catch (err) {
    console.error("/api/admin/users/:id/reactivate PUT error", err);
    return res.status(500).json({ error: "Failed to reactivate user" });
  }
});
import { deletePrivateIdImage } from "../services/idDocuments.js";

// Delete account
router.delete("/:id", requireAuth, requireRole("admin"), async (req: AuthRequest, res) => {
  try {
    const user = await UserModel.findById(req.params.id).select(
      "+idFrontDocumentId +idBackDocumentId"
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    const documentIds = [user.idFrontDocumentId, user.idBackDocumentId];
    await user.deleteOne();
    const deleteResults = await Promise.allSettled(documentIds.map(deletePrivateIdImage));
    const cleanupFailures = deleteResults.filter(result => result.status === "rejected").length;
    if (cleanupFailures) {
      console.error("[Admin.Users] Private document cleanup incomplete", { cleanupFailures });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error("/api/admin/users/:id DELETE error", err);
    return res.status(500).json({ error: "Failed to delete user" });
  }
});

export default router;
