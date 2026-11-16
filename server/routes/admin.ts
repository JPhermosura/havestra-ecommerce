import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { UserModel } from "../models/User.js";
import { ProductModel } from "../models/Product.js";
import { OrderModel } from "../models/Order.js";
import { ComplaintModel } from "../models/Complaint.js";
import { AuditModel } from "../models/Audit.js";
import { requireAuth, requireRole, AuthRequest } from "../middleware/auth.js";
import type { Request } from "express";
import { readFile } from "node:fs/promises";
import path from "node:path";

const router = Router();
const auditLogFile = path.join(
  path.resolve(process.cwd(), "logs"),
  "id-reviews.log"
);

type SafeIdReviewAudit = {
  id: string;
  timestamp: string;
  action: string;
  source: "identity_review" | "admin_activity";
  reviewerUserId?: string;
  targetUserId?: string;
  reasonCode?: string;
};

async function readIdentityReviewAudit(): Promise<SafeIdReviewAudit[]> {
  const entries: SafeIdReviewAudit[] = [];
  for (let rotation = 0; rotation <= 5; rotation += 1) {
    const file = rotation === 0 ? auditLogFile : `${auditLogFile}.${rotation}`;
    try {
      const content = await readFile(file, "utf8");
      const lines = content.split(/\r?\n/);
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (!line.trim()) continue;
        try {
          const row = JSON.parse(line) as Record<string, unknown>;
          if (
            typeof row.timestamp !== "string" ||
            typeof row.action !== "string" ||
            typeof row.reviewerUserId !== "string" ||
            typeof row.targetUserId !== "string"
          ) {
            continue;
          }
          const timestamp = new Date(row.timestamp);
          if (Number.isNaN(timestamp.getTime())) continue;
          entries.push({
            id: `identity-${rotation}-${index}-${timestamp.getTime()}`,
            timestamp: timestamp.toISOString(),
            action: row.action,
            source: "identity_review",
            reviewerUserId: row.reviewerUserId,
            targetUserId: row.targetUserId,
            ...(typeof row.reasonCode === "string"
              ? { reasonCode: row.reasonCode }
              : {}),
          });
        } catch {
          console.warn("[Admin.Audit] Ignored malformed identity audit entry", {
            rotation,
            line: index + 1,
          });
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return entries;
}

function parseAuditPagination(query: Request["query"]) {
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 25);
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    return null;
  }
  return { page, limit };
}

router.get("/audit", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const pagination = parseAuditPagination(req.query);
    if (!pagination) {
      return res.status(400).json({
        error: "Page must be positive and limit must be between 1 and 100.",
      });
    }
    const action =
      typeof req.query.action === "string" ? req.query.action.trim() : "";
    const [identityEntries, adminEntries] = await Promise.all([
      readIdentityReviewAudit(),
      AuditModel.find(action ? { action } : {})
        .sort({ createdAt: -1 })
        .limit(2000)
        .select("action createdAt")
        .lean(),
    ]);
    const entries: SafeIdReviewAudit[] = [
      ...identityEntries,
      ...adminEntries.map((entry, index) => ({
        id: `admin-${String(entry._id ?? index)}`,
        timestamp: new Date(entry.createdAt).toISOString(),
        action: String(entry.action),
        source: "admin_activity" as const,
      })),
    ]
      .filter(entry => !action || entry.action === action)
      .sort(
        (left, right) =>
          Date.parse(right.timestamp) - Date.parse(left.timestamp)
      );
    const start = (pagination.page - 1) * pagination.limit;
    return res.json({
      entries: entries.slice(start, start + pagination.limit),
      total: entries.length,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(entries.length / pagination.limit),
    });
  } catch (error) {
    console.error("[Admin.Audit] Failed to load audit history", {
      errorName: error instanceof Error ? error.name : "Error",
    });
    return res
      .status(500)
      .json({ error: "Could not load administrative audit history." });
  }
});

