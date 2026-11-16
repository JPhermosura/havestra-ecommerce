import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ComplaintModel } from "../models/Complaint.js";

const router = express.Router();

// List complaints
router.get("/", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const status = (req.query.status as string) || "";

    const filter: any = {};
    if (status) filter.status = status;

    const total = await ComplaintModel.countDocuments(filter);
    const complaints = await ComplaintModel.find(filter).skip((page - 1) * limit).limit(limit).sort({ createdAt: -1 });
    res.json({ complaints, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch complaints" });
  }
});

// Get complaint
router.get("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const c = await ComplaintModel.findById(req.params.id);
    if (!c) return res.status(404).json({ error: "Complaint not found" });
    res.json({ complaint: c });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch complaint" });
  }
});

// Create complaint (could also be created by orders or users)
router.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const c = await ComplaintModel.create(req.body);
    res.json({ complaint: c });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create complaint" });
  }
});

// Update complaint (resolve)
router.put("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const updates = req.body || {};
    if (updates.status === "resolved") updates.resolvedAt = new Date();
    const c = await ComplaintModel.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!c) return res.status(404).json({ error: "Complaint not found" });
    res.json({ complaint: c });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update complaint" });
  }
});

// Delete complaint
router.delete("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    await ComplaintModel.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete complaint" });
  }
});

export default router;