router.get(
  "/dashboard",
  requireAuth,
  requireRole("admin"),
  async (_req, res) => {
    try {
      const [
        users,
        sellersPending,
        products,
        orders,
        deliveredSales,
        complaints,
        deliveriesActive,
        audits,
      ] = await Promise.all([
        UserModel.countDocuments({}),
        UserModel.countDocuments({ role: "seller", isSellerApproved: false }),
        ProductModel.countDocuments({}),
        OrderModel.countDocuments({}),
        OrderModel.aggregate([
          { $match: { status: "Delivered" } },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]),
        ComplaintModel.countDocuments({ status: { $ne: "resolved" } }),
        OrderModel.countDocuments({
          deliveryStatus: {
            $in: ["Pending", "In Transit", "Out for Delivery"],
          },
        }),
        AuditModel.find()
          .sort({ createdAt: -1 })
          .limit(6)
          .select("action createdAt")
          .lean(),
      ]);

      return res.json({
        stats: {
          users,
          sellersPending,
          products,
          orders,
          totalSales: deliveredSales[0]?.total ?? 0,
          complaints,
          deliveriesActive,
        },
        recentActivity: audits.map(audit => ({
          description: audit.action,
          createdAt: audit.createdAt,
        })),
      });
    } catch (error) {
      console.error("[Admin.Dashboard] Failed to load dashboard data", {
        errorName: error instanceof Error ? error.name : "Error",
      });
      return res.status(500).json({ error: "Failed to load admin dashboard." });
    }
  }
);

// Create or promote an admin user. Only accessible by existing admins.
const adminLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 6, // limit each IP to 6 requests per windowMs
  message: { error: "Too many admin requests, please try again later." },
});

router.post(
  "/create",
  adminLimiter,
  requireAuth,
  requireRole("admin"),
  async (req: AuthRequest, res) => {
    try {
      const { email, phone, name, password } = req.body;
      if (!email || !phone || !name || !password) {
        return res
          .status(400)
          .json({ error: "email, phone, name and password are required" });
      }

      // Basic validation
      const normalizedEmail = String(email).toLowerCase().trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return res.status(400).json({ error: "Invalid email format" });
      }
      const normalizedPhone = String(phone).trim();
      if (!/^09\d{9}$/.test(normalizedPhone)) {
        return res.status(400).json({
          error: "Phone number must start with 09 and contain 11 digits",
        });
      }
      if (String(password).length < 6) {
        return res
          .status(400)
          .json({ error: "Password must be at least 6 characters" });
      }
      const existing = await UserModel.findOne({ email: normalizedEmail });
      if (existing) {
        // If user exists and already admin, return 200
        if (String(existing.role).toLowerCase() === "admin") {
          const safe = await UserModel.findById(existing._id).select(
            "-password"
          );
          // persist audit record
          try {
            await AuditModel.create({
              actorPhone: req.user?.phone,
              actorEmail: req.user?.email,
              action: "noop",
              targetPhone: normalizedPhone,
              targetEmail: normalizedEmail,
              details: { info: "already_admin" },
            });
          } catch (e) {
            console.warn("Audit write failed", e);
          }
          return res.json({ user: safe });
        }
        // Promote existing user to admin
        existing.role = "admin";
        await existing.save();
        const promoted = await UserModel.findById(existing._id).select(
          "-password"
        );
        try {
          await AuditModel.create({
            actorPhone: req.user?.phone,
            actorEmail: req.user?.email,
            action: "promote",
            targetPhone: normalizedPhone,
            targetEmail: normalizedEmail,
            details: { promotedBy: req.user?._id },
          });
        } catch (e) {
          console.warn("Audit write failed", e);
        }
        return res.json({ user: promoted });
      }

      const hashed = await bcrypt.hash(password, 10);
      const user = new UserModel({
        email: normalizedEmail,
        phone: normalizedPhone,
        password: hashed,
        name,
        role: "admin",
      });
      await user.save();
      const safeUser = await UserModel.findById(user._id).select("-password");
      try {
        await AuditModel.create({
          actorPhone: req.user?.phone,
          actorEmail: req.user?.email,
          action: "create",
          targetPhone: normalizedPhone,
          targetEmail: normalizedEmail,
          details: { createdBy: req.user?._id },
        });
      } catch (e) {
        console.warn("Audit write failed", e);
      }
      return res.status(201).json({ user: safeUser });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Server error" });
    }
  }
);

export default router;
